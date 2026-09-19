"""
Unit tests for AWS Lambda Step Functions task dispatcher (Phase 8 Stage F)
"""

import pytest
from backend.lambda_handler import handler


def test_lambda_handler_stepfunctions_validate_policy():
    """Verifies that direct task invocation for validate_policy returns expected payload."""
    event = {
        "operation": "validate_policy",
        "policyText": 'permit (principal == User::"alice", action == Action::"view", resource == Document::"doc1");',
        "schemaText": None,
    }
    result = handler(event, None)
    assert result["isValid"] is True
    assert result["errors"] == []
    assert "candidatePolicyText" in result


def test_lambda_handler_stepfunctions_validate_policy_invalid():
    """Verifies syntax failure in validate_policy returns isValid False."""
    event = {
        "operation": "validate_policy",
        "policyText": "permit (INVALID SYNTAX);",
        "schemaText": None,
    }
    result = handler(event, None)
    assert result["isValid"] is False
    assert len(result["errors"]) > 0


def test_lambda_handler_stepfunctions_run_regression():
    """Verifies that direct run_regression task invocation executes regression engine."""
    event = {
        "operation": "run_regression",
        "baselinePolicyText": 'permit (principal in Role::"admin", action, resource);',
        "candidatePolicyText": 'permit (principal in Role::"admin", action, resource);',
        "schemaText": None,
        "suite": {
            "id": "test_suite",
            "name": "Test Suite",
            "scenarios": [
                {
                    "id": "scen_1",
                    "title": "Admin view doc",
                    "principal": 'Role::"admin"',
                    "action": 'Action::"view"',
                    "resource": 'Document::"doc1"',
                    "context": {},
                    "expectedDecision": "ALLOW",
                }
            ],
        },
        "contracts": [],
    }
    result = handler(event, None)
    assert "gateDecision" in result
    assert result["gateDecision"]["status"] == "PASS"
    assert len(result["diffReport"]["scenarioDiffs"]) == 1


def test_lambda_handler_stepfunctions_persist_audit_report():
    """Verifies that persist_audit_report stores audit data."""
    event = {
        "operation": "persist_audit_report",
        "auditData": {
            "id": "audit_test_001",
            "summary": "Audit completed with 0 regressions.",
        },
    }
    result = handler(event, None)
    assert result["status"] == "SUCCESS"
    assert result["auditId"] == "audit_test_001"


def test_lambda_handler_stepfunctions_unknown_operation_raises():
    """Verifies that unknown operation raises ValueError."""
    event = {"operation": "unknown_op"}
    with pytest.raises(ValueError) as exc:
        handler(event, None)
    assert "Unknown Step Functions task operation" in str(exc.value)
