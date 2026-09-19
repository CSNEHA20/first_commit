"""
PolicyLab Scenario Domain Models
Defines Scenario, ScenarioSuite, ScenarioResult, and SimulationRun models
for deterministic batch simulation and regression testing.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator

from .authz import (
    AuthorizationDecision,
    CanonicalEvidence,
    EvaluationDiagnostics,
    MatchedPolicy,
)


class ScenarioExecutionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    EXECUTION_ERROR = "EXECUTION_ERROR"


class SimulationRunStatus(str, Enum):
    COMPLETED = "COMPLETED"
    PARTIAL_FAILURE = "PARTIAL_FAILURE"
    FAILED = "FAILED"


class Scenario(BaseModel):
    """
    Represents a single declared authorization scenario vector:
    <Principal, Action, Resource, Context, ExpectedDecision>
    """
    id: str = Field(..., description="Stable scenario identifier, e.g. sc_01")
    title: Optional[str] = Field(None, description="Human-readable scenario title")
    description: Optional[str] = Field(None, description="Detailed description")
    principal: str = Field(..., description='e.g., User::"contractor_alice"')
    action: str = Field(..., description='e.g., Action::"delete"')
    resource: str = Field(..., description='e.g., PayrollReport::"q1_summary"')
    context: Dict[str, Any] = Field(default_factory=dict, description="Authorization context")
    expectedDecision: Optional[AuthorizationDecision] = Field(
        None, description="Expected authorization outcome (ALLOW | DENY)"
    )
    contractId: Optional[str] = Field(None, description="Optional security contract identifier")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    entities: Optional[List[Dict[str, Any]]] = Field(
        None, description="Optional scenario-specific entity store override"
    )


class ScenarioSuite(BaseModel):
    """
    A collection of declared authorization scenarios with unique identifiers.
    """
    id: str = Field(..., description="Stable suite identifier, e.g. suite_acmepay_core")
    name: str = Field(..., description="Human-readable suite name")
    description: Optional[str] = Field(None, description="Suite description")
    version: Optional[str] = Field(None, description="Suite version")
    scenarios: List[Scenario] = Field(default_factory=list, description="Ordered list of scenarios")

    @model_validator(mode="after")
    def validate_unique_scenario_ids(self) -> "ScenarioSuite":
        scenario_ids = [sc.id for sc in self.scenarios]
        duplicates = [sid for sid in set(scenario_ids) if scenario_ids.count(sid) > 1]
        if duplicates:
            raise ValueError(
                f"Duplicate scenario identifier(s) found in suite '{self.id}': {', '.join(sorted(duplicates))}"
            )
        return self


class ScenarioResult(BaseModel):
    """
    Result of evaluating an individual scenario against a policy set.
    Distinguishes genuine Cedar ALLOW / DENY decisions from execution errors.
    """
    scenarioId: str
    scenarioTitle: Optional[str] = None
    status: ScenarioExecutionStatus = ScenarioExecutionStatus.SUCCESS
    decision: Optional[AuthorizationDecision] = None
    expectedDecision: Optional[AuthorizationDecision] = None
    isExpected: Optional[bool] = None
    determiningPolicies: List[str] = Field(default_factory=list)
    matchedPolicies: List[MatchedPolicy] = Field(default_factory=list)
    diagnostics: EvaluationDiagnostics = Field(default_factory=EvaluationDiagnostics)
    executionDurationMs: float = 0.0
    error: Optional[str] = None
    evidence: Optional[CanonicalEvidence] = None


class BatchSimulationRequest(BaseModel):
    """
    Request payload for batch scenario simulation.
    """
    policyText: str = Field(..., description="Cedar policy set text")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema text")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Global entity graph")
    suite: ScenarioSuite = Field(..., description="Scenario suite to evaluate")


class SimulationRun(BaseModel):
    """
    Structured simulation run matrix capturing all scenario evaluation results
    and deterministic aggregate metrics.
    """
    runId: str
    suiteId: str
    suiteName: str
    status: SimulationRunStatus
    totalScenarios: int
    successCount: int
    errorCount: int
    allowCount: int
    denyCount: int
    passedExpectationsCount: int
    failedExpectationsCount: int
    executionDurationMs: float
    timestamp: str
    engine: str = "cedar-wasm@4.13.0"
    results: List[ScenarioResult] = Field(default_factory=list)
