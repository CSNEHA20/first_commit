"""
PolicyLab Amazon Verified Permissions (AVP) Deployment Domain Models
Defines models for deployment readiness, pre-deployment preparation,
server-side human governance, and deployment submission.
Harmonized for bidirectional compatibility across backend services and frontend UI.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
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


class ChecklistItem(BaseModel):
    item: str
    satisfied: bool
    description: str


class AVPReadinessResponse(BaseModel):
    """
    Status of AWS environment readiness for Amazon Verified Permissions deployment.
    """
    isConfigured: bool
    isReadyForDeployment: bool = True
    region: Optional[str] = None
    awsRegion: Optional[str] = None
    targetStoreId: Optional[str] = None
    configuredPolicyStores: Dict[str, str] = Field(default_factory=dict)
    status: str
    details: str
    adapterMode: str = "DETERMINISTIC_FAKE"
    missingRequirements: List[str] = Field(default_factory=list)
    setupChecklist: List[str] = Field(default_factory=list)
    checklist: List[ChecklistItem] = Field(default_factory=list)


class DeploymentPrepareRequest(BaseModel):
    """
    Request to prepare a deployment plan from a verified regression report.
    """
    candidatePolicyText: str = Field(..., description="Candidate policy text to deploy")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema")
    targetStoreId: Optional[str] = Field(default="ps-acmepay-prod", description="Target AVP policy store ID")
    environment: Optional[DeploymentTargetEnv] = Field(default=DeploymentTargetEnv.production)
    targetEnv: Optional[str] = Field(default="production", description="Target environment name")
    regressionReport: RegressionReport = Field(..., description="Verified regression report")


class DeploymentPrepareResponse(BaseModel):
    """
    Prepared deployment plan with computed SHA-256 policy digest and gate check.
    """
    preparedDeploymentId: str
    policyHash: str = Field(..., description="Cryptographic SHA-256 digest of candidate policy")
    candidatePolicyHashSha256: str = Field(..., description="Alias for frontend compatibility")
    targetStoreId: str
    targetPolicyStoreId: str
    environment: DeploymentTargetEnv
    targetEnv: str
    isEligible: bool = Field(..., description="True only if gate status is PASS")
    isDeployable: bool = Field(..., description="Alias for frontend compatibility")
    gateStatus: DeploymentGateStatus
    regressionGateStatus: str
    reasons: List[str] = Field(default_factory=list)
    rejectionReasons: List[str] = Field(default_factory=list)
    requiresHumanApproval: bool = True
    approvalTokenRequired: bool = True
    notice: str = "A passing verification gate is required. Explicit human approval is mandatory prior to submission."


class HumanApprovalRequest(BaseModel):
    """
    Explicit human operator approval for a specific prepared deployment and policy hash.
    """
    preparedDeploymentId: Optional[str] = Field(None, description="Prepared deployment ID")
    policyHash: Optional[str] = Field(None, description="Target policy hash to approve")
    candidatePolicyHashSha256: Optional[str] = Field(None, description="Frontend alias for policy hash")
    regressionRunId: Optional[str] = Field(None, description="Target regression report run ID")
    operatorName: Optional[str] = Field(None, description="Operator name")
    approverName: Optional[str] = Field(None, description="Frontend alias for operator name")
    targetEnv: Optional[str] = Field(default="production", description="Target environment")
    ticketReference: Optional[str] = Field(None, description="Change ticket reference")
    approvalNotes: Optional[str] = Field(None, description="Change review notes")


class HumanApprovalResponse(BaseModel):
    """
    Record of human operator sign-off.
    """
    approvalId: str
    approvalToken: str = Field(..., description="Frontend alias for approval ID")
    preparedDeploymentId: Optional[str] = None
    policyHash: str
    candidatePolicyHashSha256: str
    approvedBy: str
    approvedAt: str
    status: str = "APPROVED"
    targetEnv: str = "production"
    ticketReference: Optional[str] = None
    message: str = "Human approval registered. Policy is authorized for AVP synchronization."


class DeploymentSubmitRequest(BaseModel):
    """
    Request to submit an approved policy set to Amazon Verified Permissions.
    """
    preparedDeploymentId: Optional[str] = None
    approvalId: Optional[str] = None
    approvalToken: Optional[str] = None
    candidatePolicyText: str
    schemaText: Optional[str] = None
    targetStoreId: Optional[str] = None
    targetEnv: Optional[str] = "production"
    environment: Optional[DeploymentTargetEnv] = DeploymentTargetEnv.production
    regressionRunId: Optional[str] = None
    candidateLabel: Optional[str] = None


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
