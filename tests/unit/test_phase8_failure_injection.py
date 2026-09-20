"""
Unit tests for Phase 8 Operational Security and Failure-Injection Scenarios (Stage K)
Covers:
- AWS credentials unavailable
- AVP permission denied / store inaccessible
- Bedrock throttling / timeout fallback
- Malformed Bedrock output / hallucinated citation filtering
- DynamoDB conditional write conflict (duplicate versions)
- S3 SHA-256 integrity digest mismatch
- Candidate modification post-approval invalidation
- BLOCKED candidate deployment submission rejection
- Error containment preventing unauthorized ALLOW
"""

import sys
from unittest.mock import MagicMock
import pytest

try:
    import boto3
except ImportError:
    boto3 = MagicMock()
    sys.modules["boto3"] = boto3

from backend.domain.avp.adapter import (
    Boto3AVPAdapter,
    DeploymentService,
    compute_policy_sha256,
)
from backend.domain.models.deployment import (
    DeploymentPrepareRequest,
    DeploymentSubmitRequest,
    DeploymentTargetEnv,
    HumanApprovalRequest,
)
from backend.domain.models.regression import (
    DeploymentGateStatus,
    RegressionGateDecision,
    RegressionReport,
)
from backend.domain.models.diff import PolicyDiffReport
from backend.domain.persistence.aws_repository import (
    DynamoDBPolicyLabRepository,
    PolicyVersionConflictError,
    S3ArtifactIntegrityError,
    S3ArtifactRepository,
)
from backend.domain.ai.explanation import (
    AIExplanationRequest,
    BedrockExplanationProvider,
    DeterministicTemplateExplanationProvider,
)
from backend.domain.models.diff import BehavioralTransition
from backend.domain.models.authz import AuthorizationDecision


def test_failure_injection_avp_inaccessible_store(monkeypatch):
    """Verifies that an inaccessible AVP store returns isConfigured=False with error details."""
    adapter = Boto3AVPAdapter(region="us-east-1")

    def mock_boto3_client(service, **kwargs):
        mock_client = MagicMock()
        mock_client.get_policy_store.side_effect = Exception("ResourceNotFoundException: Policy store nonexistent-store-xyz unavailable")
        return mock_client

    monkeypatch.setattr(boto3, "client", mock_boto3_client)
    readiness = adapter.check_readiness(region="us-east-1", store_id="nonexistent-store-xyz")
    assert readiness.isConfigured is False
    assert readiness.isReadyForDeployment is False
    assert "unavailable" in readiness.details.lower() or "not found" in readiness.details.lower()


def test_failure_injection_bedrock_timeout_fallback(monkeypatch):
    """Verifies that Bedrock timeouts or exceptions automatically fall back to deterministic template."""
    provider = BedrockExplanationProvider(region="us-east-1")

    # Mock boto3 client to raise an exception (e.g. ReadTimeoutError)
    def mock_boto3_client(service, **kwargs):
        mock_client = MagicMock()
        mock_client.invoke_model.side_effect = Exception("EndpointConnectionError: Connect timeout")
        return mock_client

    import boto3
    monkeypatch.setattr(boto3, "client", mock_boto3_client)

    evidence = AIExplanationRequest(
        findingId="find_001",
        scenarioId="scen_contractor_delete",
        principal='User::"contractor_carol"',
        action='Action::"delete"',
        resource='PayrollRecord::"pr-001"',
        baselineDecision=AuthorizationDecision.DENY,
        candidateDecision=AuthorizationDecision.ALLOW,
        transition=BehavioralTransition.NEWLY_AUTHORIZED,
    )

    response = provider.generate_explanation(evidence)
    assert response.isFallback is True
    assert "Candidate policy modification expanded permissions" in response.summary


def test_failure_injection_bedrock_malformed_json_fallback(monkeypatch):
    """Verifies that malformed or non-JSON model output falls back to deterministic template."""
    provider = BedrockExplanationProvider(region="us-east-1")

    class FakeBody:
        def read(self):
            import json
            return json.dumps({
                "content": [{"text": "I am unable to output JSON: Error in model formatting."}]
            }).encode("utf-8")

    def mock_boto3_client(service, **kwargs):
        mock_client = MagicMock()
        mock_client.invoke_model.return_value = {"body": FakeBody()}
        return mock_client

    import boto3
    monkeypatch.setattr(boto3, "client", mock_boto3_client)

    evidence = AIExplanationRequest(
        findingId="find_002",
        scenarioId="scen_editor_delete",
        principal='User::"editor_bob"',
        action='Action::"delete"',
        resource='Invoice::"inv-001"',
        baselineDecision=AuthorizationDecision.DENY,
        candidateDecision=AuthorizationDecision.ALLOW,
        transition=BehavioralTransition.NEWLY_AUTHORIZED,
    )

    response = provider.generate_explanation(evidence)
    assert response.isFallback is True
    assert len(response.evidenceReferences) > 0


def test_failure_injection_bedrock_hallucinated_citations_filtered(monkeypatch):
    """Verifies that citations referencing nonexistent IDs are purged from model response."""
    provider = BedrockExplanationProvider(region="us-east-1")

    class FakeBody:
        def read(self):
            import json
            return json.dumps({
                "content": [{
                    "text": json.dumps({
                        "summary": "Model summary",
                        "rootCause": "Model root cause",
                        "securityRisk": "Model risk",
                        "remediationCedar": "permit (...);",
                        "evidenceReferences": ["find_003", "FAKE_CITATION_123", "NONEXISTENT_PROOF_999"],
                    })
                }]
            }).encode("utf-8")

    def mock_boto3_client(service, **kwargs):
        mock_client = MagicMock()
        mock_client.invoke_model.return_value = {"body": FakeBody()}
        return mock_client

    import boto3
    monkeypatch.setattr(boto3, "client", mock_boto3_client)

    evidence = AIExplanationRequest(
        findingId="find_003",
        scenarioId="scen_editor_delete",
        principal='User::"editor_bob"',
        action='Action::"delete"',
        resource='Invoice::"inv-001"',
        baselineDecision=AuthorizationDecision.DENY,
        candidateDecision=AuthorizationDecision.ALLOW,
        transition=BehavioralTransition.NEWLY_AUTHORIZED,
    )

    response = provider.generate_explanation(evidence)
    assert response.isFallback is False
    assert "FAKE_CITATION_123" not in response.evidenceReferences
    assert "NONEXISTENT_PROOF_999" not in response.evidenceReferences
    assert "find_003" in response.evidenceReferences


def test_failure_injection_dynamodb_conditional_write_conflict():
    """Verifies that attempting to save a duplicate policy version tag raises PolicyVersionConflictError."""
    repo = DynamoDBPolicyLabRepository()
    v1 = {
        "setId": "polset_test",
        "versionTag": "v1.0",
        "policyHash": "hash123",
        "author": "Alice",
    }
    repo.save_policy_version(v1)

    # Attempting to save the same versionTag again must fail
    with pytest.raises(PolicyVersionConflictError) as exc:
        repo.save_policy_version(v1)
    assert "already exists" in str(exc.value)


def test_failure_injection_s3_artifact_digest_mismatch():
    """Verifies that retrieving an artifact with an incorrect expected SHA-256 raises S3ArtifactIntegrityError."""
    repo = S3ArtifactRepository()
    content = 'permit (principal in Role::"admin", action, resource);'
    res = repo.store_artifact("policies/test_p1.cedar", content)

    # Retrieving with wrong expected hash must raise S3ArtifactIntegrityError
    with pytest.raises(S3ArtifactIntegrityError) as exc:
        repo.get_artifact("policies/test_p1.cedar", verify_sha256="wrong_hash_000000000000000000000000")
    assert "SHA-256 verification failed" in str(exc.value)


def test_failure_injection_approval_invalidated_on_candidate_tampering():
    """Verifies that modifying candidate policy after human sign-off invalidates submission."""
    from backend.main import regression_engine
    from backend.domain.models.scenario import ScenarioSuite
    from backend.domain.models.regression import RegressionRunRequest

    service = DeploymentService()
    candidate_original = 'permit (principal in Role::"admin", action, resource);'
    candidate_tampered = 'permit (principal in Role::"admin", action, resource); permit (principal, action, resource);'

    # Run real regression for passing policy
    mock_reg = regression_engine.run_regression(
        RegressionRunRequest(
            baselinePolicyText=candidate_original,
            candidatePolicyText=candidate_original,
            suite=ScenarioSuite(
                id="suite_test",
                name="Suite",
                scenarios=[
                    {
                        "id": "scen_admin",
                        "title": "Admin view",
                        "principal": 'Role::"admin"',
                        "action": 'Action::"view"',
                        "resource": 'Document::"doc1"',
                        "expectedDecision": "ALLOW",
                    }
                ],
            ),
            contracts=[],
        )
    )

    prep = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=candidate_original,
            regressionReport=mock_reg,
        )
    )

    appr = service.register_approval(
        HumanApprovalRequest(
            preparedDeploymentId=prep.preparedDeploymentId,
            policyHash=prep.policyHash,
            regressionRunId=mock_reg.runId,
            operatorName="Security Officer",
        )
    )

    # Attempt to submit tampered candidate text using previous approval ID
    with pytest.raises(ValueError) as exc:
        service.submit_deployment(
            DeploymentSubmitRequest(
                preparedDeploymentId=prep.preparedDeploymentId,
                approvalId=appr.approvalId,
                candidatePolicyText=candidate_tampered,
                targetStoreId="ps-acmepay-prod",
            )
        )
    assert "modified since human approval was granted" in str(exc.value)


def test_failure_injection_blocked_candidate_cannot_be_deployed():
    """Verifies that a candidate with gate BLOCKED cannot be submitted for deployment."""
    from backend.main import regression_engine
    from backend.domain.models.scenario import ScenarioSuite
    from backend.domain.models.regression import RegressionRunRequest
    from backend.domain.models.contract import SecurityContract, ContractSeverity

    service = DeploymentService()
    baseline = 'permit (principal in Role::"admin", action, resource);'
    candidate_vulnerable = 'permit (principal, action, resource);'

    # Run real regression that triggers a contract violation
    mock_blocked_reg = regression_engine.run_regression(
        RegressionRunRequest(
            baselinePolicyText=baseline,
            candidatePolicyText=candidate_vulnerable,
            suite=ScenarioSuite(
                id="suite_test",
                name="Suite",
                scenarios=[
                    {
                        "id": "scen_contractor",
                        "title": "Contractor delete",
                        "principal": 'Role::"contractor"',
                        "action": 'Action::"delete"',
                        "resource": 'Document::"doc1"',
                        "expectedDecision": "DENY",
                    }
                ],
            ),
            contracts=[
                SecurityContract(
                    id="sc-01",
                    title="Contractor cannot delete",
                    isBlocking=True,
                    severity=ContractSeverity.CRITICAL,
                    scenarioIds=["scen_contractor"],
                    expectedDecision=AuthorizationDecision.DENY,
                )
            ],
        )
    )

    prep = service.prepare_deployment(
        DeploymentPrepareRequest(
            candidatePolicyText=candidate_vulnerable,
            regressionReport=mock_blocked_reg,
        )
    )
    assert prep.isEligible is False
    assert prep.gateStatus == DeploymentGateStatus.BLOCKED

    # Attempting to register human approval on a BLOCKED preparation must fail
    with pytest.raises(ValueError) as exc:
        service.register_approval(
            HumanApprovalRequest(
                preparedDeploymentId=prep.preparedDeploymentId,
                policyHash=prep.policyHash,
                regressionRunId=mock_blocked_reg.runId,
                operatorName="Attacker",
            )
        )
    assert "Verification gate status is BLOCKED" in str(exc.value)

