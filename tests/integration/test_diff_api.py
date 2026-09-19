"""
Integration Tests for PolicyLab Policy Diff API (Phase 3)
Tests POST /policies/diff endpoint, error conditions, and verifies
Phase 1 and Phase 2 endpoints continue to function without regression.
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app

FIXTURES_DIR = Path(__file__).parents[2] / "fixtures"
client = TestClient(app)


@pytest.fixture
def baseline_policy_text() -> str:
    return (FIXTURES_DIR / "valid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture
def candidate_v13_policy_text() -> str:
    return (FIXTURES_DIR / "candidate_policy_v13.cedar").read_text(encoding="utf-8")


@pytest.fixture
def invalid_policy_text() -> str:
    return (FIXTURES_DIR / "invalid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture
def valid_entities() -> list:
    return json.loads((FIXTURES_DIR / "entities.json").read_text(encoding="utf-8"))


@pytest.fixture
def acmepay_suite_data() -> dict:
    return json.loads((FIXTURES_DIR / "scenarios.json").read_text(encoding="utf-8"))


def test_diff_api_success(
    baseline_policy_text: str,
    candidate_v13_policy_text: str,
    valid_entities: list,
    acmepay_suite_data: dict,
):
    """Verify POST /policies/diff returns 200 OK with accurate diff report and impact metrics."""
    payload = {
        "baselinePolicyText": baseline_policy_text,
        "candidatePolicyText": candidate_v13_policy_text,
        "entities": valid_entities,
        "suite": acmepay_suite_data,
        "baselineLabel": "AcmePay v12",
        "candidateLabel": "AcmePay v13",
    }

    response = client.post("/policies/diff", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["baselineLabel"] == "AcmePay v12"
    assert data["candidateLabel"] == "AcmePay v13"
    assert "reportId" in data
    assert "impactSummary" in data

    summary = data["impactSummary"]
    assert summary["totalScenariosDeclared"] == 11
    assert summary["totalScenariosCompared"] == 11
    assert summary["uncomparableScenariosCount"] == 0
    assert summary["newlyAuthorizedCount"] == 2
    assert summary["newlyForbiddenCount"] == 0
    assert summary["unchangedAllowCount"] == 6
    assert summary["unchangedDenyCount"] == 3
    assert summary["comparisonCoveragePct"] == 100.0
    assert summary["deltaPrincipals"] == 2
    assert summary["deltaActions"] == 1

    assert len(data["newlyAuthorizedScenarios"]) == 2
    assert len(data["newlyForbiddenScenarios"]) == 0
    assert len(data["scenarioDiffs"]) == 11


def test_diff_api_invalid_policy_returns_400(
    baseline_policy_text: str,
    invalid_policy_text: str,
    acmepay_suite_data: dict,
):
    """Verify POST /policies/diff with malformed policy syntax returns 400 Bad Request."""
    payload = {
        "baselinePolicyText": baseline_policy_text,
        "candidatePolicyText": invalid_policy_text,
        "suite": acmepay_suite_data,
    }

    response = client.post("/policies/diff", json=payload)
    assert response.status_code == 400
    assert "Candidate policy syntax error" in response.json()["detail"]


def test_diff_api_duplicate_scenarios_returns_422(
    baseline_policy_text: str,
    candidate_v13_policy_text: str,
):
    """Verify POST /policies/diff with duplicate scenario IDs in suite returns 422."""
    payload = {
        "baselinePolicyText": baseline_policy_text,
        "candidatePolicyText": candidate_v13_policy_text,
        "suite": {
            "id": "suite_dup",
            "name": "Duplicates Suite",
            "scenarios": [
                {
                    "id": "sc_dup",
                    "principal": 'User::"alice"',
                    "action": 'Action::"view"',
                    "resource": 'Invoice::"1"',
                },
                {
                    "id": "sc_dup",
                    "principal": 'User::"bob"',
                    "action": 'Action::"view"',
                    "resource": 'Invoice::"2"',
                },
            ],
        },
    }

    response = client.post("/policies/diff", json=payload)
    assert response.status_code == 422
    assert "Duplicate scenario identifier" in response.text


def test_all_phases_endpoints_remain_functional(
    baseline_policy_text: str, valid_entities: list, acmepay_suite_data: dict
):
    """Verify Phase 1, Phase 2, and Phase 3 endpoints are all simultaneously functional."""
    # 1. Health
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # 2. Validation
    res = client.post("/policies/validate", json={"policyText": baseline_policy_text})
    assert res.status_code == 200
    assert res.json()["isValid"] is True

    # 3. Single Simulation
    res = client.post(
        "/simulate",
        json={
            "principal": 'User::"admin_root"',
            "action": 'Action::"delete"',
            "resource": 'Invoice::"inv_001"',
            "policyText": baseline_policy_text,
            "entities": valid_entities,
        },
    )
    assert res.status_code == 200
    assert res.json()["decision"] == "ALLOW"

    # 4. Batch Simulation
    res = client.post(
        "/simulate/batch",
        json={
            "policyText": baseline_policy_text,
            "entities": valid_entities,
            "suite": acmepay_suite_data,
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"
    assert res.json()["totalScenarios"] == 11
