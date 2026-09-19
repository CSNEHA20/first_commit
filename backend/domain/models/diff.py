"""
PolicyLab Policy Diff Domain Models
Defines models for deterministic policy comparison, behavioral transition
classification, and bounded impact analysis.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .authz import (
    AuthorizationDecision,
    EvaluationDiagnostics,
)
from .scenario import ScenarioSuite


class BehavioralTransition(str, Enum):
    """
    Classification of authorization decision changes between baseline and candidate policies.
    """
    UNCHANGED_ALLOW = "UNCHANGED_ALLOW"    # ALLOW -> ALLOW
    UNCHANGED_DENY = "UNCHANGED_DENY"      # DENY -> DENY
    NEWLY_FORBIDDEN = "NEWLY_FORBIDDEN"    # ALLOW -> DENY
    NEWLY_AUTHORIZED = "NEWLY_AUTHORIZED"  # DENY -> ALLOW


class ScenarioComparisonStatus(str, Enum):
    """Status indicating whether a scenario could be reliably compared."""
    COMPARABLE = "COMPARABLE"
    UNCOMPARABLE = "UNCOMPARABLE"


class ScenarioDiffResult(BaseModel):
    """
    Behavioral comparison outcome for an individual authorization scenario.
    """
    scenarioId: str
    scenarioTitle: Optional[str] = None
    principal: str
    action: str
    resource: str
    context: Dict[str, Any] = Field(default_factory=dict)
    status: ScenarioComparisonStatus = ScenarioComparisonStatus.COMPARABLE
    transition: Optional[BehavioralTransition] = None
    baselineDecision: Optional[AuthorizationDecision] = None
    candidateDecision: Optional[AuthorizationDecision] = None
    baselineDeterminingPolicies: List[str] = Field(default_factory=list)
    candidateDeterminingPolicies: List[str] = Field(default_factory=list)
    baselineDiagnostics: EvaluationDiagnostics = Field(default_factory=EvaluationDiagnostics)
    candidateDiagnostics: EvaluationDiagnostics = Field(default_factory=EvaluationDiagnostics)
    error: Optional[str] = None


class BoundedImpactSummary(BaseModel):
    """
    Aggregate metrics and blast radius observed across the declared scenario universe.
    """
    totalScenariosDeclared: int
    totalScenariosCompared: int
    uncomparableScenariosCount: int
    unchangedAllowCount: int
    unchangedDenyCount: int
    newlyForbiddenCount: int
    newlyAuthorizedCount: int
    baselineExecutionErrorsCount: int
    candidateExecutionErrorsCount: int

    # Percentages (0.0 to 100.0)
    comparisonCoveragePct: float
    newlyForbiddenRatePct: float
    newlyAuthorizedRatePct: float
    unchangedRatePct: float

    # Bounded Universe Delta Metrics
    deltaPrincipals: int = Field(
        ..., description="Count of unique principals affected by a behavioral decision change"
    )
    deltaActions: int = Field(
        ..., description="Count of unique actions affected by a behavioral decision change"
    )
    deltaResources: int = Field(
        ..., description="Count of unique resources affected by a behavioral decision change"
    )
    affectedPrincipals: List[str] = Field(default_factory=list)
    affectedActions: List[str] = Field(default_factory=list)
    affectedResources: List[str] = Field(default_factory=list)

    # Transparency metadata
    isBoundedUniverse: bool = True
    boundaryStatement: str = (
        "Analysis is strictly bounded by the declared scenario universe and entity fixtures. "
        "It does not establish universal mathematical equivalence across infinite states."
    )


class PolicyDiffRequest(BaseModel):
    """
    Request payload for comparing baseline vs. candidate policy sets.
    """
    baselinePolicyText: str = Field(..., description="Baseline (production) Cedar policy set")
    candidatePolicyText: str = Field(..., description="Proposed candidate Cedar policy set")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Shared entity graph")
    suite: ScenarioSuite = Field(..., description="Scenario suite for equivalent comparison")
    baselineLabel: str = Field(default="Baseline (v12)", description="Baseline policy label")
    candidateLabel: str = Field(default="Candidate (v13)", description="Candidate policy label")


class PolicyDiffReport(BaseModel):
    """
    Comprehensive, deterministic report of policy behavioral differences and bounded blast radius.
    """
    reportId: str
    timestamp: str
    engine: str = "cedar-wasm@4.13.0"
    baselineLabel: str
    candidateLabel: str
    impactSummary: BoundedImpactSummary
    scenarioDiffs: List[ScenarioDiffResult] = Field(default_factory=list)
    newlyAuthorizedScenarios: List[ScenarioDiffResult] = Field(default_factory=list)
    newlyForbiddenScenarios: List[ScenarioDiffResult] = Field(default_factory=list)
