"""
Integration tests for PolicyLab Phase 4 REST API Endpoints
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
def candidate_v13_policy():
    with open(FIXTURES_DIR / "candidate_policy_v13.cedar", "r") as f:
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


def test_api_counterexamples_generation(
    valid_policy, candidate_v13_policy, entities, scenarios_suite_dict
):
    payload = {
        "baselinePolicyText": valid_policy,
        "candidatePolicyText": candidate_v13_policy,
        "entities": entities,
        "suite": scenarios_suite_dict,
        "baselineLabel": "v12",
        "candidateLabel": "v13",
    }
    response = client.post("/policies/counterexamples", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    cx_ids = [cx["scenarioId"] for cx in data]
    assert "sc_05" in cx_ids


def test_api_counterexample_replay(
    valid_policy, candidate_v13_policy, entities, scenarios_suite_dict
):
    # 1. Get counterexample
    diff_payload = {
        "baselinePolicyText": valid_policy,
        "candidatePolicyText": candidate_v13_policy,
        "entities": entities,
        "suite": scenarios_suite_dict,
    }
    cx_resp = client.post("/policies/counterexamples", json=diff_payload)
    assert cx_resp.status_code == 200
    counterexamples = cx_resp.json()
    cx_05 = next(cx for cx in counterexamples if cx["scenarioId"] == "sc_05")

    # 2. Replay
    replay_payload = {
        "counterexample": cx_05,
        "baselinePolicyText": valid_policy,
        "candidatePolicyText": candidate_v13_policy,
        "entities": entities,
    }
    replay_resp = client.post("/counterexamples/replay", json=replay_payload)
    assert replay_resp.status_code == 200
    res = replay_resp.json()
    assert res["isReproduced"] is True
    assert res["replayedBaselineDecision"] == "DENY"
    assert res["replayedCandidateDecision"] == "ALLOW"
    assert res["replayedTransition"] == "NEWLY_AUTHORIZED"


def test_api_contracts_evaluate(
    candidate_v13_policy, entities, scenarios_suite_dict, sample_contracts_dict
):
    payload = {
        "policyText": candidate_v13_policy,
        "entities": entities,
        "suite": scenarios_suite_dict,
        "contracts": sample_contracts_dict,
    }
    response = client.post("/contracts/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["totalContracts"] == 1
    assert data["failedContracts"] == 1
    assert data["allBlockingPassed"] is False


def test_api_policies_regression(
    valid_policy, candidate_v13_policy, entities, scenarios_suite_dict, sample_contracts_dict
):
    payload = {
        "baselinePolicyText": valid_policy,
        "candidatePolicyText": candidate_v13_policy,
        "entities": entities,
        "suite": scenarios_suite_dict,
        "contracts": sample_contracts_dict,
        "baselineLabel": "v12",
        "candidateLabel": "v13",
    }
    response = client.post("/policies/regression", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["gateDecision"]["status"] == "BLOCKED"
    assert data["gateDecision"]["isPassing"] is False
    assert len(data["counterexamples"]) == 2
    assert len(data["contractResults"]) == 1
    assert data["contractResults"][0]["status"] == "FAIL"


def test_all_previous_phase_endpoints_remain_functional(
    valid_policy, candidate_v13_policy, entities, scenarios_suite_dict
):
    # Phase 1: validate
    v_resp = client.post("/policies/validate", json={"policyText": valid_policy})
    assert v_resp.status_code == 200
    assert v_resp.json()["isValid"] is True

    # Phase 1: simulate
    s_resp = client.post(
        "/simulate",
        json={
            "principal": 'User::"admin_root"',
            "action": 'Action::"delete"',
            "resource": 'Invoice::"inv_001"',
            "policyText": valid_policy,
            "entities": entities,
        },
    )
    assert s_resp.status_code == 200
    assert s_resp.json()["decision"] == "ALLOW"

    # Phase 2: batch
    b_resp = client.post(
        "/simulate/batch",
        json={
            "policyText": valid_policy,
            "entities": entities,
            "suite": scenarios_suite_dict,
        },
    )
    assert b_resp.status_code == 200
    assert b_resp.json()["status"] == "COMPLETED"

    # Phase 3: diff
    d_resp = client.post(
        "/policies/diff",
        json={
            "baselinePolicyText": valid_policy,
            "candidatePolicyText": candidate_v13_policy,
            "entities": entities,
            "suite": scenarios_suite_dict,
        },
    )
    assert d_resp.status_code == 200
    assert d_resp.json()["impactSummary"]["newlyAuthorizedCount"] == 2
