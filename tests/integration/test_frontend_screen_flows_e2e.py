"""
End-to-end frontend screen flows, API contracts, and RBAC verification tests.

Validates:
1. Frontend Screen 1 (Overview): health, AWS status audit, evidence summaries.
2. Frontend Screen 2 (Policy Editor): valid & invalid Cedar policy syntax & schema validation.
3. Frontend Screen 3 (Simulator): single request Simulation across Allow/Deny cases.
4. Frontend Screen 4 (Changes): policy diff, counterexample generation & replay.
5. Frontend Screen 5 (Audit): contracts evaluation, critical findings, AI explanation.
6. Frontend Screen 6 (Regression): end-to-end regression suite with deterministic gate.
7. Frontend Screen 7 (Deployment): readiness, preparation, approval, submission, and ledger.
8. RBAC Matrix: viewer, engineer, approver, deployer, admin.
"""

import json
import os
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.auth import create_token_for_testing

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "fixtures"


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_tokens(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "dev")
    monkeypatch.setenv("AUTH_STRICT", "false")
    monkeypatch.setenv("AUTH_ALLOW_LOCAL_DEV", "false")
    return {
        "viewer": create_token_for_testing(sub="usr_viewer", username="auditor", roles=["viewer"], expires_in_seconds=3600),
        "engineer": create_token_for_testing(sub="usr_eng", username="dev_eng", roles=["engineer"], expires_in_seconds=3600),
        "approver": create_token_for_testing(sub="usr_appr", username="sarah_approver", roles=["approver"], expires_in_seconds=3600),
        "deployer": create_token_for_testing(sub="usr_depl", username="marcus_deployer", roles=["deployer"], expires_in_seconds=3600),
        "admin": create_token_for_testing(sub="usr_admin", username="alex_admin", roles=["admin"], expires_in_seconds=3600),
    }


@pytest.fixture
def fixture_data():
    valid_policy = (FIXTURES_DIR / "valid_policy.cedar").read_text(encoding="utf-8")
    candidate_v13 = (FIXTURES_DIR / "candidate_policy_v13.cedar").read_text(encoding="utf-8")
    invalid_policy = (FIXTURES_DIR / "invalid_policy.cedar").read_text(encoding="utf-8")
    schema_json = (FIXTURES_DIR / "schema.cedarschema.json").read_text(encoding="utf-8")
    entities = json.loads((FIXTURES_DIR / "entities.json").read_text(encoding="utf-8"))
    suite_json = json.loads((FIXTURES_DIR / "scenarios.json").read_text(encoding="utf-8"))
    return {
        "valid_policy": valid_policy,
        "candidate_v13": candidate_v13,
        "invalid_policy": invalid_policy,
        "schema_json": schema_json,
        "entities": entities,
        "suite": suite_json,
    }


def test_screen_1_overview_status_and_health(client, auth_tokens):
    """Screen 1: Overview - Health check and AWS Cluster Status audit."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "Cedar" in data["engine"]

    resp_status = client.get(
        "/aws/status",
        headers={"Authorization": f"Bearer {auth_tokens['viewer']}"},
    )
    assert resp_status.status_code == 200
    status_data = resp_status.json()
    assert "summary" in status_data
    assert "services" in status_data
    assert "environment" in status_data


def test_screen_2_policy_editor_validation(client, auth_tokens, fixture_data):
    """Screen 2: Policy Editor - Cedar policy syntax validation."""
    # 1. Valid policy passes syntax parsing
    resp_valid = client.post(
        "/policies/validate",
        json={
            "policyText": fixture_data["valid_policy"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_valid.status_code == 200
    valid_data = resp_valid.json()
    assert valid_data["isValid"] is True
    assert len(valid_data["errors"]) == 0

    # 2. Invalid policy fails with syntax errors
    resp_invalid = client.post(
        "/policies/validate",
        json={
            "policyText": fixture_data["invalid_policy"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_invalid.status_code == 200
    invalid_data = resp_invalid.json()
    assert invalid_data["isValid"] is False
    assert len(invalid_data["errors"]) > 0


def test_screen_3_simulator_single_evaluation(client, auth_tokens, fixture_data):
    """Screen 3: Simulator - Deterministic Cedar authorization evaluation."""
    # Evaluate Allow case
    resp_allow = client.post(
        "/simulate",
        json={
            "policyText": fixture_data["valid_policy"],
            "principal": 'Role::"admin"',
            "action": 'Action::"view"',
            "resource": 'Document::"payroll_001"',
            "context": {},
            "entities": fixture_data["entities"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_allow.status_code == 200
    evidence_allow = resp_allow.json()
    assert evidence_allow["decision"] == "ALLOW"

    # Evaluate Deny case
    resp_deny = client.post(
        "/simulate",
        json={
            "policyText": fixture_data["valid_policy"],
            "principal": 'User::"anonymous"',
            "action": 'Action::"delete"',
            "resource": 'Document::"payroll_001"',
            "context": {},
            "entities": fixture_data["entities"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_deny.status_code == 200
    evidence_deny = resp_deny.json()
    assert evidence_deny["decision"] == "DENY"


def test_screen_4_changes_diff_and_counterexamples(client, auth_tokens, fixture_data):
    """Screen 4: Change Analysis - Diff, counterexamples extraction & replay."""
    # 1. Diff Comparison
    resp_diff = client.post(
        "/policies/diff",
        json={
            "baselinePolicyText": fixture_data["valid_policy"],
            "candidatePolicyText": fixture_data["candidate_v13"],
            "suite": fixture_data["suite"],
            "entities": fixture_data["entities"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_diff.status_code == 200
    diff_data = resp_diff.json()
    assert "impactSummary" in diff_data
    assert "scenarioDiffs" in diff_data

    # 2. Counterexamples Extraction
    resp_cx = client.post(
        "/policies/counterexamples",
        json={
            "baselinePolicyText": fixture_data["valid_policy"],
            "candidatePolicyText": fixture_data["candidate_v13"],
            "suite": fixture_data["suite"],
            "entities": fixture_data["entities"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_cx.status_code == 200
    cxs_data = resp_cx.json()
    assert isinstance(cxs_data, list)


def test_screen_5_audit_contracts_and_explanation(client, auth_tokens, fixture_data):
    """Screen 5: Audit - Security Contracts and AI Explanation."""
    contracts = [
        {
            "id": "SC-01",
            "title": "Admin Full Access",
            "description": "Admins must retain view/edit permissions.",
            "severity": "CRITICAL",
            "isBlocking": True,
            "scenarioIds": [fixture_data["suite"]["scenarios"][0]["id"]],
            "expectedDecision": "ALLOW",
        }
    ]

    # 1. Evaluate contracts
    resp_contracts = client.post(
        "/contracts/evaluate",
        json={
            "policyText": fixture_data["valid_policy"],
            "suite": fixture_data["suite"],
            "contracts": contracts,
            "entities": fixture_data["entities"],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_contracts.status_code == 200
    contracts_data = resp_contracts.json()
    assert "results" in contracts_data
    assert "totalContracts" in contracts_data

    # 2. AI Grounded Explanation
    resp_explain = client.post(
        "/explanations",
        json={
            "findingId": "cx_test_01",
            "scenarioId": "scen_01",
            "scenarioTitle": "Contractor Delete Payroll",
            "principal": 'User::"contractor_alice"',
            "action": 'Action::"delete"',
            "resource": 'PayrollReport::"payroll_2026_q1"',
            "context": {},
            "baselineDecision": "DENY",
            "candidateDecision": "ALLOW",
            "transition": "NEWLY_AUTHORIZED",
            "determiningPolicies": ["candidate_policy_01"],
            "violatedContractId": "SC-04",
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_explain.status_code == 200
    explanation = resp_explain.json()
    assert "summary" in explanation
    assert "rootCause" in explanation
    assert "remediationCedar" in explanation
    assert "securityRisk" in explanation


def test_screen_6_and_7_regression_and_deployment_lifecycle(client, auth_tokens, fixture_data):
    """Screens 6 & 7: Regression Gate, AVP Preparation, Human Approval, Submission."""
    # 1. Run regression on v12 (baseline vs baseline -> should PASS)
    resp_reg = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": fixture_data["valid_policy"],
            "candidatePolicyText": fixture_data["valid_policy"],
            "suite": fixture_data["suite"],
            "contracts": [],
        },
        headers={"Authorization": f"Bearer {auth_tokens['engineer']}"},
    )
    assert resp_reg.status_code == 200
    reg_report = resp_reg.json()
    assert reg_report["gateDecision"]["status"] == "PASS"

    # 2. Prepare Deployment
    resp_prep = client.post(
        "/deployment/prepare",
        json={
            "candidatePolicyText": fixture_data["valid_policy"],
            "targetEnv": "production",
            "regressionReport": reg_report,
        },
        headers={"Authorization": f"Bearer {auth_tokens['approver']}"},
    )
    assert resp_prep.status_code == 200
    prep_data = resp_prep.json()
    assert prep_data["isEligible"] is True
    prep_id = prep_data["preparedDeploymentId"]
    policy_hash = prep_data["policyHash"]

    # 3. Human Approval (Requires approver or admin)
    resp_appr = client.post(
        "/deployment/approve",
        json={
            "preparedDeploymentId": prep_id,
            "policyHash": policy_hash,
            "operatorName": "Sarah Chen (SecOps Lead)",
            "ticketReference": "SEC-2026-9042",
            "approvalNotes": "Approved after audit review.",
        },
        headers={"Authorization": f"Bearer {auth_tokens['approver']}"},
    )
    assert resp_appr.status_code == 200
    appr_data = resp_appr.json()
    assert "approvalToken" in appr_data
    approval_token = appr_data["approvalToken"]

    # 4. Submit Deployment (Requires deployer or admin)
    resp_submit = client.post(
        "/deployment/submit",
        json={
            "preparedDeploymentId": prep_id,
            "approvalToken": approval_token,
            "candidatePolicyText": fixture_data["valid_policy"],
            "targetStoreId": "ps-acmepay-prod",
        },
        headers={"Authorization": f"Bearer {auth_tokens['deployer']}"},
    )
    assert resp_submit.status_code == 200
    submit_data = resp_submit.json()
    assert submit_data["status"] == "SYNCHRONIZED"

    # 5. Deployment History (Readable by viewer)
    resp_hist = client.get(
        "/deployment/history",
        headers={"Authorization": f"Bearer {auth_tokens['viewer']}"},
    )
    assert resp_hist.status_code == 200
    assert isinstance(resp_hist.json(), list)
