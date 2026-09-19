"""
PolicyLab Domain Models for Authorization Verification
Complies with Canonical Evidence Model specification (docs/SPEC.md).
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AuthorizationDecision(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"


class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class SourceLocation(BaseModel):
    start: int
    end: int
    label: Optional[str] = None


class ValidationError(BaseModel):
    message: str
    help: Optional[str] = None
    code: Optional[str] = None
    severity: str = "error"
    sourceLocations: List[SourceLocation] = Field(default_factory=list)


class ValidationResult(BaseModel):
    isValid: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)
    engine: str = "cedar-wasm@4.13.0"


class MatchedPolicy(BaseModel):
    policyId: str
    effect: str = "permit"  # permit | forbid
    clause: str = ""
    lineNumber: Optional[int] = None


class EvaluationDiagnostics(BaseModel):
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class AuthorizationRequest(BaseModel):
    principal: str = Field(..., description='e.g., User::"alice"')
    action: str = Field(..., description='e.g., Action::"view"')
    resource: str = Field(..., description='e.g., Invoice::"inv-1"')
    context: Dict[str, Any] = Field(default_factory=dict)
    policyText: str = Field(..., description="Cedar policy set text")
    schemaText: Optional[str] = Field(None, description="Optional Cedar schema text")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Cedar entities graph")


class CanonicalEvidence(BaseModel):
    """
    Standardized JSON authorization evidence payload consumed by all higher-level
    simulation, diff, blast radius, regression, and AI explanation features.
    """
    evidenceId: str
    timestamp: str
    engine: str
    evaluationMode: str = "DETERMINISTIC"
    request: Dict[str, Any]
    decision: AuthorizationDecision
    matchedPolicies: List[MatchedPolicy] = Field(default_factory=list)
    determiningPolicies: List[str] = Field(default_factory=list)
    diagnostics: EvaluationDiagnostics = Field(default_factory=EvaluationDiagnostics)
    executionDurationMs: float


class PolicyValidationRequest(BaseModel):
    policyText: str = Field(..., description="Raw Cedar policy code to validate")
    schemaText: Optional[str] = Field(None, description="Optional schema for type checking")


class PolicyValidationResponse(BaseModel):
    isValid: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)
    engine: str
