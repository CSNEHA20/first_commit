"""
PolicyLab Security Contract Service
Evaluates organizational security contracts against deterministic candidate policy results,
linking violations directly to concrete counterexamples.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from ..models.authz import AuthorizationDecision
from ..models.contract import (
    ContractEvaluationReport,
    ContractEvaluationRequest,
    ContractSeverity,
    ContractStatus,
    ContractType,
    SecurityContract,
    SecurityContractResult,
)
from ..models.counterexample import Counterexample
from ..models.diff import ScenarioComparisonStatus, ScenarioDiffResult
from ..models.scenario import ScenarioExecutionStatus, ScenarioResult
from .runner import ScenarioRunner
from .validation import CedarValidationService


class SecurityContractService:
    """
    Evaluates explicit authorization invariants against candidate policy scenario results.
    """

    def __init__(
        self,
        scenario_runner: Optional[ScenarioRunner] = None,
        validation_service: Optional[CedarValidationService] = None,
    ):
        self.scenario_runner = scenario_runner or ScenarioRunner()
        self.validation_service = validation_service or CedarValidationService()

    def evaluate_against_diff(
        self,
        contracts: List[SecurityContract],
        scenario_diffs: List[ScenarioDiffResult],
        counterexamples: Optional[List[Counterexample]] = None,
    ) -> List[SecurityContractResult]:
        """
        Evaluates security contracts against the results of a baseline vs. candidate diff run.
        """
        cx_map = {}
        if counterexamples:
            for cx in counterexamples:
                cx_map[cx.scenarioId] = cx.id

        diff_map = {d.scenarioId: d for d in scenario_diffs}
        results: List[SecurityContractResult] = []

        for contract in contracts:
            if not contract.isActive:
                continue

            # Identify target scenario IDs
            target_ids = list(contract.scenarioIds)
            for d in scenario_diffs:
                if d.scenarioId not in target_ids:
                    # Also match if scenario tagged or ID matches
                    pass

            # Filter diff results in scope
            scoped_diffs = [diff_map[sid] for sid in target_ids if sid in diff_map]
            
            # If scenarioIds was empty, match any diff with matching contractId or evaluate across all if invariant
            if not target_ids:
                scoped_diffs = scenario_diffs

            evaluated_count = len(scoped_diffs)
            passed_count = 0
            failed_count = 0
            uncomparable_count = 0
            violating_ids = []
            violating_cx_ids = []
            failure_reasons = []

            for diff in scoped_diffs:
                if diff.status == ScenarioComparisonStatus.UNCOMPARABLE:
                    uncomparable_count += 1
                    continue

                # Determine expected decision for this contract check
                expected = contract.expectedDecision
                if expected is None:
                    if contract.contractType == ContractType.INVARIANT_DENIED:
                        expected = AuthorizationDecision.DENY
                    elif contract.contractType == ContractType.INVARIANT_PERMITTED:
                        expected = AuthorizationDecision.ALLOW
                    else:
                        expected = AuthorizationDecision.DENY

                cand_dec = diff.candidateDecision
                if cand_dec == expected:
                    passed_count += 1
                else:
                    failed_count += 1
                    violating_ids.append(diff.scenarioId)
                    if diff.scenarioId in cx_map:
                        violating_cx_ids.append(cx_map[diff.scenarioId])
                    cand_dec_str = cand_dec.value if cand_dec else "UNKNOWN"
                    expected_str = expected.value if expected else "UNKNOWN"
                    failure_reasons.append(
                        f"Scenario '{diff.scenarioTitle or diff.scenarioId}' evaluated to {cand_dec_str} (expected {expected_str})"
                    )

            if failed_count > 0:
                status = ContractStatus.FAIL
                failure_reason_str = "; ".join(failure_reasons)
            elif uncomparable_count > 0 and evaluated_count == uncomparable_count:
                status = ContractStatus.UNCOMPARABLE
                failure_reason_str = "All scoped scenarios encountered evaluation errors or were uncomparable."
            elif uncomparable_count > 0:
                status = ContractStatus.UNCOMPARABLE
                failure_reason_str = f"{uncomparable_count} scenario(s) encountered evaluation errors."
            elif evaluated_count == 0:
                status = ContractStatus.PASS
                failure_reason_str = "No scenarios in declared suite matched this contract scope."
            else:
                status = ContractStatus.PASS
                failure_reason_str = None

            results.append(
                SecurityContractResult(
                    contractId=contract.id,
                    title=contract.title,
                    description=contract.description,
                    severity=contract.severity,
                    isBlocking=contract.isBlocking,
                    status=status,
                    evaluatedScenariosCount=evaluated_count,
                    passedScenariosCount=passed_count,
                    failedScenariosCount=failed_count,
                    uncomparableScenariosCount=uncomparable_count,
                    violatingScenarioIds=violating_ids,
                    counterexampleIds=violating_cx_ids,
                    failureReason=failure_reason_str,
                )
            )

        return results

    def evaluate_standalone(
        self, request: ContractEvaluationRequest
    ) -> ContractEvaluationReport:
        """
        Evaluates security contracts against a single policy set across a declared scenario suite.
        """
        # Validate policy
        val_res = self.validation_service.validate(
            policy_text=request.policyText, schema_text=request.schemaText
        )
        if not val_res.isValid:
            err_msg = "; ".join(e.message for e in val_res.errors)
            raise ValueError(f"Policy syntax validation error: {err_msg}")

        # Execute scenario suite
        sim_run = self.scenario_runner.run_suite(
            policy_text=request.policyText,
            suite=request.suite,
            schema_text=request.schemaText,
            entities=request.entities,
        )

        res_map = {r.scenarioId: r for r in sim_run.results}
        contract_results: List[SecurityContractResult] = []

        for contract in request.contracts:
            if not contract.isActive:
                continue

            target_ids = list(contract.scenarioIds)
            scoped_results = [res_map[sid] for sid in target_ids if sid in res_map]
            if not target_ids:
                scoped_results = sim_run.results

            evaluated_count = len(scoped_results)
            passed_count = 0
            failed_count = 0
            uncomparable_count = 0
            violating_ids = []
            failure_reasons = []

            for s_res in scoped_results:
                if s_res.status == ScenarioExecutionStatus.EXECUTION_ERROR:
                    uncomparable_count += 1
                    continue

                expected = contract.expectedDecision
                if expected is None:
                    if contract.contractType == ContractType.INVARIANT_DENIED:
                        expected = AuthorizationDecision.DENY
                    elif contract.contractType == ContractType.INVARIANT_PERMITTED:
                        expected = AuthorizationDecision.ALLOW
                    else:
                        expected = s_res.expectedDecision or AuthorizationDecision.DENY

                if s_res.decision == expected:
                    passed_count += 1
                else:
                    failed_count += 1
                    violating_ids.append(s_res.scenarioId)
                    dec_str = s_res.decision.value if s_res.decision else "UNKNOWN"
                    expected_str = expected.value if expected else "UNKNOWN"
                    failure_reasons.append(
                        f"Scenario '{s_res.scenarioTitle or s_res.scenarioId}' evaluated to {dec_str} (expected {expected_str})"
                    )

            if failed_count > 0:
                status = ContractStatus.FAIL
                failure_reason_str = "; ".join(failure_reasons)
            elif uncomparable_count > 0:
                status = ContractStatus.ERROR
                failure_reason_str = f"{uncomparable_count} scenario(s) encountered execution errors."
            else:
                status = ContractStatus.PASS
                failure_reason_str = None

            contract_results.append(
                SecurityContractResult(
                    contractId=contract.id,
                    title=contract.title,
                    description=contract.description,
                    severity=contract.severity,
                    isBlocking=contract.isBlocking,
                    status=status,
                    evaluatedScenariosCount=evaluated_count,
                    passedScenariosCount=passed_count,
                    failedScenariosCount=failed_count,
                    uncomparableScenariosCount=uncomparable_count,
                    violatingScenarioIds=violating_ids,
                    counterexampleIds=[],
                    failureReason=failure_reason_str,
                )
            )

        passed_contracts = sum(1 for c in contract_results if c.status == ContractStatus.PASS)
        failed_contracts = sum(1 for c in contract_results if c.status == ContractStatus.FAIL)
        uncomp_contracts = sum(1 for c in contract_results if c.status == ContractStatus.UNCOMPARABLE)
        error_contracts = sum(1 for c in contract_results if c.status == ContractStatus.ERROR)
        
        all_blocking_passed = not any(
            c.isBlocking and c.status in (ContractStatus.FAIL, ContractStatus.ERROR, ContractStatus.UNCOMPARABLE)
            for c in contract_results
        )

        return ContractEvaluationReport(
            reportId=f"cer_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            totalContracts=len(contract_results),
            passedContracts=passed_contracts,
            failedContracts=failed_contracts,
            uncomparableContracts=uncomp_contracts,
            errorContracts=error_contracts,
            allBlockingPassed=all_blocking_passed,
            results=contract_results,
        )
