"""
Unit tests for PolicyLab Amazon Verified Permissions (AVP) Deployment Service
"""

import json
from pathlib import Path
import pytest

from backend.domain.models.deployment import (
    DeploymentPrepareRequest,
    DeploymentStatus,
    DeploymentSubmitRequest,
    DeploymentTargetEnv,
    HumanApprovalRequest,
)
from backend.domain.models.regression import (
    DeploymentGateStatus,
    RegressionGateDecision,
    RegressionReport,
)
from backend.domain.models.diff import PolicyDiffReport, BoundedImpactSummary
from backend.domain.avp.adapter import (
    DeploymentService,
    DeterministicFakeAVPAdapter,
    compute_policy_sha256,
)

FIXTURES_DIR = Path(__file__).parent.parent.parent / "fixtures"


@pytest.fixture
def valid_policy():
    with open(FIXTURES_DIR / "valid_policy.cedar", "r") as f:
        return f.read()


@pytest.fixture
def passing_regression_report(valid_policy):
    return RegressionReport(
        runId="reg_pass_001",
        timestamp="2026-09-19T08:00:00Z",
        baselineLabel="v12",
        candidateLabel="v12_fixed",
        diffReport=PolicyDiffReport(
            reportId="diff_001",
            timestamp="2026-09-19T08:00:00Z",
            baselineLabel="v12",
            candidateLabel="v12_fixed",
            impactSummary=BoundedImpactSummary(
                totalScenariosDeclared=1,
                totalScenariosCompared=1,
                uncomparableScenariosCount=0,
                unchangedAllowCount=1,
                unchangedDenyCount=0,
                newlyForbiddenCount=0,
                newlyAuthorizedCount=0,
                baselineExecutionErrorsCount=0,
                candidateExecutionErrorsCount=0,
                comparisonCoveragePct=100.0,
                newlyForbiddenRatePct=0.0,
                newlyAuthorizedRatePct=0.0,
                unchangedRatePct=100.0,
                deltaPrincipals=0,
                deltaActions=0,
                deltaResources=0,
            ),
        ),
        gateDecision=RegressionGateDecision(
            status=DeploymentGateStatus.PASS,
            isPassing=True,
            reasons=["All security contracts satisfied."],
            blockingViolationsCount=0,
        ),
    )


@pytest.fixture
def blocked_regression_report():
    return RegressionReport(
        runId="reg_blocked_001",
        timestamp="2026-09-19T08:00:00Z",
        baselineLabel="v12",
        candidateLabel="v13",
        diffReport=PolicyDiffReport(
            reportId="diff_002",
            timestamp="2026-09-19T08:00:00Z",
            baselineLabel="v12",
            candidateLabel="v13",
            impactSummary=BoundedImpactSummary(
                totalScenariosDeclared=1,
                totalScenariosCompared=1,
                uncomparableScenariosCount=0,
                unchangedAllowCount=0,
                unchangedDenyCount=0,
                newlyForbiddenCount=0,
                newlyAuthorizedCount=1,
                baselineExecutionErrorsCount=0,
                candidateExecutionErrorsCount=0,
                comparisonCoveragePct=100.0,
                newlyForbiddenRatePct=0.0,
                newlyAuthorizedRatePct=100.0,
                unchangedRatePct=0.0,
                deltaPrincipals=1,
                deltaActions=1,
                deltaResources=1,
            ),
        ),
        gateDecision=RegressionGateDecision(
            status=DeploymentGateStatus.BLOCKED,
            isPassing=False,
            reasons=["Blocking Security Contract SC-03 failed."],
            blockingViolationsCount=1,
        ),
    )


def test_avp_readiness_check():
    service = DeploymentService(avp_adapter=DeterministicFakeAVPAdapter())
    readiness = service.check_readiness(region="us-east-1", store_id="ps-acmepay-prod")

    assert readiness.isConfigured is True
    assert readiness.status == "READY_FOR_DEPLOYMENT"
    assert len(readiness.setupChecklist) > 0


def test_prepare_deployment_rejects_blocked_gate(valid_policy, blocked_regression_report):
    service = DeploymentService()
    req = DeploymentPrepareRequest(
        candidatePolicyText=valid_policy,
        targetStoreId="ps-acmepay-prod",
        environment=DeploymentTargetEnv.production,
        regressionReport=blocked_regression_report,
    )
    res = service.prepare_deployment(req)

    assert res.isEligible is False
    assert res.gateStatus == DeploymentGateStatus.BLOCKED
    assert any("Deployment blocked" in r for r in res.reasons)


def test_prepare_deployment_accepts_passing_gate(valid_policy, passing_regression_report):
    service = DeploymentService()
    req = DeploymentPrepareRequest(
        candidatePolicyText=valid_policy,
        targetStoreId="ps-acmepay-prod",
        environment=DeploymentTargetEnv.production,
        regressionReport=passing_regression_report,
    )
    res = service.prepare_deployment(req)

    assert res.isEligible is True
    assert res.gateStatus == DeploymentGateStatus.PASS
    assert res.policyHash == compute_policy_sha256(valid_policy)
    assert res.preparedDeploymentId.startswith("prep_")


def test_human_approval_registration(valid_policy, passing_regression_report):
    service = DeploymentService()
    prep_res = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=valid_policy,
            targetStoreId="ps-acmepay-prod",
            environment=DeploymentTargetEnv.production,
            regressionReport=passing_regression_report,
        )
    )

    appr_req = HumanApprovalRequest(
        preparedDeploymentId=prep_res.preparedDeploymentId,
        policyHash=prep_res.policyHash,
        regressionRunId=passing_regression_report.runId,
        operatorName="Vishal (Lead Reviewer)",
        approvalNotes="Verified least privilege constraints",
    )
    appr_res = service.register_approval(appr_req)

    assert appr_res.status == "APPROVED"
    assert appr_res.approvedBy == "Vishal (Lead Reviewer)"
    assert appr_res.approvalId.startswith("appr_")


def test_human_approval_rejects_hash_mismatch(valid_policy, passing_regression_report):
    service = DeploymentService()
    prep_res = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=valid_policy,
            targetStoreId="ps-acmepay-prod",
            environment=DeploymentTargetEnv.production,
            regressionReport=passing_regression_report,
        )
    )

    appr_req = HumanApprovalRequest(
        preparedDeploymentId=prep_res.preparedDeploymentId,
        policyHash="mismatched_hash_999",
        regressionRunId=passing_regression_report.runId,
        operatorName="Sneha",
    )
    with pytest.raises(ValueError, match="Policy hash mismatch"):
        service.register_approval(appr_req)


def test_submission_invalidated_if_candidate_policy_modified(valid_policy, passing_regression_report):
    service = DeploymentService()
    prep_res = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=valid_policy,
            targetStoreId="ps-acmepay-prod",
            environment=DeploymentTargetEnv.production,
            regressionReport=passing_regression_report,
        )
    )

    appr_res = service.register_approval(
        HumanApprovalRequest(
            preparedDeploymentId=prep_res.preparedDeploymentId,
            policyHash=prep_res.policyHash,
            regressionRunId=passing_regression_report.runId,
            operatorName="Vishal",
        )
    )

    # Attempt to submit modified policy with old approval
    modified_policy = valid_policy + "\n// Tampered clause"
    submit_req = DeploymentSubmitRequest(
        preparedDeploymentId=prep_res.preparedDeploymentId,
        approvalId=appr_res.approvalId,
        candidatePolicyText=modified_policy,
        targetStoreId="ps-acmepay-prod",
    )
    with pytest.raises(ValueError, match="modified since human approval"):
        service.submit_deployment(submit_req)


def test_submission_success_with_valid_human_approval(valid_policy, passing_regression_report):
    service = DeploymentService()
    prep_res = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=valid_policy,
            targetStoreId="ps-acmepay-prod",
            environment=DeploymentTargetEnv.production,
            regressionReport=passing_regression_report,
        )
    )

    appr_res = service.register_approval(
        HumanApprovalRequest(
            preparedDeploymentId=prep_res.preparedDeploymentId,
            policyHash=prep_res.policyHash,
            regressionRunId=passing_regression_report.runId,
            operatorName="Vishal",
        )
    )

    submit_req = DeploymentSubmitRequest(
        preparedDeploymentId=prep_res.preparedDeploymentId,
        approvalId=appr_res.approvalId,
        candidatePolicyText=valid_policy,
        targetStoreId="ps-acmepay-prod",
    )
    submit_res = service.submit_deployment(submit_req)

    assert submit_res.status == DeploymentStatus.SYNCHRONIZED
    assert submit_res.verificationProof is not None
    assert "avp-sync-proof" in submit_res.verificationProof
    assert submit_res.deployedBy == "Vishal"

    # Verify history entry recorded
    history = service.get_history()
    assert len(history) >= 2
    assert history[0].id == submit_res.deploymentId
