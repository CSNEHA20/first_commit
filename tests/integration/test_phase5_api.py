"""
Integration tests for PolicyLab Phase 5 REST API Endpoints
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def valid_policy():
    with open(FIXTURES_DIR / "valid_policy.cedar", "r") as f:
        return f.read()


@pytest.fixture
def candidate_v13_fixed_policy():
    with open(FIXTURES_DIR / "candidate_policy_v13_fixed.cedar", "r") as f:
        return f.read()


@pytest.fixture
def entities():
    with open(FIXTURES_DIR / "entities.json", "r") as f:
        return json.load(f)


@pytest.fixture
def scenarios_suite_dict():
    with open(FIXTURES_DIR / "scenarios.json", "r") as f:
        return json.load(f)


@pytest.fixture
def sample_contracts_dict():
    return [
        {
            "id": "SC-03",
            "title": "Editor Invoice Deletion Prohibited",
            "description": "Editors must never delete invoices",
            "severity": "CRITICAL",
            "isBlocking": True,
            "contractType": "INVARIANT_DENIED",
            "scenarioIds": ["sc_05"],
            "expectedDecision": "DENY",
        }
    ]


def test_api_generate_explanation():
    payload = {
        "findingId": "cx_sc_05",
        "scenarioId": "sc_05",
        "scenarioTitle": "Editor cannot delete invoices",
        "principal": 'User::"editor_bob"',
        "action": 'Action::"delete"',
        "resource": 'Invoice::"inv_9082"',
        "baselineDecision": "DENY",
        "candidateDecision": "ALLOW",
        "transition": "NEWLY_AUTHORIZED",
        "determiningPolicies": ["policy_editor_all_actions"],
        "violatedContractId": "SC-03",
    }
    response = client.post("/explanations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["findingId"] == "cx_sc_05"
    assert "DENY to ALLOW" in data["summary"]
    assert "SC-03" in data["evidenceReferences"]


def test_api_deployment_readiness():
    response = client.get("/deployment/readiness?region=us-east-1&store_id=ps-acmepay-prod")
    assert response.status_code == 200
    data = response.json()
    assert data["isConfigured"] is True
    assert data["targetStoreId"] == "ps-acmepay-prod"


def test_api_full_deployment_workflow(
    valid_policy, candidate_v13_fixed_policy, entities, scenarios_suite_dict, sample_contracts_dict
):
    # 1. Run regression on conforming policy -> Gate is PASS
    reg_resp = client.post(
        "/policies/regression",
        json={
            "baselinePolicyText": valid_policy,
            "candidatePolicyText": candidate_v13_fixed_policy,
            "entities": entities,
            "suite": scenarios_suite_dict,
            "contracts": sample_contracts_dict,
        },
    )
    assert reg_resp.status_code == 200
    reg_report = reg_resp.json()
    assert reg_report["gateDecision"]["status"] == "PASS"

    # 2. Prepare deployment
    prep_resp = client.post(
        "/deployment/prepare",
        json={
            "candidatePolicyText": candidate_v13_fixed_policy,
            "targetStoreId": "ps-acmepay-prod",
            "environment": "production",
            "regressionReport": reg_report,
        },
    )
    assert prep_resp.status_code == 200
    prep_data = prep_resp.json()
    assert prep_data["isEligible"] is True
    assert prep_data["gateStatus"] == "PASS"
    prepared_id = prep_data["preparedDeploymentId"]
    policy_hash = prep_data["policyHash"]

    # 3. Register human operator approval
    appr_resp = client.post(
        "/deployment/approve",
        json={
            "preparedDeploymentId": prepared_id,
            "policyHash": policy_hash,
            "regressionRunId": reg_report["runId"],
            "operatorName": "Vishal",
            "approvalNotes": "Passed all security invariant checks",
        },
    )
    assert appr_resp.status_code == 200
    appr_data = appr_resp.json()
    assert appr_data["status"] == "APPROVED"
    approval_id = appr_data["approvalId"]

    # 4. Submit deployment
    submit_resp = client.post(
        "/deployment/submit",
        json={
            "preparedDeploymentId": prepared_id,
            "approvalId": approval_id,
            "candidatePolicyText": candidate_v13_fixed_policy,
            "targetStoreId": "ps-acmepay-prod",
            "environment": "production",
        },
    )
    assert submit_resp.status_code == 200
    submit_data = submit_resp.json()
    assert submit_data["status"] == "SYNCHRONIZED"
    assert "avp-sync-proof" in submit_data["verificationProof"]

    # 5. Check deployment history
    hist_resp = client.get("/deployment/history")
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert len(hist_data) >= 2
    assert hist_data[0]["id"] == submit_data["deploymentId"]
