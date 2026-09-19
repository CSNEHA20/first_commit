"""
PolicyLab Regression & Deployment Gate Domain Models
Defines models for end-to-end regression evaluation, deployment gate decisions,
and actionable gate findings.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .contract import SecurityContract, SecurityContractResult
from .counterexample import Counterexample
from .diff import PolicyDiffReport
from .scenario import ScenarioSuite


class DeploymentGateStatus(str, Enum):
    PASS = "PASS"
    BLOCKED = "BLOCKED"
    INCOMPLETE = "INCOMPLETE"


class RegressionGateDecision(BaseModel):
    """
    Deterministic pre-deployment verification gate outcome.
    Evaluates whether a candidate policy satisfies all blocking security contracts
    and possesses complete verification evidence.
    """
    status: DeploymentGateStatus
    isPassing: bool = Field(..., description="True if gate status is PASS")
    reasons: List[str] = Field(default_factory=list, description="Actionable reasons for the gate decision")
    blockingViolationsCount: int = 0
    nonBlockingViolationsCount: int = 0
    uncomparableScenariosCount: int = 0
    executionErrorsCount: int = 0
    requiresHumanApproval: bool = True
    deploymentNotice: str = (
        "Deterministic verification passed. Human operator review and approval is required "
        "before deploying to Amazon Verified Permissions."
    )


class RegressionReport(BaseModel):
    """
    Comprehensive regression report combining diff blast radius, counterexamples,
    security contract results, and deployment gate decision.
    """
    runId: str
    timestamp: str
    engine: str = "cedar-wasm@4.13.0"
    baselineLabel: str
    candidateLabel: str
    diffReport: PolicyDiffReport
    counterexamples: List[Counterexample] = Field(default_factory=list)
    contractResults: List[SecurityContractResult] = Field(default_factory=list)
    gateDecision: RegressionGateDecision
    boundaryStatement: str = (
        "Analysis is bounded by the declared scenario universe and entity fixtures. "
        "It does not establish universal mathematical equivalence across infinite inputs."
    )


class RegressionRunRequest(BaseModel):
    """
    Request payload to execute a full regression evaluation and gate check.
    """
    baselinePolicyText: str = Field(..., description="Baseline (production) Cedar policy set")
    candidatePolicyText: str = Field(..., description="Candidate (proposed) Cedar policy set")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Shared entity graph")
    suite: ScenarioSuite = Field(..., description="Scenario suite for equivalent comparison")
    contracts: List[SecurityContract] = Field(default_factory=list, description="Configured security contracts")
    baselineLabel: str = Field(default="Baseline (v12)", description="Baseline policy label")
    candidateLabel: str = Field(default="Candidate (v13)", description="Candidate policy label")
