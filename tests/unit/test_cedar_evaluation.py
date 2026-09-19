"""
Unit Tests for Cedar Authorization Evaluation Service
"""

import json
import pytest
from pathlib import Path
from backend.domain.cedar.evaluation import CedarEvaluationService
from backend.domain.cedar.engine import LocalCedarAdapter
from backend.domain.models.authz import AuthorizationRequest, AuthorizationDecision

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def evaluation_service():
    return CedarEvaluationService(engine=LocalCedarAdapter())


@pytest.fixture
def valid_policy_text():
    return (FIXTURES_DIR / "valid_policy.cedar").read_text()


@pytest.fixture
def entities():
    return json.loads((FIXTURES_DIR / "entities.json").read_text())


def test_evaluate_permit_authorized(evaluation_service, valid_policy_text, entities):
    """Test that admin_root can delete Invoice (explicit permit)."""
    req = AuthorizationRequest(
        principal='User::"admin_root"',
        action='Action::"delete"',
        resource='Invoice::"inv_9082"',
        context={},
        policyText=valid_policy_text,
        entities=entities,
    )
    evidence = evaluation_service.evaluate(req)

    assert evidence.decision == AuthorizationDecision.ALLOW
    assert len(evidence.determiningPolicies) > 0
    assert evidence.executionDurationMs >= 0.0
    assert "User::\"admin_root\"" in str(evidence.request["principal"])


def test_evaluate_editor_view_permit(evaluation_service, valid_policy_text, entities):
    """Test that editor_bob can view Invoice."""
    req = AuthorizationRequest(
        principal='User::"editor_bob"',
        action='Action::"view"',
        resource='Invoice::"inv_9082"',
        context={},
        policyText=valid_policy_text,
        entities=entities,
    )
    evidence = evaluation_service.evaluate(req)
    assert evidence.decision == AuthorizationDecision.ALLOW


def test_evaluate_editor_delete_denied(evaluation_service, valid_policy_text, entities):
    """Test that editor_bob CANNOT delete Invoice (default deny)."""
    req = AuthorizationRequest(
        principal='User::"editor_bob"',
        action='Action::"delete"',
        resource='Invoice::"inv_9082"',
        context={},
        policyText=valid_policy_text,
        entities=entities,
    )
    evidence = evaluation_service.evaluate(req)
    assert evidence.decision == AuthorizationDecision.DENY


def test_evaluate_contractor_delete_payroll_explicit_forbid(
    evaluation_service, valid_policy_text, entities
):
    """Test that contractor_alice is forbidden from deleting PayrollReport."""
    req = AuthorizationRequest(
        principal='User::"contractor_alice"',
        action='Action::"delete"',
        resource='PayrollReport::"payroll_2026_q1"',
        context={"network": "EXTERNAL"},
        policyText=valid_policy_text,
        entities=entities,
    )
    evidence = evaluation_service.evaluate(req)
    assert evidence.decision == AuthorizationDecision.DENY


def test_evaluate_contractor_view_support_ticket(
    evaluation_service, valid_policy_text, entities
):
    """Test that contractor_alice CAN view assigned SupportTicket."""
    req = AuthorizationRequest(
        principal='User::"contractor_alice"',
        action='Action::"view"',
        resource='SupportTicket::"ticket_102"',
        context={},
        policyText=valid_policy_text,
        entities=entities,
    )
    evidence = evaluation_service.evaluate(req)
    assert evidence.decision == AuthorizationDecision.ALLOW
