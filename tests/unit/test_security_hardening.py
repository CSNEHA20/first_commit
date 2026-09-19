"""
Security and Reliability Hardening Tests (Stage K).
Verifies fail-closed semantics, payload limits, and anti-tampering guards.
"""

import pytest
from backend.core.security import (
    MAX_POLICY_SIZE_BYTES,
    MAX_SCENARIOS_COUNT,
    MAX_ENTITIES_COUNT,
    SecurityPayloadLimitException,
    enforce_policy_size_limit,
    enforce_scenario_count_limit,
    enforce_entity_count_limit,
)
from backend.domain.cedar.input_validation import EnforcedEvaluationPipeline
from backend.domain.models.authz import AuthorizationDecision, AuthorizationRequest, EvaluationStatus
from backend.domain.avp.adapter import DeploymentService, compute_policy_sha256
from backend.domain.models.deployment import DeploymentPrepareRequest, DeploymentSubmitRequest, HumanApprovalRequest
from backend.domain.models.regression import DeploymentGateStatus, RegressionGateDecision, RegressionReport
from backend.domain.models.diff import PolicyDiffReport, BoundedImpactSummary


def test_policy_size_limit_rejection():
    oversized = "permit(principal, action, resource);\n" * 4000
    with pytest.raises(SecurityPayloadLimitException):
        enforce_policy_size_limit(oversized)

    # Valid size passes
    enforce_policy_size_limit("permit(principal, action, resource);")


def test_scenario_count_limit_rejection():
    oversized_scenarios = list(range(MAX_SCENARIOS_COUNT + 5))
    with pytest.raises(SecurityPayloadLimitException):
        enforce_scenario_count_limit(oversized_scenarios)


def test_entity_count_limit_rejection():
    oversized_entities = list(range(MAX_ENTITIES_COUNT + 5))
    with pytest.raises(SecurityPayloadLimitException):
        enforce_entity_count_limit(oversized_entities)


def test_failure_condition_fails_closed():
    pipeline = EnforcedEvaluationPipeline()
    # Invalid Cedar syntax
    req = AuthorizationRequest(
        principal='User::"attacker"',
        action='Action::"delete"',
        resource='Account::"root"',
        policyText='this is not cedar!',
    )
    evidence = pipeline.execute(req)
    assert evidence.decision == AuthorizationDecision.DENY
    assert evidence.evaluationStatus == EvaluationStatus.INVALID_INPUT
    assert evidence.decision != AuthorizationDecision.ALLOW


def test_candidate_mutation_after_human_approval_invalidates_submission():
    service = DeploymentService()
    candidate_policy = 'permit(principal in Role::"admin", action, resource);'
    clean_hash = compute_policy_sha256(candidate_policy)

    rep = RegressionReport(
        runId="reg_sec_001",
        timestamp="2026-09-19T10:00:00Z",
        baselineLabel="v12",
        candidateLabel="v13",
        diffReport=PolicyDiffReport(
            reportId="diff_01",
            timestamp="2026-09-19T10:00:00Z",
            baselineLabel="v12",
            candidateLabel="v13",
            impactSummary=BoundedImpactSummary(
                totalScenariosDeclared=0, totalScenariosCompared=0, uncomparableScenariosCount=0,
                unchangedAllowCount=0, unchangedDenyCount=0, newlyForbiddenCount=0, newlyAuthorizedCount=0,
                baselineExecutionErrorsCount=0, candidateExecutionErrorsCount=0, comparisonCoveragePct=0.0,
                newlyForbiddenRatePct=0.0, newlyAuthorizedRatePct=0.0, unchangedRatePct=0.0,
                deltaPrincipals=0, deltaActions=0, deltaResources=0,
            ),
        ),
        gateDecision=RegressionGateDecision(status=DeploymentGateStatus.PASS, isPassing=True),
    )

    # 1. Prepare deployment
    prep_res = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=candidate_policy,
            regressionReport=rep,
            targetStoreId="ps-test",
        )
    )

    # 2. Human approval
    appr = service.register_approval(
        HumanApprovalRequest(
            preparedDeploymentId=prep_res.preparedDeploymentId,
            policyHash=clean_hash,
            regressionRunId="reg_sec_001",
            operatorName="Security Auditor",
        )
    )

    # 3. Attacker modifies policy text prior to submission
    tampered_policy = candidate_policy + "\n// Backdoor permit clause\npermit(principal, action, resource);"
    with pytest.raises(ValueError, match="Candidate policy text has been modified"):
        service.submit_deployment(
            DeploymentSubmitRequest(
                preparedDeploymentId=prep_res.preparedDeploymentId,
                approvalId=appr.approvalId,
                candidatePolicyText=tampered_policy,
                targetStoreId="ps-test",
            )
        )
