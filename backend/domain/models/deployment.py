"""
PolicyLab Amazon Verified Permissions (AVP) Deployment Domain Models
Defines models for deployment readiness, pre-deployment preparation,
server-side human governance, and deployment submission.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from .regression import DeploymentGateStatus, RegressionReport


class DeploymentTargetEnv(str, Enum):
    staging = "staging"
    production = "production"


class DeploymentStatus(str, Enum):
    NOT_CONFIGURED = "NOT_CONFIGURED"
    READY_FOR_REVIEW = "READY_FOR_REVIEW"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    APPROVED = "APPROVED"
    SUBMISSION_IN_PROGRESS = "SUBMISSION_IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    SYNCHRONIZED = "SYNCHRONIZED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


class AVPReadinessResponse(BaseModel):
    """
    Status of AWS environment readiness for Amazon Verified Permissions deployment.
    """
    isConfigured: bool
    region: Optional[str] = None
    targetStoreId: Optional[str] = None
    status: str
    details: str
    setupChecklist: List[str] = Field(default_factory=list)


class DeploymentPrepareRequest(BaseModel):
    """
    Request to prepare a deployment plan from a verified regression report.
    """
    candidatePolicyText: str = Field(..., description="Candidate policy text to deploy")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema")
    targetStoreId: str = Field(default="ps-acmepay-prod", description="Target AVP policy store ID")
    environment: DeploymentTargetEnv = Field(default=DeploymentTargetEnv.production)
    regressionReport: RegressionReport = Field(..., description="Verified regression report")


class DeploymentPrepareResponse(BaseModel):
    """
    Prepared deployment plan with computed SHA-256 policy digest and gate check.
    """
    preparedDeploymentId: str
    policyHash: str = Field(..., description="Cryptographic SHA-256 digest of candidate policy")
    targetStoreId: str
    environment: DeploymentTargetEnv
    isEligible: bool = Field(..., description="True only if gate status is PASS")
    gateStatus: DeploymentGateStatus
    reasons: List[str] = Field(default_factory=list)
    requiresHumanApproval: bool = True
    notice: str = "A passing verification gate is required. Explicit human approval is mandatory prior to submission."


class HumanApprovalRequest(BaseModel):
    """
    Explicit human operator approval for a specific prepared deployment and policy hash.
    """
    preparedDeploymentId: str
    policyHash: str = Field(..., description="Target policy hash to approve")
    regressionRunId: str = Field(..., description="Target regression report run ID")
    operatorName: str = Field(..., description="Operator name or IAM identity approving the change")
    approvalNotes: Optional[str] = Field(None, description="Change ticket or review rationale")


class HumanApprovalResponse(BaseModel):
    """
    Record of human operator sign-off.
    """
    approvalId: str
    preparedDeploymentId: str
    policyHash: str
    approvedBy: str
    approvedAt: str
    status: str = "APPROVED"
    message: str = "Human approval registered. Policy is authorized for AVP synchronization."


class DeploymentSubmitRequest(BaseModel):
    """
    Request to submit an approved policy set to Amazon Verified Permissions.
    """
    preparedDeploymentId: str
    approvalId: str
    candidatePolicyText: str
    targetStoreId: str
    environment: DeploymentTargetEnv = DeploymentTargetEnv.production


class DeploymentSubmitResponse(BaseModel):
    """
    Result of submitting the policy set to the AVP policy store.
    """
    deploymentId: str
    status: DeploymentStatus
    targetStoreId: str
    policyHash: str
    deployedBy: str
    deployedAt: str
    verificationProof: Optional[str] = None
    message: str


class DeploymentRecord(BaseModel):
    """
    Persistent audit ledger record of verified deployments.
    """
    id: str
    policyVersionTag: str
    policyHash: str
    targetStoreId: str
    environment: str
    status: DeploymentStatus
    deployedBy: str
    deployedAt: str
    verificationProof: str
