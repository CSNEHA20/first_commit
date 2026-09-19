"""
Unit and integration tests for PolicyLab production authentication and authorization (AuthN/AuthZ).
 """

import os
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from backend.main import app
from backend.core.auth import (
    AuthenticatedUser,
    get_current_user,
    require_roles,
    create_token_for_testing,
)


@pytest.fixture
def client():
    return TestClient(app)


# =========================================================================
# 1. AuthenticatedUser Model & Role Checks
# =========================================================================

def test_authenticated_user_model():
    user = AuthenticatedUser(
        sub="sub_123",
        username="secops_lead",
        email="secops@example.com",
        roles=["approver", "engineer"],
        auth_source="COGNITO",
    )
    assert user.is_authenticated is True
    assert user.has_role("approver") is True
    assert user.has_role("admin") is False
    assert user.has_any_role(["admin", "approver"]) is True
    assert user.has_any_role(["deployer"]) is False


# ==========================================================================
# 2. Token Generation, Expiry & Claims Decoding
# =========================================================================

def test_create_and_decode_valid_token(monkeypatch):
    monkeypatch.setenv("AUTH_STRICT", "true")
    token = create_token_for_testing(
        sub="usr_test_01",
        username="test_user",
        email="test@example.com",
        roles=["approver"],
        expires_in_seconds=300,
    )
    assert isinstance(token, str)
    assert token.count(".") == 2


def test_expired_token_rejected_in_strict_mode(monkeypatch):
    monkeypatch.setenv("AUTH_STRICT", "true")
    expired_token = create_token_for_testing(
        sub="usr_expired",
        username="expired_user",
        roles=["approver"],
        expires_in_seconds=-10,
    )

    class MockRequest:
        headers = {"Authorization": f"Bearer {expired_token}"}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_malformed_token_rejected_in_strict_mode(monkeypatch):
    monkeypatch.setenv("AUTH_STRICT", "true")

    class MockRequest:
        headers = {"Authorization": "Bearer invalid.token.payload"}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())
    assert exc_info.value.status_code == 401
    assert "malformed" in exc_info.value.detail.lower() or "invalid" in exc_info.value.detail.lower()


def test_missing_token_in_strict_mode_raises_401(monkeypatch):
    monkeypatch.setenv("AUTH_STRICT", "true")

    class MockRequest:
        headers = {}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())
    assert exc_info.value.status_code == 401
    assert "Authentication required" in exc_info.value.detail


def test_local_dev_fallback_mode_when_not_strict(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "true")

    class MockRequest:
        headers = {}
        scope = {}

    user = get_current_user(request=MockRequest())
    assert user.is_authenticated is True
    assert user.auth_source == "LOCAL_DEV_FALLBACK"
    assert user.has_role("approver") is True


# =========================================================================
# 3. Edge Authorizer (API Gateway / Mangum) Claims Extraction
# ========================================================================

def test_api_gateway_claims_extraction():
    class MockRequest:
        headers = {}
        scope = {
            "aws.event": {
                "requestContext": {
                    "authorizer": {
                        "jwt": {
                            "claims": {
                                "sub": "cognito_sub_999",
                                "cognito:username": "alice_admin",
                                "email": "alice@acmepay.internal",
                                "cognito:groups": ["admin", "approver"],
                            }
                        }
                    }
                }
            }
        }

    user = get_current_user(request=MockRequest())
    assert user.is_authenticated is True
    assert user.sub == "cognito_sub_999"
    assert user.username == "alice_admin"
    assert user.email == "alice@acmepay.internal"
    assert user.auth_source == "API_GATEWAY_JWT"
    assert user.has_role("admin") is True


# =========================================================================
# 4. RBAC Dependency Enforcement
# =======================================================================

def test_require_roles_allows_matching_role():
    checker = require_roles(["admin", "approver"])
    user = AuthenticatedUser(sub="1", username="u", roles=["approver"])
    result = checker(user)
    assert result == user


def test_require_roles_forbids_unauthorized_role():
    checker = require_roles(["admin", "approver"])
    user = AuthenticatedUser(sub="2", username="u2", roles=["viewer"])
    with pytest.raises(HTTPException) as exc_info:
        checker(user)
    assert exc_info.value.status_code == 403
    assert "Insufficient privileges" in exc_info.value.detail


# ========================================================================
# 5. Route Integration Tests with FastAPI TestClient
# =======================================================================

def test_health_endpoint_is_always_public_without_auth(client, monkeypatch):
    """Public health check must succeed (HTTP 200) even when AUTH_STRICT is enabled."""
    monkeypatch.setenv("AUTH_STRICT", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_protected_route_fails_without_credentials_in_strict_mode(client, monkeypatch):
    monkeypatch.setenv("AUTH_STRICT", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")

    response = client.get("/aws/status")
    assert response.status_code == 401
    assert "Authentication required" in response.json()["detail"]


def test_protected_route_succeeds_with_valid_token(client, monkeypatch):
    monkeypatch.setenv("AUTH_STRICT", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")

    token = create_token_for_testing(
        sub="usr_valid",
        username="valid_user",
        roles=["engineer"],
        expires_in_seconds=300,
    )
    response = client.get("/aws/status", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_deployment_approve_rbac_blocks_unauthorized_roles(client, monkeypatch):
    """Only users with approver or admin role may call /deployment/approve."""
    monkeypatch.setenv("AUTH_STRICT", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")

    # Engineer role does NOT have approval rights
    engineer_token = create_token_for_testing(
        sub="usr_eng",
        username="engineer_bob",
        roles=["engineer"],
        expires_in_seconds=300,
    )
    response = client.post(
        "/deployment/approve",
        json={
            "preparationId": "prep_test_001",
            "approver": "engineer_bob",
            "policyHash": "0" * 64,
            "comment": "Unauthorized attempt",
        },
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert response.status_code == 403
    assert "Insufficient privileges" in response.json()["detail"]


def test_deployment_submit_rbac_blocks_unauthorized_roles(client, monkeypatch):
    """Only users with deployer or admin role may call /deployment/submit."""
    monkeypatch.setenv("AUTH_STRICT", "true")
    monkeypatch.setenv("ENVIRONMENT", "prod")

    # Viewer role does not have deploy rights
    viewer_token = create_token_for_testing(
        sub="usr_viewer",
        username="viewer_carol",
        roles=["viewer"],
        expires_in_seconds=300,
    )
    response = client.post(
        "/deployment/submit",
        json={
            "preparationId": "prep_test_002",
            "approvalToken": "token_mock",
            "policyStoreId": "ps-1",
            "candidatePolicies": "permit(principal, action, resource);",
        },
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert response.status_code == 403
    assert "Insufficient privileges" in response.json()["detail"]


# ========================================================================
# 6. SAM Infrastructure Template Verification
# ========================================================================

def test_sam_template_auth_invariants():
    """Inspects template.yaml text to verify Cognito User Pool and Authorizer definitions."""
    repo_root = Path(__file__).resolve().parents[2]
    template_path = repo_root / "infrastructure" / "template.yaml"
    assert template_path.exists(), "infrastructure/template.yaml must exist"

    content = template_path.read_text(encoding="utf-8")

    assert "Type: AWS::Cognito::UserPool" in content
    assert "PolicyLabUserPool:" in content
    assert "Type: AWS::Cognito::UserPoolClient" in content
    assert "PolicyLabUserPoolClient:" in content

    assert "CognitoJwtAuthorizer:" in content
    assert "DefaultAuthorizer: CognitoJwtAuthorizer" in content
    assert "issuer:" in content
    assert "audience:" in content

    assert "Authorizer: NONE" in content
    assert "ApiHealth:" in content

    assert "UserPoolId:" in content
    assert "UserPoolClientId:" in content
