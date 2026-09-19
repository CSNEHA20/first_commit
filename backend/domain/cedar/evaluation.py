"""
PolicyLab Authorization Evaluation Service
Evaluates requests against Cedar policy sets and generates Canonical Evidence payloads.
"""

from typing import Optional
from .engine import ICedarEngine, LocalCedarAdapter
from ..models.authz import AuthorizationRequest, CanonicalEvidence


class CedarEvaluationService:
    def __init__(self, engine: Optional[ICedarEngine] = None):
        self.engine = engine or LocalCedarAdapter()

    def evaluate(self, request: AuthorizationRequest) -> CanonicalEvidence:
        return self.engine.evaluate(request)
