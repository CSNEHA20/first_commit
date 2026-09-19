"""
Unit tests for PolicyLab Input Validation Boundary and Enforced Evaluation Pipeline (Stage D).
"""

import pytest
from backend.domain.cedar.input_validation import (
    CedarInputValidationService,
    EnforcedEvaluationPipeline,
    ValidationStage,
)
from backend.domain.models.authz import (
    AuthorizationDecision,
    AuthorizationRequest,
    EvaluationStatus,
)


def test_entity_graph_validation_detects_malformed_records():
    validator = CedarInputValidationService()

    # 1. Missing UID
    res = validator.validate_entity_graph([{"attrs": {}}])
    assert not res.isValid
    assert res.stage == ValidationStage.ENTITY_GRAPH
    assert any(e.code == "MISSING_ENTITY_UID" for e in res.errors)

    # 2. Malformed UID
    res = validator.validate_entity_graph([{"uid": "invalid_uid_format"}])
    assert not res.isValid
    assert any(e.code == "MALFORMED_ENTITY_UID" for e in res.errors)

    # 3. Duplicate UID
    res = validator.validate_entity_graph([
        {"uid": {"type": "User", "id": "alice"}},
        {"uid": {"type": "User", "id": "alice"}},
    ])
    assert not res.isValid
    assert any(e.code == "DUPLICATE_ENTITY_UID" for e in res.errors)

    # 4. Valid entities
    res = validator.validate_entity_graph([
        {"uid": {"type": "User", "id": "alice"}, "attrs": {}, "parents": []},
        {"uid": {"type": "Role", "id": "admin"}, "attrs": {}, "parents": []},
    ])
    assert res.isValid


def test_request_context_validation():
    validator = CedarInputValidationService()

    # 1. Invalid Action type
    res = validator.validate_request_context(
        principal='User::"alice"',
        action='User::"bob"',  # Action must have entity type Action
        resource='Invoice::"inv_1"',
    )
    assert not res.isValid
    assert any(e.code == "INVALID_ACTION_TYPE" for e in res.errors)

    # 2. Invalid Context type
    res = validator.validate_request_context(
        principal='User::"alice"',
        action='Action::"view"',
        resource='Invoice::"inv_1"',
        context="invalid_string_context",  # type: ignore
    )
    assert not res.isValid
    assert any(e.code == "INVALID_CONTEXT_TYPE" for e in res.errors)

    # 3. Valid request
    res = validator.validate_request_context(
        principal='User::"alice"',
        action='Action::"view"',
        resource='Invoice::"inv_1"',
        context={"ip": "192.168.1.1"},
    )
    assert res.isValid


def test_enforced_evaluation_pipeline_blocks_invalid_inputs():
    pipeline = EnforcedEvaluationPipeline()

    # Request with invalid Cedar syntax
    req = AuthorizationRequest(
        principal='User::"alice"',
        action='Action::"view"',
        resource='Invoice::"inv_1"',
        policyText='permit(invalid syntax here!!',
    )
    evidence = pipeline.execute(req)
    assert evidence.decision == AuthorizationDecision.DENY
    assert evidence.evaluationStatus == EvaluationStatus.INVALID_INPUT
    assert len(evidence.diagnostics.errors) > 0

    # Request with malformed entity
    req_bad_entity = AuthorizationRequest(
        principal='User::"alice"',
        action='Action::"view"',
        resource='Invoice::"inv_1"',
        policyText='permit(principal, action, resource);',
        entities=[{"bad": "entity"}],
    )
    evidence2 = pipeline.execute(req_bad_entity)
    assert evidence2.decision == AuthorizationDecision.DENY
    assert evidence2.evaluationStatus == EvaluationStatus.INVALID_INPUT
    assert any("MISSING_ENTITY_UID" in str(e) or "missing required 'uid'" in str(e) for e in evidence2.diagnostics.errors)


def test_enforced_evaluation_pipeline_success():
    pipeline = EnforcedEvaluationPipeline()
    req = AuthorizationRequest(
        principal='User::"alice"',
        action='Action::"view"',
        resource='Invoice::"inv_1"',
        policyText='permit(principal == User::"alice", action == Action::"view", resource == Invoice::"inv_1");',
        entities=[],
    )
    evidence = pipeline.execute(req, policy_version_id="v1", scenario_id="sc_01")
    assert evidence.decision == AuthorizationDecision.ALLOW
    assert evidence.evaluationStatus == EvaluationStatus.SUCCESS_ALLOW
    assert evidence.policyVersionId == "v1"
    assert evidence.scenarioId == "sc_01"
    assert evidence.validationStatus == "PASSED"
