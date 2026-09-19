"""
PolicyLab Security Contract Domain Models
Defines models for organizational authorization invariants, contract verification,
and regression test evaluation.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .authz import AuthorizationDecision
from .scenario import ScenarioSuite


class ContractSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ContractStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNCOMPARABLE = "UNCOMPARABLE"
    ERROR = "ERROR"


class ContractType(str, Enum):
    SCENARIO_SET = "SCENARIO_SET"
    INVARIANT_DENIED = "INVARIANT_DENIED"
    INVARIANT_PERMITTED = "INVARIANT_PERMITTED"


class SecurityContract(BaseModel):
    """
    Represents an explicit organizational authorization invariant that must be satisfied.
    """
    id: str = Field(..., description="Stable contract identifier, e.g. SC-01, SC-03")
    title: str = Field(..., description="Human-readable contract title")
    description: Optional[str] = Field(None, description="Detailed description of the security invariant")
    severity: ContractSeverity = Field(default=ContractSeverity.HIGH, description="Violation severity")
    isBlocking: bool = Field(default=True, description="Whether a failure blocks the deployment gate")
    contractType: ContractType = Field(default=ContractType.SCENARIO_SET, description="Contract evaluation model")
    scenarioIds: List[str] = Field(default_factory=list, description="Explicit scenario IDs governed by this contract")
    expectedDecision: Optional[AuthorizationDecision] = Field(
        default=None, description="Expected authorization decision across mapped scenarios"
    )
    isActive: bool = Field(default=True, description="Whether this contract is active for enforcement")


class SecurityContractResult(BaseModel):
    """
    Outcome of evaluating a single security contract against candidate policy behavior.
    """
    contractId: str
    title: str
    description: Optional[str] = None
    severity: ContractSeverity
    isBlocking: bool
    status: ContractStatus
    evaluatedScenariosCount: int
    passedScenariosCount: int
    failedScenariosCount: int
    uncomparableScenariosCount: int
    violatingScenarioIds: List[str] = Field(default_factory=list)
    counterexampleIds: List[str] = Field(default_factory=list)
    failureReason: Optional[str] = None
    boundaryStatement: str = (
        "Evaluation is bounded by the declared scenario universe. "
        "A passing contract indicates no violations were detected within the declared scenarios."
    )


class SecurityContractSuite(BaseModel):
    """
    A collection of security contracts defining an organizational authorization specification.
    """
    id: str = Field(..., description="Stable suite ID")
    name: str = Field(..., description="Suite name")
    description: Optional[str] = None
    contracts: List[SecurityContract] = Field(default_factory=list)


class ContractEvaluationRequest(BaseModel):
    """
    Request payload to evaluate a set of security contracts against a policy set.
    """
    policyText: str = Field(..., description="Cedar policy set text to evaluate")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Shared entity graph")
    suite: ScenarioSuite = Field(..., description="Scenario suite for verification")
    contracts: List[SecurityContract] = Field(..., description="Security contracts to evaluate")


class ContractEvaluationReport(BaseModel):
    """
    Summary report of security contract evaluations.
    """
    reportId: str
    timestamp: str
    totalContracts: int
    passedContracts: int
    failedContracts: int
    uncomparableContracts: int
    errorContracts: int
    allBlockingPassed: bool
    results: List[SecurityContractResult] = Field(default_factory=list)
