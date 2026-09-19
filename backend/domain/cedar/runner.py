"""
PolicyLab Scenario Runner Service
Orchestrates deterministic batch execution of authorization scenario suites
against Cedar policy sets and generates structured simulation run matrices.
"""

from typing import Any, Dict, List, Optional
from .engine import ICedarEngine, LocalCedarAdapter
from ..models.authz import ValidationError
from ..models.scenario import (
    BatchSimulationRequest,
    ScenarioSuite,
    SimulationRun,
)


class ScenarioRunner:
    """
    Executes a collection of declared authorization scenarios through Cedar engine.
    Ensures:
    1. 100% deterministic, ordered evaluation.
    2. Zero LLM/AI interference in authorization decisions.
    3. Clear distinction between Cedar authorization DENY and execution failures.
    4. Accurate aggregate counters.
    """

    def __init__(self, engine: Optional[ICedarEngine] = None):
        self.engine = engine or LocalCedarAdapter()

    def run(self, request: BatchSimulationRequest) -> SimulationRun:
        """Runs a batch simulation request."""
        return self.run_suite(
            policy_text=request.policyText,
            suite=request.suite,
            schema_text=request.schemaText,
            entities=request.entities,
        )

    def run_suite(
        self,
        policy_text: str,
        suite: ScenarioSuite,
        schema_text: Optional[str] = None,
        entities: Optional[List[Dict[str, Any]]] = None,
    ) -> SimulationRun:
        """
        Executes a ScenarioSuite against a given Cedar policy set and entity context.
        """
        if not policy_text or not policy_text.strip():
            raise ValueError("Policy text cannot be empty for scenario evaluation.")

        # If suite has no scenarios, return a clean empty completed run
        if not suite.scenarios:
            import uuid
            from datetime import datetime, timezone
            from ..models.scenario import SimulationRunStatus
            return SimulationRun(
                runId=f"run_{uuid.uuid4().hex[:8]}",
                suiteId=suite.id,
                suiteName=suite.name,
                status=SimulationRunStatus.COMPLETED,
                totalScenarios=0,
                successCount=0,
                errorCount=0,
                allowCount=0,
                denyCount=0,
                passedExpectationsCount=0,
                failedExpectationsCount=0,
                executionDurationMs=0.0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                engine="cedar-wasm@4.13.0",
                results=[],
            )

        # Delegate execution to Cedar engine adapter
        return self.engine.batch_evaluate(
            policy_text=policy_text,
            suite=suite,
            schema_text=schema_text,
            entities=entities,
        )
