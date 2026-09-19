"""
Unit and integration tests for PolicyLab production authentication and authorization (AuthN/AuthZ).
Exhaustive security audit regression tests covering:
- JWT trust boundaries and fail-closed production enforcement
- API Gateway edge claims provenance vs unverified Bearer tokens
- Least-privilege role assignment and defense against privilege escalation
- Route-by-route authorization matrix enforcement
- Separation of human approval tokens and deployer identity
"""

import json
import os
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException

from backend.main import app
from backend.lambda_handler import handler
from backend.core.auth import (
    AuthenticatedUser,
    get_current_user,
    require_roles,
    create_token_for_testing,
    create_api_gateway_event_for_testing,
    parse_jwt_payload_unverified,
    _extract_and_validate_roles,
)
from backend.domain.models.regression import (
    DeploymentGateStatus,
    RegressionReport,
    RegressionGateDecision,
)
from backend.domain.models.diff import PolicyDiffReport, BoundedImpactSummary


def _create_dummy_passing_report() -> RegressionReport:
    return RegressionReport(
        runId="reg_pass_auth_001",
        timestamp="2026-09-19T08:00:00Z",
        baselineLabel="v12",
        candidateLabel="v13",
        diffReport=PolicyDiffReport(
            reportId="diff_auth_001",
            timestamp="2026-09-19T08:00:00Z",
            baselineLabel="v12",
            candidateLabel="v13",
            impactSummary=BoundedImpactSummary(
                totalScenariosDeclared=1,
                totalScenariosCompared=1,
                uncomparableScenariosCount=0,
                unchangedAllowCount=1,
                unchangedDenyCount=0,
                newlyForbiddenCount=0,
                newlyAuthorizedCount=0,
                baselineExecutionErrorsCount=0,
                candidateExecutionErrorsCount=0,
                comparisonCoveragePct=100.0,
                newlyForbiddenRatePct=0.0,
                newlyAuthorizedRatePct=0.0,
                unchangedRatePct=100.0,
                deltaPrincipals=0,
                deltaActions=0,
                deltaResources=0,
            ),
            scenarioDiffs=[],
            newlyAuthorizedScenarios=[],
            newlyForbiddenScenarios=[],
        ),
        counterexamples=[],
        contractResults=[],
        gateDecision=RegressionGateDecision(
            status=DeploymentGateStatus.PASS,
            isPassing=True,
            reasons=["All security contracts satisfied with 0 blocking regressions."],
        ),
    )


@pytest.fixture
def client():
    return TestClient(app)


# =========================================================================
# 1. AuthenticatedUser Model & Least-Privilege Role Validation
# =========================================================================

def test_authenticated_user_model():
    user = AuthenticatedUser(
        sub="sub_123",
        username="secops_lead",
        email="secops@example.com",
        roles=["approver", "engineer"],
        auth_source="API_GATEWAY_JWT",
    )
    assert user.is_authenticated is True
    assert user.has_role("approver") is True
    assert user.has_role("admin") is False
    assert user.has_any_role(["admin", "approver"]) is True
    assert user.has_any_role(["deployer"]) is False


def test_authenticated_user_model_defaults_to_viewer():
    """Principle of Least Privilege: default role must be viewer, not engineer."""
    user = AuthenticatedUser(sub="sub_default", username="default_user")
    assert user.roles == ["viewer"]
    assert user.has_role("viewer") is True
    assert user.has_role("engineer") is False


def test_extract_and_validate_roles_normalization_and_filtering():
    """Verify that roles are extracted, lowercased, and filtered against known allowed roles."""
    assert _extract_and_validate_roles("Approver, ENGINEER") == ["approver", "engineer"]
    assert _extract_and_validate_roles(["ADMIN", "deployer"]) == ["admin", "deployer"]
    assert _extract_and_validate_roles(["superadmin", "hacker"]) == ["viewer"]
    assert _extract_and_validate_roles([]) == ["viewer"]
    assert _extract_and_validate_roles(None) == ["viewer"]


# =========================================================================
# 2. Production Fail-Closed JWT Trust & API Gateway Verification
# =========================================================================

def test_unverified_bearer_token_rejected_in_production_mode(monkeypatch):
    """
    CRITICAL INVARIANT (Defect C-1 Regression):
    In production mode (ENVIRONMENT=prod or AUTH_STRICT=true), unverified standalone
    Bearer tokens must NEVER authenticate callers. The backend must fail closed (HTTP 401).
    """
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    token = create_token_for_testing(
        sub="attacker_001",
        username="attacker",
        roles=["admin"],  # Forged admin role in unverified JWT
        expires_in_seconds=3600,
    )

    class MockRequest:
        headers = {"Authorization": f"Bearer {token}"}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())

    assert exc_info.value.status_code == 401
    assert "Production requests must be authenticated via verified API Gateway authorizer" in exc_info.value.detail


def test_missing_credentials_in_production_mode_raises_401(monkeypatch):
    """Requests without credentials in production mode must fail closed with 401."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    class MockRequest:
        headers = {}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())

    assert exc_info.value.status_code == 401


def test_api_gateway_claims_extraction_in_production_mode(monkeypatch):
    """
    Edge-verified claims from API Gateway (requestContext.authorizer.jwt.claims)
    must successfully authenticate the user in production mode.
    """
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    class MockRequest:
        headers = {}
        scope = {
            "aws.event": {
                "requestContext": {
                    "authorizer": {
                        "jwt": {
                            "claims": {
                                "sub": "cognito_sub_101",
                                "cognito:username": "sarah_approver",
                                "email": "sarah@acmepay.internal",
                                "cognito:groups": ["approver"],
                            }
                        }
                    }
                }
            }
        }

    user = get_current_user(request=MockRequest())
    assert user.is_authenticated is True
    assert user.sub == "cognito_sub_101"
    assert user.username == "sarah_approver"
    assert user.email == "sarah@acmepay.internal"
    assert user.roles == ["approver"]
    assert user.auth_source == "API_GATEWAY_JWT"


def test_api_gateway_claims_without_groups_defaults_to_viewer(monkeypatch):
    """Users authenticated via API Gateway without groups safely default to viewer."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    class MockRequest:
        headers = {}
        scope = {
            "aws.event": {
                "requestContext": {
                    "authorizer": {
                        "jwt": {
                            "claims": {
                                "sub": "cognito_sub_new_user",
                                "cognito:username": "new_user",
                                "email": "new@acmepay.internal",
                                # Missing cognito:groups
                            }
                        }
                    }
                }
            }
        }

    user = get_current_user(request=MockRequest())
    assert user.is_authenticated is True
    assert user.roles == ["viewer"]
    assert user.has_role("viewer") is True
    assert user.has_role("engineer") is False
    assert user.has_role("admin") is False


# =========================================================================
# 3. Local Development Mode (Offline Development Continuity)
# =========================================================================

def test_local_dev_token_accepted_in_dev_mode(monkeypatch):
    """In local dev mode (ENVIRONMENT=dev, AUTH_STRICT=false), local bearer tokens are parsed."""
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "true")

    token = create_token_for_testing(
        sub="usr_local_01",
        username="dev_engineer",
        roles=["engineer"],
        expires_in_seconds=600,
    )

    class MockRequest:
        headers = {"Authorization": f"Bearer {token}"}
        scope = {}

    user = get_current_user(request=MockRequest())
    assert user.is_authenticated is True
    assert user.username == "dev_engineer"
    assert user.roles == ["engineer"]
    assert user.auth_source == "BEARER_JWT"


def test_expired_token_rejected_in_dev_mode(monkeypatch):
    """Expired tokens fail closed with 401 even in local dev mode."""
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "true")

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


def test_malformed_token_rejected_in_dev_mode(monkeypatch):
    """Malformed tokens fail closed with 401 in dev mode."""
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "true")

    class MockRequest:
        headers = {"Authorization": "Bearer not.a.valid.jwt"}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())
    assert exc_info.value.status_code == 401


def test_local_dev_fallback_session_when_no_token(monkeypatch):
    """When no token is provided in dev mode with AUTH_ALLOW_LOCAL_DEV=true, default dev session is provided."""
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "true")

    class MockRequest:
        headers = {}
        scope = {}

    user = get_current_user(request=MockRequest())
    assert user.is_authenticated is True
    assert user.auth_source == "LOCAL_DEV_FALLBACK"
    assert user.username == "local_developer"


def test_missing_token_in_dev_without_fallback_raises_401(monkeypatch):
    """If AUTH_ALLOW_LOCAL_DEV=false in dev mode, missing token raises 401."""
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "false")

    class MockRequest:
        headers = {}
        scope = {}

    with pytest.raises(HTTPException) as exc_info:
        get_current_user(request=MockRequest())
    assert exc_info.value.status_code == 401


# =========================================================================
# 4. RBAC Dependency Enforcement
# =========================================================================

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


def test_admin_role_universally_satisfies_all_role_checks():
    user = AuthenticatedUser(sub="3", username="admin_u", roles=["admin"])
    for required in [["approver"], ["deployer"], ["engineer"], ["viewer"]]:
        checker = require_roles(required)
        assert checker(user) == user


# =========================================================================
# 5. Route-Level RBAC & Identity Provenance Enforcement
# =========================================================================

def test_health_endpoint_is_always_public_in_production(client, monkeypatch):
    """Public health check must return HTTP 200 without authentication even in production."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_all_sensitive_routes_reject_unauthenticated_requests_in_production(client, monkeypatch):
    """Verify that sensitive routes fail closed (HTTP 401) without authentication in production."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    routes_to_test = [
        ("GET", "/aws/status"),
        ("GET", "/deployment/readiness"),
        ("GET", "/deployment/history"),
        ("POST", "/policies/validate"),
        ("POST", "/simulate"),
        ("POST", "/simulate/batch"),
        ("POST", "/policies/diff"),
        ("POST", "/policies/counterexamples"),
        ("POST", "/counterexamples/replay"),
        ("POST", "/contracts/evaluate"),
        ("POST", "/policies/regression"),
        ("POST", "/explanations"),
        ("POST", "/deployment/prepare"),
        ("POST", "/deployment/approve"),
        ("POST", "/deployment/submit"),
        ("POST", "/validate-inputs"),
        ("POST", "/policies/generate"),
        ("POST", "/audits/agent-run"),
        ("POST", "/audits/export"),
        ("POST", "/matrix/evaluate"),
        ("POST", "/simulator/what-if"),
        ("GET", "/policies/set_1/timeline"),
        ("POST", "/policies/set_1/versions"),
        ("POST", "/entity-snapshots"),
        ("GET", "/entity-snapshots/snap_1"),
    ]

    for method, path in routes_to_test:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"Route {method} {path} must reject unauthenticated requests in production, got {res.status_code}"


def test_viewer_role_blocked_from_privileged_mutations(client, monkeypatch):
    """
    CRITICAL INVARIANT (Defect H-2 Regression):
    Read-only viewer role must receive HTTP 403 Forbidden on privileged mutation routes:
    - /deployment/approve
    - /deployment/submit
    - /deployment/prepare
    - /policies/{set_id}/versions
    - /entity-snapshots
    - /policies/generate
    """
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "false")

    viewer_token = create_token_for_testing(
        sub="usr_viewer",
        username="auditor_viewer",
        roles=["viewer"],
        expires_in_seconds=300,
    )
    headers = {"Authorization": f"Bearer {viewer_token}"}

    # 1. /deployment/prepare
    dummy_reg = _create_dummy_passing_report()
    res_prep = client.post(
        "/deployment/prepare",
        json={"candidatePolicyText": "permit(principal, action, resource);", "regressionReport": dummy_reg.model_dump()},
        headers=headers,
    )
    assert res_prep.status_code == 403, f"Viewer must be blocked from /deployment/prepare, got {res_prep.status_code}"

    # 2. /deployment/approve
    res_appr = client.post(
        "/deployment/approve",
        json={"policyHash": "0" * 64},
        headers=headers,
    )
    assert res_appr.status_code == 403

    # 3. /deployment/submit
    res_sub = client.post(
        "/deployment/submit",
        json={"candidatePolicyText": "permit(principal, action, resource);", "approvalToken": "fake_token"},
        headers=headers,
    )
    assert res_sub.status_code == 403

    # 4. /policies/{set_id}/versions
    res_ver = client.post(
        "/policies/set_acme/versions",
        json={"versionTag": "v14", "policyText": "permit(principal, action, resource);", "author": "me", "changeSummary": "test"},
        headers=headers,
    )
    assert res_ver.status_code == 403

    # 5. /entity-snapshots
    res_snap = client.post(
        "/entity-snapshots",
        json={"snapshotId": "snap_unauth"},
        headers=headers,
    )
    assert res_snap.status_code == 403

    # 6. /policies/generate
    res_gen = client.post(
        "/policies/generate",
        json={"requirements": "Permit finance manager to approve invoices"},
        headers=headers,
    )
    assert res_gen.status_code == 403


def test_approver_identity_bound_to_authenticated_caller_when_unspecified(client, monkeypatch):
    """
    Verifies that when approverName is omitted in request payload, it is automatically
    bound to the authenticated caller's identity (current_user.username).
    """
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "false")

    approver_token = create_token_for_testing(
        sub="usr_approver_real",
        username="real_approver_alice",
        roles=["approver"],
        expires_in_seconds=300,
    )
    headers = {"Authorization": f"Bearer {approver_token}"}

    # Prepare deployment first with engineer/approver role
    dummy_reg = _create_dummy_passing_report()
    prep_res = client.post(
        "/deployment/prepare",
        json={"candidatePolicyText": "permit(principal == User::\"alice\", action, resource);", "regressionReport": dummy_reg.model_dump()},
        headers=headers,
    )
    assert prep_res.status_code == 200
    prep_data = prep_res.json()

    # Approve without specifying approverName
    appr_res = client.post(
        "/deployment/approve",
        json={
            "preparedDeploymentId": prep_data["preparedDeploymentId"],
            "policyHash": prep_data["policyHash"],
            "ticketReference": "SEC-GENUINE-001",
        },
        headers=headers,
    )
    assert appr_res.status_code == 200
    approval_data = appr_res.json()
    assert approval_data["approvedBy"] == "real_approver_alice"


def test_separation_of_approval_token_and_deployer_authentication(client, monkeypatch):
    """
    CRITICAL INVARIANT (Check 3 & Defect H-3 Regression):
    1. Caller must authenticate with deployer or admin role.
    2. Approval token cannot replace caller authentication (unauthenticated -> 401).
    3. Non-deployer caller cannot submit deployment even with valid approval token (-> 403).
    4. Deployer without approval token fails (-> 400).
    5. Authentic deployer identity is recorded in the deployment ledger.
    """
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "false")

    candidate_policy = 'permit(principal == Role::"admin", action, resource);'

    # Step A: Approver creates approval
    approver_token = create_token_for_testing(
        sub="usr_approver_bob",
        username="bob_approver",
        roles=["approver"],
    )
    dummy_reg = _create_dummy_passing_report()
    prep_res = client.post(
        "/deployment/prepare",
        json={"candidatePolicyText": candidate_policy, "regressionReport": dummy_reg.model_dump()},
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    prep_data = prep_res.json()

    appr_res = client.post(
        "/deployment/approve",
        json={"preparedDeploymentId": prep_data["preparedDeploymentId"], "policyHash": prep_data["policyHash"]},
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    approval_token = appr_res.json()["approvalToken"]

    # Test 1: Unauthenticated request with valid approval token -> 401
    res_unauth = client.post(
        "/deployment/submit",
        json={"candidatePolicyText": candidate_policy, "approvalToken": approval_token},
    )
    assert res_unauth.status_code == 401

    # Test 2: Approver (who does NOT have deployer role) with valid approval token -> 403
    res_approver_try = client.post(
        "/deployment/submit",
        json={"candidatePolicyText": candidate_policy, "approvalToken": approval_token},
        headers={"Authorization": f"Bearer {approver_token}"},
    )
    assert res_approver_try.status_code == 403

    # Test 3: Deployer with missing approval token -> 400
    deployer_token = create_token_for_testing(
        sub="usr_deployer_carol",
        username="carol_deployer",
        roles=["deployer"],
    )
    res_no_tok = client.post(
        "/deployment/submit",
        json={"candidatePolicyText": candidate_policy, "approvalToken": None},
        headers={"Authorization": f"Bearer {deployer_token}"},
    )
    assert res_no_tok.status_code == 400

    # Test 4: Deployer with valid approval token -> 200 & recorded deployedBy
    res_success = client.post(
        "/deployment/submit",
        json={"candidatePolicyText": candidate_policy, "approvalToken": approval_token},
        headers={"Authorization": f"Bearer {deployer_token}"},
    )
    assert res_success.status_code == 200
    submit_data = res_success.json()
    assert submit_data["deployedBy"] == "carol_deployer"


# =========================================================================
# 6. Lambda Handler Dual-Dispatch & API Gateway Integration
# =========================================================================

def test_lambda_handler_api_gateway_event_authorized(monkeypatch):
    """Verifies that API Gateway HTTP event with verified claims succeeds through Lambda handler."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    event = create_api_gateway_event_for_testing(
        method="GET",
        path="/aws/status",
        claims={
            "sub": "cognito_sub_live_01",
            "cognito:username": "live_ops",
            "email": "ops@acmepay.internal",
            "cognito:groups": ["engineer"],
        },
    )
    res = handler(event, None)
    assert res["statusCode"] == 200
    body = json.loads(res["body"])
    assert "environment" in body


def test_lambda_handler_api_gateway_event_unauthenticated_in_prod(monkeypatch):
    """Verifies that API Gateway HTTP event without claims fails closed (HTTP 401) through Lambda."""
    monkeypatch.setenv("ENVIRONMENT", "prod")
    monkeypatch.setenv("AUTH_STRICT", "true")

    event = {
        "version": "2.0",
        "routeKey": "GET /aws/status",
        "rawPath": "/aws/status",
        "rawQueryString": "",
        "headers": {"content-type": "application/json"},
        "requestContext": {
            "accountId": "123456789012",
            "apiId": "policylab-api",
            "domainName": "policylab.execute-api.us-east-1.amazonaws.com",
            "domainPrefix": "policylab",
            "http": {
                "method": "GET",
                "path": "/aws/status",
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
            },
            "requestId": "req-unauth",
            "routeKey": "GET /aws/status",
            "stage": "prod",
            # No authorizer.jwt.claims
        },
        "isBase64Encoded": False,
    }
    res = handler(event, None)
    assert res["statusCode"] == 401


# =========================================================================
# 7. SAM Infrastructure Template Invariant Verification
# =========================================================================

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
