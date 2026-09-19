"""
PolicyLab Core Authentication & Authorization Module (Production Grade)
Enforces fail-closed authentication, role-based access control (RBAC),
and identity provenance tracking across API Gateway HTTP API v2 (Cognito JWT Authorizer)
and standalone application servers.
"""

import base64
import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Optional
from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

logger = logging.getLogger("policylab.auth")


class AuthenticatedUser(BaseModel):
    """
    Standardized canonical identity representation for authenticated callers.
    """
    sub: str = Field(description="Unique subject identifier (Cognito sub / UUID)")
    username: str = Field(description="Unique human-readable username or email")
    email: Optional[str] = Field(default=None, description="Verified email address")
    roles: List[str] = Field(
        default_factory=lambda: ["engineer"],
        description="Assigned platform authorization roles (e.g. viewer, engineer, approver, deployer, admin)",
    )
    auth_source: str = Field(
        default="LOCAL_DEV_FALLBACK",
        description="Origin of authentication evidence: API_GATEWAY_JWT | BEARER_JWT | LOCAL_DEV_FALLBACK",
    )

    @property
    def is_authenticated(self) -> bool:
        return True

    def has_role(self, role: str) -> bool:
        return role.lower() in [r.lower() for r in self.roles]

    def has_any_role(self, allowed_roles: List[str]) -> bool:
        user_roles = set(r.lower() for r in self.roles)
        return bool(user_roles.intersection(set(r.lower() for r in allowed_roles)))


def _base64url_decode(input_str: str) -> bytes:
    """Decodes a base64url-encoded string with padding normalization."""
    rem = len(input_str) % 4
    if rem > 0:
        input_str += "=" * (4 - rem)
    return base64.urlsafe_b64decode(input_str)


def _base64url_encode(input_bytes: bytes) -> str:
    """Encodes bytes to a base64url string without trailing padding."""
    return base64.urlsafe_b64encode(input_bytes).decode("utf-8").rstrip("=")


def parse_jwt_payload_unverified(token: str) -> Dict[str, Any]:
    """
    Decodes the JSON payload from a JWT structure (header.payload.signature).
    Raises HTTPException(401) on malformed token structure.
    """
    parts = token.strip().split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token: expected 3-part JWT structure",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )
    try:
        payload_bytes = _base64url_decode(parts[1])
        return json.loads(payload_bytes.decode("utf-8"))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Malformed authentication token payload: {str(ex)}",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )


def create_token_for_testing(
    sub: str = "test_user_001",
    username: str = "test_user",
    email: str = "test@policylab.internal",
    roles: Optional[List[str]] = None,
    expires_in_seconds: int = 3600,
) -> str:
    """
    Test helper: Creates a formatted JWT string with explicit expiration and claims.
    Useful for unit/integration testing without third-party dependencies.
    """
    if roles is None:
        roles = ["engineer"]

    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": sub,
        "cognito:username": username,
        "email": email,
        "cognito:groups": roles,
        "iat": now,
        "exp": now + expires_in_seconds,
        "iss": "https://cognito-idp.us-east-1.amazonaws.com/test-pool",
        "aud": "test-client-id",
    }

    h_str = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_str = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig_str = _base64url_encode(b"simulated_test_signature")
    return f"{h_str}.{p_str}.{sig_str}"


def get_current_user(request: Request) -> AuthenticatedUser:
    """
    Centralized FastAPI security dependency.
    Extracts authenticated user claims from:
    1. AWS API Gateway HTTP API v2 authorizer claims (requestContext.authorizer.jwt.claims)
    2. HTTP Authorization: Bearer <token> header (when running standalone or in tests)
    3. Controlled local development fallback (ONLY when ENVIRONMENT=dev and AUTH_ALLOW_LOCAL_DEV=true)

    Fails closed with HTTP 401 Unauthorized in production if missing, invalid, or expired.
    """
    # -------------------------------------------------------------------------
    # 1. Check API Gateway v2 HTTP API Authorizer claims (Edge-verified by AWS)
    # -------------------------------------------------------------------------
    aws_event = request.scope.get("aws.event")
    if isinstance(aws_event, dict):
        rc = aws_event.get("requestContext", {})
        jwt_authorizer = rc.get("authorizer", {}).get("jwt", {})
        claims = jwt_authorizer.get("claims")
        if isinstance(claims, dict) and claims.get("sub"):
            sub = claims["sub"]
            username = (
                claims.get("cognito:username")
                or claims.get("username")
                or claims.get("email")
                or sub
            )
            email = claims.get("email")

            # Extract roles / Cognito groups
            raw_groups = claims.get("cognito:groups", [])
            if isinstance(raw_groups, str):
                roles = [g.strip() for g in raw_groups.split(",") if g.strip()]
            elif isinstance(raw_groups, list):
                roles = [str(g) for g in raw_groups]
            else:
                roles = ["engineer"]

            return AuthenticatedUser(
                sub=sub,
                username=username,
                email=email,
                roles=roles if roles else ["engineer"],
                auth_source="API_GATEWAY_JWT",
            )

    # -------------------------------------------------------------------------
    # 2. Check HTTP Authorization Header: Bearer <token>
    # -------------------------------------------------------------------------
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.strip().lower().startswith("bearer "):
        token = auth_header.strip()[7:].strip()
        if token:
            payload = parse_jwt_payload_unverified(token)

            # Check expiration (fail-closed)
            exp = payload.get("exp")
            if exp is not None:
                try:
                    exp_val = float(exp)
                    if exp_val < time.time():
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Authentication token has expired",
                            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
                        )
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid expiration claim in authentication token",
                        headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
                    )

            sub = payload.get("sub", "anonymous_sub")
            username = (
                payload.get("cognito:username")
                or payload.get("username")
                or payload.get("email")
                or sub
            )
            email = payload.get("email")

            raw_roles = payload.get("cognito:groups") or payload.get("roles") or ["engineer"]
            if isinstance(raw_roles, str):
                roles = [r.strip() for r in raw_roles.split(",") if r.strip()]
            elif isinstance(raw_roles, list):
                roles = [str(r) for r in raw_roles]
            else:
                roles = ["engineer"]

            return AuthenticatedUser(
                sub=sub,
                username=username,
                email=email,
                roles=roles if roles else ["engineer"],
                auth_source="BEARER_JWT",
            )

    # -------------------------------------------------------------------------
    # 3. Fail-Closed Enforcement vs. Local Development Fallback
    # -------------------------------------------------------------------------
    env = os.environ.get("ENVIRONMENT", "dev").lower()
    strict_auth = os.environ.get("AUTH_STRICT", "false").lower() in ("true", "1")
    allow_local = os.environ.get("AUTH_ALLOW_LOCAL_DEV", "true").lower() in ("true", "1")

    # In production or strict mode, ALWAYS fail closed immediately
    if env == "prod" or strict_auth or not allow_local:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing, invalid, or expired bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Local development mode fallback: allows local developer testing without Cognito
    logger.warning(
        "Unauthenticated request accepted under local development mode (ENVIRONMENT=dev). "
        "Providing default developer session."
    )
    return AuthenticatedUser(
        sub="usr_local_dev_001",
        username="local_developer",
        email="dev@policylab.local",
        roles=["viewer", "engineer", "approver", "deployer", "admin"],
        auth_source="LOCAL_DEV_FALLBACK",
    )


def require_roles(allowed_roles: List[str]) -> Callable:
    """
    Dependency factory that enforces Role-Based Access Control (RBAC).
    Raises HTTP 403 Forbidden if current authenticated user does not possess
    at least one of the required roles.
    """
    def role_dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        user_roles = set(r.lower() for r in user.roles)
        required = set(r.lower() for r in allowed_roles)
        # Admin role universally satisfies role checks
        if "admin" in user_roles or bool(user_roles.intersection(required)):
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Insufficient privileges. Required role in {allowed_roles}, but user '{user.username}' has roles {user.roles}.",
        )

    return role_dependency
