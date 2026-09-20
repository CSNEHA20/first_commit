"""
Unit tests for PolicyAuditAgent execution, audit persistence, and Step Functions workflow endpoints.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.main import app, repository
from backend.core.auth import create_token_for_testing


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    token = create_token_for_testing(roles=["engineer", "admin", "approver"])
    return {"Authorization": f"Bearer {token}"}


def test_agent_audit_synchronous_and_persistence(client, auth_headers):
    """Tests POST /audits/agent-run executes Strands audit and persists the report."""
    payload = {
        "baselinePolicyText": 'permit (principal in Role::"admin", action, resource);',
        "candidatePolicyText": 'permit (principal in Role::"admin", action, resource);',
        "suite": {
            "id": "suite_audit_test",
            "name": "Audit Test Suite",
            "scenarios": [
                {
                    "id": "scen_1",
                    "title": "Admin can access document",
                    "principal": 'Role::"admin"',
                    "action": 'Action::"view"',
                    "resource": 'Document::"doc1"',
                    "context": {},
                    "expectedDecision": "ALLOW",
                }
            ],
        },
        "contracts": [],
        "runAiExplanation": False,
    }

    res = client.post(
        "/audits/agent-run",
        json=payload,
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "auditRunId" in data
    assert data["status"] == "COMPLETED_PASS"
    assert data["gateDecision"] == "PASS"
    assert len(data["toolInvocations"]) >= 3  # validate candidate, validate baseline, run regression

    audit_id = data["auditRunId"]

    # Verify persistence via repository
    persisted = repository.get_audit_run(audit_id)
    assert persisted is not None
    assert persisted["id"] == audit_id

    # Verify retrieval via GET /audits/{audit_id}
    get_res = client.get(
        f"/audits/{audit_id}",
        headers=auth_headers,
    )
    assert get_res.status_code == 200
    fetched_data = get_res.json()
    assert fetched_data["auditRunId"] == audit_id


def test_async_audit_unconfigured_raises_400(client, auth_headers):
    """Tests POST /audits/async-run returns 400 when AUDIT_STATE_MACHINE_ARN is unset."""
    payload = {
        "baselinePolicyText": 'permit (principal, action, resource);',
        "candidatePolicyText": 'permit (principal, action, resource);',
        "suite": {
            "id": "suite_async",
            "name": "Async Suite",
            "scenarios": [],
        },
    }

    with patch.dict("os.environ", {}, clear=True):
        with patch("backend.core.aws_config.aws_config.state_machine_arn", None):
            res = client.post(
                "/audits/async-run",
                json=payload,
                headers=auth_headers,
            )
            assert res.status_code == 400
            assert "state machine ARN is not configured" in res.json()["detail"]
            assert "/audits/agent-run" in res.json()["detail"]


def test_async_audit_start_and_status_mocked(client, auth_headers):
    """Tests POST /audits/async-run and GET /audits/executions/{arn} when configured with boto3."""
    mock_sfn = MagicMock()
    mock_sfn.start_execution.return_value = {
        "executionArn": "arn:aws:states:us-east-1:123456789012:execution:PolicyAuditWorkflow-dev:audit-123",
        "startDate": pytest.importorskip("datetime").datetime.now(pytest.importorskip("datetime").timezone.utc),
    }
    mock_sfn.describe_execution.return_value = {
        "executionArn": "arn:aws:states:us-east-1:123456789012:execution:PolicyAuditWorkflow-dev:audit-123",
        "status": "SUCCEEDED",
        "startDate": pytest.importorskip("datetime").datetime.now(pytest.importorskip("datetime").timezone.utc),
        "output": '{"gateDecision": {"status": "PASS"}, "auditId": "audit-123"}',
    }

    payload = {
        "baselinePolicyText": 'permit (principal, action, resource);',
        "candidatePolicyText": 'permit (principal, action, resource);',
        "suite": {
            "id": "suite_async",
            "name": "Async Suite",
            "scenarios": [],
        },
    }

    test_arn = "arn:aws:states:us-east-1:123456789012:stateMachine:PolicyAuditWorkflow-dev"
    with patch.dict("os.environ", {"AUDIT_STATE_MACHINE_ARN": test_arn}):
        with patch("boto3.client", return_value=mock_sfn):
            # Test start execution
            res = client.post(
                "/audits/async-run",
                json=payload,
                headers=auth_headers,
            )
            assert res.status_code == 200
            start_data = res.json()
            assert start_data["status"] == "RUNNING"
            assert "execution:PolicyAuditWorkflow-dev:audit-123" in start_data["executionArn"]

            # Test describe execution
            exec_arn = start_data["executionArn"]
            status_res = client.get(
                f"/audits/executions/{exec_arn}",
                headers=auth_headers,
            )
            assert status_res.status_code == 200
            status_data = status_res.json()
            assert status_data["status"] == "SUCCEEDED"
            assert status_data["output"]["gateDecision"]["status"] == "PASS"
