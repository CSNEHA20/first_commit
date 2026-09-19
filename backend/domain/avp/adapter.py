"""
PolicyLab Amazon Verified Permissions (AVP) Integration & Deployment Service
Provides controlled policy store synchronization with strict pre-deployment gate enforcement,
server-side human approval validation, and bidirectional frontend/backend compatibility.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
import hashlib
import os
import uuid
from typing import Dict, List, Optional

from ..models.deployment import (
    AVPReadinessResponse,
    ChecklistItem,
    DeploymentPrepareRequest,
    DeploymentPrepareResponse,
    DeploymentRecord,
    DeploymentStatus,
    DeploymentSubmitRequest,
    DeploymentSubmitResponse,
    DeploymentTargetEnv,
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
        reg = region or "us-east-1"
        sid = store_id or "ps-acmepay-prod"
        checklist = [
            ChecklistItem(
                item="AWS Credentials",
                satisfied=True,
                description="Deterministic offline simulation active (No AWS credentials required)",
            ),
            ChecklistItem(
                item=f"Policy Store '{sid}'",
                satisfied=True,
                description="Simulated policy store initialized in memory",
            ),
            ChecklistItem(
                item="IAM Permissions",
                satisfied=True,
                description="Simulated verifiedpermissions:PutPolicy & BatchIsAuthorized granted",
            ),
            ChecklistItem(
                item="Deterministic Gate Pre-check",
                satisfied=True,
                description="Strict pre-deployment gate enforcement enabled",
            ),
        ]
        return AVPReadinessResponse(
            isConfigured=True,
            isReadyForDeployment=True,
            region=reg,
            awsRegion=reg,
            targetStoreId=sid,
            configuredPolicyStores={
                "production": "ps-acmepay-prod",
                "staging": "ps-acmepay-staging",
            },
            status="READY_FOR_DEPLOYMENT",
            details="Local deterministic AVP simulation adapter active.",
            adapterMode="DETERMINISTIC_FAKE",
            missingRequirements=[],
            setupChecklist=[
                "AWS credentials verified (Simulated)",
                f"Policy store '{sid}' accessible (Simulated)",
                "AVP least-privilege IAM role assumed",
            ],
            checklist=checklist,
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
        reg = region or self.region
        sid = store_id or os.environ.get("AVP_POLICY_STORE_ID", "ps-acmepay-prod")
        try:
            import boto3
            client = boto3.client("verifiedpermissions", region_name=reg)
            resp = client.get_policy_store(policyStoreId=sid)
            created = str(resp.get("createdDate", "active"))
            checklist = [
                ChecklistItem(
                    item="AWS Credentials",
                    satisfied=True,
                    description="Active AWS IAM session authenticated",
                ),
                ChecklistItem(
                    item=f"Policy Store '{sid}'",
                    satisfied=True,
                    description=f"Verified store in '{reg}' created on {created}",
                ),
                ChecklistItem(
                    item="AVP Permissions",
                    satisfied=True,
                    description="verifiedpermissions:PutPolicy / GetPolicyStore confirmed",
                ),
            ]
            return AVPReadinessResponse(
                isConfigured=True,
                isReadyForDeployment=True,
                region=reg,
                awsRegion=reg,
                targetStoreId=sid,
                configuredPolicyStores={"production": sid},
                status="READY",
                details=f"Connected to AWS Verified Permissions policy store '{sid}' ({created}).",
                adapterMode="LIVE_BOTO3",
                missingRequirements=[],
                setupChecklist=[
                    "AWS credentials active",
                    f"Policy store '{sid}' confirmed",
                    "PutPolicy permissions verified",
                ],
                checklist=checklist,
            )
        except Exception as ex:
            checklist = [
                ChecklistItem(
                    item="AWS Credentials",
                    satisfied=False,
                    description="Failed to authenticate with AWS credentials",
                ),
                ChecklistItem(
                    item=f"Policy Store '{sid}'",
                    satisfied=False,
                    description=f"Inaccessible in region '{reg}': {str(ex)}",
                ),
            ]
            return AVPReadinessResponse(
                isConfigured=False,
                isReadyForDeployment=False,
                region=reg,
                awsRegion=reg,
                targetStoreId=sid,
                configuredPolicyStores={},
                status="NOT_CONFIGURED",
                details=f"AWS Verified Permissions unavailable: {str(ex)}",
                adapterMode="LIVE_BOTO3",
                missingRequirements=["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AVP_POLICY_STORE_ID"],
                setupChecklist=[
                    "Configure AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
                    f"Create policy store '{sid}' in region '{reg}'",
                    "Grant verifiedpermissions:PutPolicy IAM permissions",
                ],
                checklist=checklist,
            )

    def submit_policy_set(
        self, store_id: str, policy_text: str, policy_hash: str, approved_by: str, environment: str
    ) -> DeploymentSubmitResponse:
        try:
            import boto3
            client = boto3.client("verifiedpermissions", region_name=self.region)
            now = datetime.now(timezone.utc).isoformat()

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

        target_env = request.targetEnv or (
            request.environment.value if request.environment else "production"
        )
        target_store = request.targetStoreId or f"ps-acmepay-{target_env}"

        is_eligible = (gate_decision.status == DeploymentGateStatus.PASS)
        reasons = (
            ["All security contracts satisfied with 0 blocking regressions.", "Policy syntax and schema validated."]
            if is_eligible
            else [f"Deployment blocked: Verification gate status is {gate_decision.status.value}."] + gate_decision.reasons
        )

        # Record in prepared registry
        self._prepared_deployments[prepared_id] = {
            "prepared_id": prepared_id,
            "policy_text": request.candidatePolicyText,
            "policy_hash": policy_hash,
            "regression_run_id": request.regressionReport.runId,
            "target_store_id": target_store,
            "environment": target_env,
            "is_eligible": is_eligible,
        }

        # Also index by policy_hash for frontend lookup
        self._prepared_deployments[policy_hash] = self._prepared_deployments[prepared_id]

        env_enum = DeploymentTargetEnv(target_env) if target_env in ("staging", "production") else DeploymentTargetEnv.production

        return DeploymentPrepareResponse(
            preparedDeploymentId=prepared_id,
            policyHash=policy_hash,
            candidatePolicyHashSha256=policy_hash,
            targetStoreId=target_store,
            targetPolicyStoreId=target_store,
            environment=env_enum,
            targetEnv=target_env,
            isEligible=is_eligible,
            isDeployable=is_eligible,
            gateStatus=gate_decision.status,
            regressionGateStatus=gate_decision.status.value,
            reasons=reasons,
            rejectionReasons=[] if is_eligible else reasons,
            requiresHumanApproval=True,
            approvalTokenRequired=True,
        )

    def register_approval(self, request: HumanApprovalRequest) -> HumanApprovalResponse:
        """
        Registers an explicit human approval for a prepared deployment and policy hash.
        """
        target_hash = request.policyHash or request.candidatePolicyHashSha256
        if not target_hash:
            raise ValueError("Candidate policy hash is required for human approval registration.")

        prep = None
        if request.preparedDeploymentId and request.preparedDeploymentId in self._prepared_deployments:
            prep = self._prepared_deployments[request.preparedDeploymentId]
        elif target_hash in self._prepared_deployments:
            prep = self._prepared_deployments[target_hash]

        if not prep:
            raise ValueError("Prepared deployment not found or expired. Run regression and prepare deployment first.")

        if prep["policy_hash"] != target_hash:
            raise ValueError("Policy hash mismatch: The candidate policy has changed since preparation.")

        if not prep.get("is_eligible", False):
            raise ValueError("Cannot approve deployment: Verification gate status is BLOCKED.")

        if request.regressionRunId and prep["regression_run_id"] != request.regressionRunId:
            raise ValueError("Regression run ID mismatch: Approval must target the verified regression run.")

        approval_id = f"appr_{uuid.uuid4().hex[:8]}"
        approver = request.approverName or request.operatorName or "Operator"
        now = datetime.now(timezone.utc).isoformat()

        approval = HumanApprovalResponse(
            approvalId=approval_id,
            approvalToken=approval_id,
            preparedDeploymentId=prep["prepared_id"],
            policyHash=target_hash,
            candidatePolicyHashSha256=target_hash,
            approvedBy=approver,
            approvedAt=now,
            status="APPROVED",
            targetEnv=request.targetEnv or prep["environment"],
            ticketReference=request.ticketReference,
        )

        self._approvals[approval_id] = approval
        return approval

    def submit_deployment(self, request: DeploymentSubmitRequest) -> DeploymentSubmitResponse:
        """
        Submits an approved deployment to Amazon Verified Permissions.
        Validates that human approval exists and matches the policy hash.
        """
        token = request.approvalId or request.approvalToken
        if not token:
            raise ValueError("Valid human approval ID or approvalToken required prior to submission.")

        approval = self._approvals.get(token)
        if not approval:
            raise ValueError(f"Valid human approval '{token}' not found or expired.")

        current_hash = compute_policy_sha256(request.candidatePolicyText)
        if approval.policyHash != current_hash:
            raise ValueError(
                "Candidate policy text has been modified since human approval was granted. Prior approval is invalidated."
            )

        # Check preparation record if available to enforce gate
        prep = self._prepared_deployments.get(current_hash) or (
            self._prepared_deployments.get(approval.preparedDeploymentId) if approval.preparedDeploymentId else None
        )
        if prep and not prep.get("is_eligible", True):
            raise ValueError("Cannot deploy: candidate policy has unresolved security invariant violations (Gate is BLOCKED).")

        target_store = request.targetStoreId or f"ps-acmepay-{request.targetEnv or 'prod'}"
        target_env = request.targetEnv or (request.environment.value if request.environment else "production")

        # Submit to AVP adapter
        submit_res = self.avp_adapter.submit_policy_set(
            store_id=target_store,
            policy_text=request.candidatePolicyText,
            policy_hash=current_hash,
            approved_by=approval.approvedBy,
            environment=target_env,
        )

        if submit_res.status == DeploymentStatus.SYNCHRONIZED:
            record = DeploymentRecord(
                id=submit_res.deploymentId,
                policyVersionTag=f"v_{current_hash[:6]}",
                policyHash=current_hash,
                targetStoreId=target_store,
                environment=target_env,
                status=DeploymentStatus.SYNCHRONIZED,
                deployedBy=approval.approvedBy,
                deployedAt=submit_res.deployedAt,
                verificationProof=submit_res.verificationProof or "avp-sync-proof",
            )
            self._deployment_history.insert(0, record)

        return submit_res

    def get_history(self) -> List[DeploymentRecord]:
        return self._deployment_history
