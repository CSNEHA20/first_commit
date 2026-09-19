"""
PolicyLab Counterexample Domain Models
Defines models for deterministic counterexamples, behavioral evidence extraction,
and reproducible counterexample replay.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .authz import (
    AuthorizationDecision,
    CanonicalEvidence,
    EvaluationDiagnostics,
)
from .diff import BehavioralTransition


class Counterexample(BaseModel):
    """
    A concrete, reproducible counterexample tuple demonstrating a behavioral transition
    or contract violation between policy versions.
    """
    id: str = Field(..., description="Stable counterexample ID, e.g. cx_sc_05")
    scenarioId: str = Field(..., description="Reference to source scenario ID")
    scenarioTitle: Optional[str] = Field(None, description="Human-readable scenario title")
    principal: str = Field(..., description='e.g., User::"editor_bob"')
    action: str = Field(..., description='e.g., Action::"delete"')
    resource: str = Field(..., description='e.g., Invoice::"inv_9082"')
    context: Dict[str, Any] = Field(default_factory=dict, description="Scenario evaluation context")
    
    baselinePolicyRef: Optional[str] = Field(default="Baseline", description="Baseline policy label or version")
    candidatePolicyRef: Optional[str] = Field(default="Candidate", description="Candidate policy label or version")
    
    baselineDecision: AuthorizationDecision
    candidateDecision: AuthorizationDecision
    transition: BehavioralTransition
    
    baselineDeterminingPolicies: List[str] = Field(default_factory=list)
    candidateDeterminingPolicies: List[str] = Field(default_factory=list)
    
    baselineDiagnostics: EvaluationDiagnostics = Field(default_factory=EvaluationDiagnostics)
    candidateDiagnostics: EvaluationDiagnostics = Field(default_factory=EvaluationDiagnostics)
    
    entitiesSnapshot: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Snapshot of entities used during evaluation"
    )
    
    explanation: str = Field(..., description="Deterministic explanation of what the evaluations demonstrate")
    violatedContractId: Optional[str] = Field(default=None, description="ID of violated security contract if applicable")
    violatedContractTitle: Optional[str] = Field(default=None, description="Title of violated security contract")
    severity: Optional[str] = Field(default=None, description="Severity of violation (e.g. CRITICAL, HIGH, MEDIUM, LOW)")


class CounterexampleReplayRequest(BaseModel):
    """
    Request payload to deterministically rerun and verify a counterexample.
    """
    counterexample: Counterexample
    baselinePolicyText: str = Field(..., description="Baseline Cedar policy set")
    candidatePolicyText: str = Field(..., description="Candidate Cedar policy set")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Entity graph")


class CounterexampleReplayResult(BaseModel):
    """
    Result of replaying a counterexample against the live Cedar evaluation path.
    """
    counterexampleId: str
    scenarioId: str
    isReproduced: bool = Field(..., description="True if replayed decisions match the recorded counterexample")
    recordedBaselineDecision: AuthorizationDecision
    recordedCandidateDecision: AuthorizationDecision
    replayedBaselineDecision: Optional[AuthorizationDecision] = None
    replayedCandidateDecision: Optional[AuthorizationDecision] = None
    replayedTransition: Optional[BehavioralTransition] = None
    mismatchReason: Optional[str] = None
    baselineEvidence: Optional[CanonicalEvidence] = None
    candidateEvidence: Optional[CanonicalEvidence] = None
