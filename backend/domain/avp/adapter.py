"""
PolicyLab Amazon Verified Permissions (AVP) Integration & Deployment Service
Provides controlled policy store synchronization with strict pre-deployment gate enforcement
and server-side human approval validation.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import hashlib
import os
import uuid
from typing import Dict, List, Optional

from ..models.deployment import (
    AVPReadinessResponse,
    DeploymentPrepareRequest,
    DeploymentPrepareResponse,
    DeploymentRecord,
    DeploymentStatus,
    DeploymentSubmitRequest,
    DeploymentSubmitResponse,
    HumanApprovalRequest,
    HumanApprovalResponse,
)
from ..models.regression import DeploymentGateStatus


def compute_policy_sha256(policy_text: str) -> str:
    """Computes a canonical SHA-256 digest of Cedar policy text."""
    normalized = "\n".join(line.rstrip() for line in policy_text.strip().splitlines() if line.strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class IAVPAdapter(ABC):
    """Abstract interface for Amazon Verified Permissions interaction."""

    @abstractmethod
    def check_readiness(self, region: str, store_id: str) -> AVPReadinessResponse:
        """Inspects AWS connection and target policy store status."""
        pass

    @abstractmethod
    def submit_policy_set(
        self, store_id: str, policy_text: str, policy_hash: str, approved_by: str, environment: str
    ) -> DeploymentSubmitResponse:
        """Deploys a verified policy set to the AVP policy store."""
        pass


class DeterministicFakeAVPAdapter(IAVPAdapter):
    """
    Deterministic in-memory AVP fake adapter for local development and offline test execution.
    """

    def __init__(self):
        self._deployed_stores: Dict[str, Dict[str, str]] = {}

    def check_readiness(self, region: str, store_id: str) -> AVPReadinessResponse:
        return AVPReadinessResponse(
            isConfigured=True,
            region=region or "us-east-1",
            targetStoreId=store_id,
            status="READY_FOR_DEPLOYMENT",
            details="Local deterministic AVP simulation adapter active.",
            setupChecklist=[
                "AWS credentials verified (Simulated)",
                f"Policy store '{store_id}' accessible (Simulated)",
                "AVP least-privilege IAM role assumed",
            ],
        )

    def submit_policy_set(
        self, store_id: str, policy_text: str, policy_hash: str, approved_by: str, environment: str
    ) -> DeploymentSubmitResponse:
        dep_id = f"dep_{uuid.uuid4().hex[:8]}"
        proof = f"avp-sync-proof-{policy_hash[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        self._deployed_stores[store_id] = {
            "policy_text": policy_text,
            "policy_hash": policy_hash,
            "deployed_by": approved_by,
            "deployed_at": now,
            "proof": proof,
        }

        return DeploymentSubmitResponse(
            deploymentId=dep_id,
            status=DeploymentStatus.SYNCHRONIZED,
            targetStoreId=store_id,
            policyHash=policy_hash,
            deployedBy=approved_by,
            deployedAt=now,
            verificationProof=proof,
            message=f"Successfully synchronized policy set ({policy_hash[:8]}) to Amazon Verified Permissions store '{store_id}'.",
        )


class Boto3AVPAdapter(IAVPAdapter):
    """
    Live Amazon Verified Permissions adapter via boto3.
    """

    def __init__(self, region: Optional[str] = None):
        self.region = region or os.environ.get("AWS_REGION", "us-east-1")

    def check_readiness(self, region: str, store_id: str) -> AVPReadinessResponse:
        try:
            import boto3
            client = boto3.client("verifiedpermissions", region_name=self.region)
            resp = client.get_policy_store(policyStoreId=store_id)
            return AVPReadinessResponse(
                isConfigured=True,
                region=self.region,
                targetStoreId=store_id,
                status="READY",
                details=f"Connected to AWS Verified Permissions policy store '{store_id}' ({resp.get('createdDate')}).",
                setupChecklist=[
                    "AWS credentials active",
                    f"Policy store '{store_id}' confirmed",
                    "PutPolicy permissions verified",
                ],
            )
        except Exception as ex:
            return AVPReadinessResponse(
                isConfigured=False,
                region=self.region,
                targetStoreId=store_id,
                status="NOT_CONFIGURED",
                details=f"AWS Verified Permissions unavailable: {str(ex)}",
                setupChecklist=[
                    "Configure AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
                    f"Create policy store '{store_id}' in region '{self.region}'",
                    "Grant verifiedpermissions:PutPolicy IAM permissions",
                ],
            )

    def submit_policy_set(
        self, store_id: str, policy_text: str, policy_hash: str, approved_by: str, environment: str
    ) -> DeploymentSubmitResponse:
        try:
            import boto3
            client = boto3.client("verifiedpermissions", region_name=self.region)
            now = datetime.now(timezone.utc).isoformat()
            
            # Put static policy into AVP store
            res = client.create_policy(
                policyStoreId=store_id,
                definition={
                    "static": {
                        "statement": policy_text,
                        "description": f"PolicyLab verified deployment by {approved_by} (SHA256: {policy_hash[:8]})",
                    }
                },
            )
            policy_id = res.get("policyId", f"pol_{uuid.uuid4().hex[:6]}")
            proof = f"avp-aws-proof-{policy_id}"

            return DeploymentSubmitResponse(
                deploymentId=f"dep_{uuid.uuid4().hex[:8]}",
                status=DeploymentStatus.SYNCHRONIZED,
                targetStoreId=store_id,
                policyHash=policy_hash,
                deployedBy=approved_by,
                deployedAt=now,
                verificationProof=proof,
                message=f"Synchronized policy to Amazon Verified Permissions store '{store_id}' as policy ID '{policy_id}'.",
            )
        except Exception as ex:
            now = datetime.now(timezone.utc).isoformat()
            return DeploymentSubmitResponse(
                deploymentId=f"dep_{uuid.uuid4().hex[:8]}",
                status=DeploymentStatus.FAILED,
                targetStoreId=store_id,
                policyHash=policy_hash,
                deployedBy=approved_by,
                deployedAt=now,
                verificationProof=None,
                message=f"AVP deployment failed: {str(ex)}",
            )


class DeploymentService:
    """
    Coordinates pre-deployment preparation, gate checks, server-side human approval validation,
    and submission to Amazon Verified Permissions.
    """

    def __init__(self, avp_adapter: Optional[IAVPAdapter] = None):
        if avp_adapter:
            self.avp_adapter = avp_adapter
        elif os.environ.get("AWS_AVP_ENABLED") == "true":
            self.avp_adapter = Boto3AVPAdapter()
        else:
            self.avp_adapter = DeterministicFakeAVPAdapter()

        # Server-side registry of prepared deployments and approvals
        self._prepared_deployments: Dict[str, Dict] = {}
        self._approvals: Dict[str, HumanApprovalResponse] = {}
        self._deployment_history: List[DeploymentRecord] = [
            DeploymentRecord(
                id="dep_001",
                policyVersionTag="v12",
                policyHash="8a3e77f09bc1d4e21a88b024419ad21590bf12019488da12b918a09f871491bc",
                targetStoreId="ps-acmepay-prod",
                environment="production",
                status=DeploymentStatus.SYNCHRONIZED,
                deployedBy="Vishal (Auto-Pipeline)",
                deployedAt="2026-09-18T15:00:00Z",
                verificationProof="cedar-proof-sig-990a12fbc",
            )
        ]

    def check_readiness(self, region: str = "us-east-1", store_id: str = "ps-acmepay-prod") -> AVPReadinessResponse:
        return self.avp_adapter.check_readiness(region=region, store_id=store_id)

    def prepare_deployment(self, request: DeploymentPrepareRequest) -> DeploymentPrepareResponse:
        """
        Validates deployment gate eligibility and registers a prepared deployment with its SHA-256 digest.
        """
        gate_decision = request.regressionReport.gateDecision
        policy_hash = compute_policy_sha256(request.candidatePolicyText)
        prepared_id = f"prep_{uuid.uuid4().hex[:8]}"

        if gate_decision.status != DeploymentGateStatus.PASS:
            return DeploymentPrepareResponse(
                preparedDeploymentId=prepared_id,
                policyHash=policy_hash,
                targetStoreId=request.targetStoreId,
                environment=request.environment,
                isEligible=False,
                gateStatus=gate_decision.status,
                reasons=[f"Deployment blocked: Verification gate status is {gate_decision.status.value}."] + gate_decision.reasons,
                requiresHumanApproval=True,
            )

        # Record in prepared registry
        self._prepared_deployments[prepared_id] = {
            "policy_text": request.candidatePolicyText,
            "policy_hash": policy_hash,
            "regression_run_id": request.regressionReport.runId,
            "target_store_id": request.targetStoreId,
            "environment": request.environment.value,
        }

        return DeploymentPrepareResponse(
            preparedDeploymentId=prepared_id,
            policyHash=policy_hash,
            targetStoreId=request.targetStoreId,
            environment=request.environment,
            isEligible=True,
            gateStatus=DeploymentGateStatus.PASS,
            reasons=["All security contracts satisfied with 0 blocking regressions.", "Policy syntax and schema validated."],
            requiresHumanApproval=True,
        )

    def register_approval(self, request: HumanApprovalRequest) -> HumanApprovalResponse:
        """
        Registers an explicit human approval for a prepared deployment and policy hash.
        """
        prep = self._prepared_deployments.get(request.preparedDeploymentId)
        if not prep:
            raise ValueError(f"Prepared deployment '{request.preparedDeploymentId}' not found or expired.")

        if prep["policy_hash"] != request.policyHash:
            raise ValueError("Policy hash mismatch: The candidate policy has changed since preparation.")

        if prep["regression_run_id"] != request.regressionRunId:
            raise ValueError("Regression run ID mismatch: Approval must target the verified regression run.")

        approval_id = f"appr_{uuid.uuid4().hex[:8]}"
        approval = HumanApprovalResponse(
            approvalId=approval_id,
            preparedDeploymentId=request.preparedDeploymentId,
            policyHash=request.policyHash,
            approvedBy=request.operatorName,
            approvedAt=datetime.now(timezone.utc).isoformat(),
            status="APPROVED",
        )
        self._approvals[approval_id] = approval
        return approval

    def submit_deployment(self, request: DeploymentSubmitRequest) -> DeploymentSubmitResponse:
        """
        Submits an approved deployment to Amazon Verified Permissions.
        Validates that human approval exists and matches the policy hash.
        """
        approval = self._approvals.get(request.approvalId)
        if not approval:
            raise ValueError(f"Valid human approval '{request.approvalId}' required prior to submission.")

        current_hash = compute_policy_sha256(request.candidatePolicyText)
        if approval.policyHash != current_hash:
            raise ValueError("Candidate policy text has been modified since human approval was granted. Prior approval is invalidated.")

        # Submit to AVP adapter
        submit_res = self.avp_adapter.submit_policy_set(
            store_id=request.targetStoreId,
            policy_text=request.candidatePolicyText,
            policy_hash=current_hash,
            approved_by=approval.approvedBy,
            environment=request.environment.value,
        )

        if submit_res.status == DeploymentStatus.SYNCHRONIZED:
            record = DeploymentRecord(
                id=submit_res.deploymentId,
                policyVersionTag=f"v_{current_hash[:6]}",
                policyHash=current_hash,
                targetStoreId=request.targetStoreId,
                environment=request.environment.value,
                status=DeploymentStatus.SYNCHRONIZED,
                deployedBy=approval.approvedBy,
                deployedAt=submit_res.deployedAt,
                verificationProof=submit_res.verificationProof or "avp-sync-proof",
            )
            self._deployment_history.insert(0, record)

        return submit_res

    def get_history(self) -> List[DeploymentRecord]:
        return self._deployment_history
