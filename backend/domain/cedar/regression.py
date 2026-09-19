"""
PolicyLab Regression Engine
Coordinates deterministic diff analysis, counterexample extraction, security contract verification,
and computes pre-deployment verification gate decisions.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from .contract import SecurityContractService
from .counterexample import CounterexampleEngine
from .diff import CedarPolicyDiffService
from .validation import CedarValidationService
from ..models.contract import ContractStatus
from ..models.diff import PolicyDiffRequest, ScenarioComparisonStatus
from ..models.regression import (
    DeploymentGateStatus,
    RegressionGateDecision,
    RegressionReport,
    RegressionRunRequest,
)


class RegressionEngine:
    """
    Deterministic regression and pre-deployment gate engine.
    """

    def __init__(
        self,
        diff_service: Optional[CedarPolicyDiffService] = None,
        counterexample_engine: Optional[CounterexampleEngine] = None,
        contract_service: Optional[SecurityContractService] = None,
        validation_service: Optional[CedarValidationService] = None,
    ):
        self.diff_service = diff_service or CedarPolicyDiffService()
        self.counterexample_engine = counterexample_engine or CounterexampleEngine()
        self.contract_service = contract_service or SecurityContractService()
        self.validation_service = validation_service or CedarValidationService()

    def run_regression(self, request: RegressionRunRequest) -> RegressionReport:
        """
        Executes an end-to-end regression evaluation between baseline and candidate policies.
        """
        # 1. Validate baseline policy syntax
        if not request.baselinePolicyText or not request.baselinePolicyText.strip():
            raise ValueError("Baseline policy text cannot be empty.")
        val_baseline = self.validation_service.validate(
            policy_text=request.baselinePolicyText, schema_text=request.schemaText
        )
        if not val_baseline.isValid:
            err_msg = "; ".join(e.message for e in val_baseline.errors)
            raise ValueError(f"Baseline policy syntax error: {err_msg}")

        # 2. Validate candidate policy syntax
        if not request.candidatePolicyText or not request.candidatePolicyText.strip():
            raise ValueError("Candidate policy text cannot be empty.")
        val_candidate = self.validation_service.validate(
            policy_text=request.candidatePolicyText, schema_text=request.schemaText
        )
        if not val_candidate.isValid:
            err_msg = "; ".join(e.message for e in val_candidate.errors)
            raise ValueError(f"Candidate policy syntax error: {err_msg}")

        # 3. Perform policy diff
        diff_request = PolicyDiffRequest(
            baselinePolicyText=request.baselinePolicyText,
            candidatePolicyText=request.candidatePolicyText,
            schemaText=request.schemaText,
            entities=request.entities,
            suite=request.suite,
            baselineLabel=request.baselineLabel,
            candidateLabel=request.candidateLabel,
        )
        diff_report = self.diff_service.compare(diff_request)

        # 4. Extract counterexamples
        counterexamples = self.counterexample_engine.extract_counterexamples(
            scenario_diffs=diff_report.scenarioDiffs,
            contracts=request.contracts,
            baseline_label=request.baselineLabel,
            candidate_label=request.candidateLabel,
            entities=request.entities,
        )

        # 5. Evaluate security contracts
        contract_results = self.contract_service.evaluate_against_diff(
            contracts=request.contracts,
            scenario_diffs=diff_report.scenarioDiffs,
            counterexamples=counterexamples,
        )

        # 6. Evaluate deployment gate decision
        gate_reasons = []
        blocking_violations = [
            c for c in contract_results if c.isBlocking and c.status == ContractStatus.FAIL
        ]
        non_blocking_violations = [
            c for c in contract_results if not c.isBlocking and c.status == ContractStatus.FAIL
        ]
        uncomparable_contracts = [
            c for c in contract_results if c.status == ContractStatus.UNCOMPARABLE
        ]
        uncomparable_scenarios_count = sum(
            1 for d in diff_report.scenarioDiffs if d.status == ScenarioComparisonStatus.UNCOMPARABLE
        )
        total_execution_errors = (
            diff_report.impactSummary.baselineExecutionErrorsCount
            + diff_report.impactSummary.candidateExecutionErrorsCount
        )

        if blocking_violations:
            gate_status = DeploymentGateStatus.BLOCKED
            is_passing = False
            for v in blocking_violations:
                gate_reasons.append(
                    f"Blocking Security Contract '{v.contractId}: {v.title}' failed ({v.severity.value}): {v.failureReason}"
                )
        elif uncomparable_scenarios_count > 0 or total_execution_errors > 0 or uncomparable_contracts:
            gate_status = DeploymentGateStatus.INCOMPLETE
            is_passing = False
            gate_reasons.append(
                f"Evaluation incomplete: {uncomparable_scenarios_count} scenario(s) uncomparable or encountered errors."
            )
        else:
            gate_status = DeploymentGateStatus.PASS
            is_passing = True
            if contract_results:
                gate_reasons.append(
                    f"All {len(contract_results)} declared security contract(s) satisfied across the scenario universe."
                )
            else:
                gate_reasons.append(
                    "No security contract violations detected across the declared scenario universe."
                )

        if non_blocking_violations:
            for nb in non_blocking_violations:
                gate_reasons.append(
                    f"Warning: Non-blocking contract '{nb.contractId}: {nb.title}' failed: {nb.failureReason}"
                )

        gate_decision = RegressionGateDecision(
            status=gate_status,
            isPassing=is_passing,
            reasons=gate_reasons,
            blockingViolationsCount=len(blocking_violations),
            nonBlockingViolationsCount=len(non_blocking_violations),
            uncomparableScenariosCount=uncomparable_scenarios_count,
            executionErrorsCount=total_execution_errors,
            requiresHumanApproval=True,
        )

        return RegressionReport(
            runId=f"reg_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            engine="cedar-wasm@4.13.0",
            baselineLabel=request.baselineLabel,
            candidateLabel=request.candidateLabel,
            diffReport=diff_report,
            counterexamples=counterexamples,
            contractResults=contract_results,
            gateDecision=gate_decision,
        )
