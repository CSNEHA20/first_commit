"""
Integration Tests for PolicyLab Batch Simulation API (Phase 2)
Tests POST /simulate/batch endpoint, input validations, error scenarios,
and verifies Phase 1 endpoints (/health, /policies/validate, /simulate) remain functional.
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.domain.models.authz import AuthorizationDecision

FIXTURES_DIR = Path(__file__).parents[2] / "fixtures"
client = TestClient(app)


@pytest.fixture
def valid_policy_text() -> str:
    return (FIXTURES_DIR / "valid_policy.cedar").read_text(encoding="utf-8")


@pytest.fixture
def valid_entities() -> list:
    return json.loads((FIXTURES_DIR / "entities.json").read_text(encoding="utf-8"))


@pytest.fixture
def acmepay_suite_data() -> dict:
    return json.loads((FIXTURES_DIR / "scenarios.json").read_text(encoding="utf-8"))


def test_batch_api_success(
    valid_policy_text: str, valid_entities: list, acmepay_suite_data: dict
):
    """Verify POST /simulate/batch successfully returns 200 OK with full matrix and accurate counts."""
    payload = {
        "policyText": valid_policy_text,
        "entities": valid_entities,
        "suite": acmepay_suite_data,
    }

    response = client.post("/simulate/batch", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["suiteId"] == "suite_acmepay_core"
    assert data["status"] == "COMPLETED"
    assert data["totalScenarios"] == 11
    assert data["successCount"] == 11
    assert data["errorCount"] == 0
    assert data["passedExpectationsCount"] == 11
    assert data["failedExpectationsCount"] == 0
    assert len(data["results"]) == 11

    # Verify scenario result ordering is maintained
    expected_ids = [sc["id"] for sc in acmepay_suite_data["scenarios"]]
    actual_ids = [r["scenarioId"] for r in data["results"]]
    assert actual_ids == expected_ids


def test_batch_api_rejects_duplicate_scenario_ids(
    valid_policy_text: str, valid_entities: list
):
    """Verify POST /simulate/batch rejects suites containing duplicate scenario IDs with 422."""
    payload = {
        "policyText": valid_policy_text,
        "entities": valid_entities,
        "suite": {
            "id": "suite_dup",
            "name": "Suite with duplicates",
            "scenarios": [
                {
                    "id": "sc_dup_1",
                    "principal": 'User::"alice"',
                    "action": 'Action::"view"',
                    "resource": 'Invoice::"inv_1"',
                },
                {
                    "id": "sc_dup_1",
                    "principal": 'User::"bob"',
                    "action": 'Action::"view"',
                    "resource": 'Invoice::"inv_2"',
                },
            ],
        },
    }

    response = client.post("/simulate/batch", json=payload)
    assert response.status_code == 422
    assert "Duplicate scenario identifier" in response.text


def test_batch_api_empty_policy_returns_400(acmepay_suite_data: dict):
    """Verify POST /simulate/batch with empty policy text returns 400 Bad Request."""
    payload = {
        "policyText": "   ",
        "suite": acmepay_suite_data,
    }

    response = client.post("/simulate/batch", json=payload)
    assert response.status_code == 400
    assert "Policy text cannot be empty" in response.json()["detail"]


def test_batch_api_empty_suite_returns_200(valid_policy_text: str):
    """Verify POST /simulate/batch with 0 scenarios returns 200 OK with empty run."""
    payload = {
        "policyText": valid_policy_text,
        "suite": {
            "id": "suite_empty",
            "name": "Empty Suite",
            "scenarios": [],
        },
    }

    response = client.post("/simulate/batch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["totalScenarios"] == 0
    assert data["results"] == []


def test_phase1_endpoints_remain_functional(
    valid_policy_text: str, valid_entities: list
):
    """Verify that all Phase 1 endpoints continue to work without regression."""
    # 1. GET /health
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"

    # 2. POST /policies/validate
    val_resp = client.post("/policies/validate", json={"policyText": valid_policy_text})
    assert val_resp.status_code == 200
    assert val_resp.json()["isValid"] is True

    # 3. POST /simulate (single evaluation)
    sim_resp = client.post(
        "/simulate",
        json={
            "principal": 'User::"admin_root"',
            "action": 'Action::"delete"',
            "resource": 'Invoice::"inv_001"',
            "policyText": valid_policy_text,
            "entities": valid_entities,
        },
    )
    assert sim_resp.status_code == 200
    evidence = sim_resp.json()
    assert evidence["decision"] == "ALLOW"
    assert "policy0" in evidence["determiningPolicies"]
