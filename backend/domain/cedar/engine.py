"""
PolicyLab Cedar Engine Adapter
Provides clean interface separation for deterministic Cedar validation and evaluation.
"""

from abc import ABC, abstractmethod
import json
import os
import subprocess
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models.authz import (
    AuthorizationDecision,
    AuthorizationRequest,
    CanonicalEvidence,
    EvaluationDiagnostics,
    MatchedPolicy,
    SourceLocation,
    ValidationError,
    ValidationResult,
)

BRIDGE_SCRIPT_PATH = Path(__file__).parent / "cedar_bridge.js"


class ICedarEngine(ABC):
    @abstractmethod
    def validate_policy(
        self, policy_text: str, schema_text: Optional[str] = None
    ) -> ValidationResult:
        """Parses and validates Cedar policy syntax and schema constraints."""
        pass

    @abstractmethod
    def evaluate(self, request: AuthorizationRequest) -> CanonicalEvidence:
        """Evaluates an authorization request deterministically using Cedar."""
        pass

    @abstractmethod
    def get_version(self) -> Dict[str, str]:
        """Returns the Cedar engine and language version."""
        pass


class CedarWasmAdapter(ICedarEngine):
    """
    Adapter interfacing with official AWS Cedar WASM engine via Node.js runtime.
    Guarantees 100% deterministic, official Cedar language semantics.
    """

    def __init__(self, node_executable: str = "node"):
        self.node_executable = node_executable
        self.bridge_path = str(BRIDGE_SCRIPT_PATH.resolve())

    def _invoke_bridge(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Executes the Cedar bridge via stdin/stdout JSON streaming."""
        try:
            input_json = json.dumps(payload)
            result = subprocess.run(
                [self.node_executable, self.bridge_path],
                input=input_json,
                capture_output=True,
                text=True,
                check=True,
                timeout=10,
            )
            return json.loads(result.stdout)
        except subprocess.TimeoutExpired:
            return {
                "isValid": False,
                "success": False,
                "errors": [{"message": "Cedar engine evaluation timed out"}],
                "decision": "DENY",
                "diagnostics": {"errors": ["Cedar evaluation timed out"]},
            }
        except Exception as ex:
            return {
                "isValid": False,
                "success": False,
                "errors": [{"message": f"Cedar engine execution error: {str(ex)}"}],
                "decision": "DENY",
                "diagnostics": {"errors": [f"Cedar engine error: {str(ex)}"]},
            }

    def validate_policy(
        self, policy_text: str, schema_text: Optional[str] = None
    ) -> ValidationResult:
        payload = {
            "operation": "validate",
            "policyText": policy_text,
            "schema": schema_text,
        }
        res = self._invoke_bridge(payload)

        errors: List[ValidationError] = []
        for err in res.get("errors", []):
            locations = [
                SourceLocation(
                    start=loc.get("start", 0),
                    end=loc.get("end", 0),
                    label=loc.get("label"),
                )
                for loc in err.get("sourceLocations", [])
            ]
            errors.append(
                ValidationError(
                    message=err.get("message", "Unknown error"),
                    help=err.get("help"),
                    code=err.get("code"),
                    severity=err.get("severity", "error"),
                    sourceLocations=locations,
                )
            )

        warnings: List[ValidationError] = []
        for warn in res.get("warnings", []):
            warnings.append(
                ValidationError(
                    message=warn.get("message", "Warning"),
                    help=warn.get("help"),
                    code=warn.get("code"),
                    severity=warn.get("severity", "warning"),
                    sourceLocations=[],
                )
            )

        return ValidationResult(
            isValid=res.get("isValid", False),
            errors=errors,
            warnings=warnings,
            engine=res.get("engine", "cedar-wasm@4.13.0"),
        )

    def evaluate(self, request: AuthorizationRequest) -> CanonicalEvidence:
        payload = {
            "operation": "evaluate",
            "principal": request.principal,
            "action": request.action,
            "resource": request.resource,
            "context": request.context,
            "policyText": request.policyText,
            "schema": request.schemaText,
            "entities": request.entities,
        }
        res = self._invoke_bridge(payload)

        decision_str = res.get("decision", "DENY")
        decision = (
            AuthorizationDecision.ALLOW
            if decision_str == "ALLOW"
            else AuthorizationDecision.DENY
        )

        matched_policies = [
            MatchedPolicy(
                policyId=mp.get("policyId", "unknown"),
                effect=mp.get("effect", "permit"),
                clause=mp.get("clause", ""),
                lineNumber=mp.get("lineNumber"),
            )
            for mp in res.get("matchedPolicies", [])
        ]

        diagnostics_data = res.get("diagnostics", {})
        diagnostics = EvaluationDiagnostics(
            errors=diagnostics_data.get("errors", []),
            warnings=diagnostics_data.get("warnings", []),
        )

        return CanonicalEvidence(
            evidenceId=f"ev_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            engine=res.get("engine", "cedar-wasm@4.13.0"),
            evaluationMode="DETERMINISTIC",
            request={
                "principal": request.principal,
                "action": request.action,
                "resource": request.resource,
                "context": request.context,
            },
            decision=decision,
            matchedPolicies=matched_policies,
            determiningPolicies=res.get("determiningPolicies", []),
            diagnostics=diagnostics,
            executionDurationMs=res.get("executionDurationMs", 0.0),
        )

    def get_version(self) -> Dict[str, str]:
        payload = {"operation": "version"}
        return self._invoke_bridge(payload)


# Default local adapter
LocalCedarAdapter = CedarWasmAdapter
