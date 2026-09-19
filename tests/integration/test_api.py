"""
Integration Tests for PolicyLab FastAPI Backend Endpoints
"""

import json
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)
FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def valid_policy_text():
    return (FIXTURES_DIR / "valid_policy.cedar").read_text()


@pytest.fixture
def invalid_policy_text():
    return (FIXTURES_DIR / "invalid_policy.cedar").read_text()


@pytest.fixture
def entities():
    return json.loads((FIXTURES_DIR / "entities.json").read_text())


def test_api_health():
    """Test health endpoint returns engine status and version."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "cedarVersion" in data


def test_api_validate_valid_policy(valid_policy_text):
    """Test POST /policies/validate with valid Cedar code."""
    response = client.post(
        "/policies/validate",
        json={"policyText": valid_policy_text},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["isValid"] is True
    assert len(data["errors"]) == 0


def test_api_validate_invalid_policy(invalid_policy_text):
    """Test POST /policies/validate with invalid Cedar code."""
    response = client.post(
        "/policies/validate",
        json={"policyText": invalid_policy_text},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["isValid"] is False
    assert len(data["errors"]) > 0


def test_api_simulate_allow(valid_policy_text, entities):
    """Test POST /simulate returns ALLOW with canonical evidence payload."""
    payload = {
        "principal": 'User::"admin_root"',
        "action": 'Action::"delete"',
        "resource": 'Invoice::"inv_9082"',
        "context": {},
        "policyText": valid_policy_text,
        "entities": entities,
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "ALLOW"
    assert "evidenceId" in data
    assert "executionDurationMs" in data
    assert len(data["determiningPolicies"]) > 0


def test_api_simulate_explicit_forbid(valid_policy_text, entities):
    """Test POST /simulate returns DENY when explicit forbid policy is triggered."""
    payload = {
        "principal": 'User::"contractor_alice"',
        "action": 'Action::"delete"',
        "resource": 'PayrollReport::"payroll_2026_q1"',
        "context": {},
        "policyText": valid_policy_text,
        "entities": entities,
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "DENY"
    # Explicit forbid policy is recorded in determiningPolicies
    assert len(data["determiningPolicies"]) > 0


def test_api_simulate_default_deny(valid_policy_text, entities):
    """Test POST /simulate returns DENY via default deny when no permit or forbid matches."""
    payload = {
        "principal": 'User::"contractor_alice"',
        "action": 'Action::"edit"',
        "resource": 'Invoice::"inv_9082"',
        "context": {},
        "policyText": valid_policy_text,
        "entities": entities,
    }
    response = client.post("/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "DENY"
    # Default deny has no determining permit/forbid policy
    assert data["determiningPolicies"] == []
