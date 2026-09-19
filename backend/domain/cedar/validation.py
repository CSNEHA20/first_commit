"""
PolicyLab Policy Validation Service
Validates Cedar policies and returns structured diagnostics.
"""

from typing import Optional
from .engine import ICedarEngine, LocalCedarAdapter
from ..models.authz import ValidationResult


class CedarValidationService:
    def __init__(self, engine: Optional[ICedarEngine] = None):
        self.engine = engine or LocalCedarAdapter()

    def validate(
        self, policy_text: str, schema_text: Optional[str] = None
    ) -> ValidationResult:
        if not policy_text or not policy_text.strip():
            return ValidationResult(
                isValid=False,
                errors=[{"message": "Policy text cannot be empty", "severity": "error"}],  # type: ignore
                warnings=[],
                engine="cedar-validation-service",
            )
        return self.engine.validate_policy(policy_text, schema_text)
