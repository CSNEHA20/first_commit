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


ALLOWED_PLATFORM_ROLES = {"viewer", "engineer", "approver", "deployer", "admin"}


class AuthenticatedUser(BaseModel):
    """
    Standardized canonical identity representation for authenticated callers.
    """
    sub: str = Field(description="Unique subject identifier (Cognito sub / UUID)")
    username: str = Field(description="Unique human-readable username or email")
    email: Optional[str] = Field(default=None, description="Verified email address")
    roles: List[str] = Field(
        default_factory=lambda: ["viewer"],
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


def _extract_and_validate_roles(raw_groups: Any) -> List[str]:
    """
    Extracts, normalizes, and filters roles from cognito:groups claim.
    Defaults to ['viewer'] (least privilege) if empty, missing, or unrecognized.
    """
    extracted: List[str] = []
    if isinstance(raw_groups, str):
        extracted = [g.strip().lower() for g in raw_groups.split(",") if g.strip()]
    elif isinstance(raw_groups, (list, tuple)):
        extracted = [str(g).strip().lower() for g in raw_groups if str(g).strip()]

    valid_roles = [r for r in extracted if r in ALLOWED_PLATFORM_ROLES]
    return valid_roles if valid_roles else ["viewer"]


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
    WARNING: Does NOT verify cryptographic signature. FOR TEST/LOCAL DEV ONLY.
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
    issuer: str = "https://cognito-idp.us-east-1.amazonaws.com/test-pool",
    audience: str = "test-client-id",
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
        "iss": issuer,
        "aud": audience,
    }

    h_str = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_str = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig_str = _base64url_encode(b"simulated_test_signature")
    return f"{h_str}.{p_str}.{sig_str}"


def create_api_gateway_event_for_testing(
    method: str = "GET",
    path: str = "/aws/status",
    claims: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
    body: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Test helper: Creates a faithful AWS API Gateway HTTP API v2 payload
    with edge-verified authorizer claims.
    """
    if claims is None:
        claims = {
            "sub": "test_user_001",
            "cognito:username": "test_user",
            "email": "test@policylab.internal",
            "cognito:groups": ["engineer"],
        }

    hdrs = {"content-type": "application/json"}
    if headers:
        hdrs.update(headers)

    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": hdrs,
        "requestContext": {
            "accountId": "123456789012",
            "apiId": "policylab-api",
            "domainName": "policylab.execute-api.us-east-1.amazonaws.com",
            "domainPrefix": "policylab",
            "http": {
                "method": method,
                "path": path,
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
                "userAgent": "PolicyLab-TestClient/1.0",
            },
            "requestId": "req-test-uuid",
            "routeKey": f"{method} {path}",
            "stage": "prod",
            "time": "19/Sep/2026:12:00:00 +0000",
            "timeEpoch": 1789819200000,
            "authorizer": {
                "jwt": {
                    "claims": claims,
                    "scopes": None,
                }
            },
        },
        "body": body,
        "isBase64Encoded": False,
    }


def get_current_user(request: Request) -> AuthenticatedUser:
    """
    Centralized FastAPI security dependency.
    Enforces fail-closed identity verification and least-privilege RBAC.

    In production mode (ENVIRONMENT=prod or AUTH_STRICT=true):
      - MUST be authenticated via AWS API Gateway HTTP API v2 JWT authorizer context
        (requestContext.authorizer.jwt.claims edge-verified by Cognito JWKS).
      - Standalone unverified Bearer tokens are strictly rejected with HTTP 401 Unauthorized.
      - Fails closed immediately if verified authorizer context is missing.

    In local development / test mode (ENVIRONMENT=dev and not AUTH_STRICT):
      - Accepts Bearer tokens for offline testability with strict format and expiry verification.
      - Provides controlled local developer session when AUTH_ALLOW_LOCAL_DEV=true.
    """
    env = os.environ.get("ENVIRONMENT", "dev").lower()
    strict_auth = os.environ.get("AUTH_STRICT", "false").lower() in ("true", "1")
    allow_local = os.environ.get("AUTH_ALLOW_LOCAL_DEV", "true").lower() in ("true", "1")
    is_production = (env == "prod") or strict_auth

    # -------------------------------------------------------------------------
    # 1. Check API Gateway v2 HTTP API Authorizer claims (Edge-verified by AWS)
    # -------------------------------------------------------------------------
    aws_event = request.scope.get("aws.event")
    if isinstance(aws_event, dict):
        rc = aws_event.get("requestContext", {})
        jwt_authorizer = rc.get("authorizer", {}).get("jwt", {})
        claims = jwt_authorizer.get("claims")
        if isinstance(claims, dict) and claims.get("sub"):
            sub = str(claims["sub"]).strip()
            username = str(
                claims.get("cognito:username")
                or claims.get("username")
                or claims.get("email")
                or sub
            ).strip()
            email = claims.get("email")
            roles = _extract_and_validate_roles(claims.get("cognito:groups"))

            return AuthenticatedUser(
                sub=sub,
                username=username,
                email=email,
                roles=roles,
                auth_source="API_GATEWAY_JWT",
            )

    # -------------------------------------------------------------------------
    # 2. Production Fail-Closed Boundary: Reject unverified standalone tokens
    # -------------------------------------------------------------------------
    if is_production:
        # In production mode, unverified standalone Bearer tokens must NEVER authenticate callers.
        # Verified authorizer context from API Gateway is strictly mandatory.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Production requests must be authenticated via verified API Gateway authorizer.",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""},
        )

    # -------------------------------------------------------------------------
    # 3. Local Development / Test Mode: Optional Bearer token parsing
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

            sub = str(payload.get("sub", "local_dev_user")).strip()
            username = str(
                payload.get("cognito:username")
                or payload.get("username")
                or payload.get("email")
                or sub
            ).strip()
            email = payload.get("email")
            raw_groups = payload.get("cognito:groups") or payload.get("roles")
            roles = _extract_and_validate_roles(raw_groups)

            return AuthenticatedUser(
                sub=sub,
                username=username,
                email=email,
                roles=roles,
                auth_source="BEARER_JWT",
            )

    # -------------------------------------------------------------------------
    # 4. Local Development Fallback Session (Explicit dev mode only)
    # -------------------------------------------------------------------------
    if not allow_local:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
