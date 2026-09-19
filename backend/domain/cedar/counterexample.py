"""
PolicyLab Counterexample Engine
Extracts deterministic counterexamples from behavioral diff transitions and
provides reproducible counterexample replay verification.
"""

from typing import Any, Dict, List, Optional

from .evaluation import CedarEvaluationService
from ..models.authz import (
    AuthorizationDecision,
    AuthorizationRequest,
)
from ..models.contract import SecurityContract
from ..models.counterexample import (
    Counterexample,
    CounterexampleReplayRequest,
    CounterexampleReplayResult,
)
from ..models.diff import (
    BehavioralTransition,
    ScenarioComparisonStatus,
    ScenarioDiffResult,
)


class CounterexampleEngine:
    """
    Deterministic engine that isolates concrete authorization counterexamples
    from policy comparison transitions and verifies their reproducibility.
    """

    def __init__(self, evaluation_service: Optional[CedarEvaluationService] = None):
        self.evaluation_service = evaluation_service or CedarEvaluationService()

    def extract_counterexamples(
        self,
        scenario_diffs: List[ScenarioDiffResult],
        contracts: Optional[List[SecurityContract]] = None,
        baseline_label: str = "Baseline",
        candidate_label: str = "Candidate",
        entities: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Counterexample]:
        """
        Extracts concrete counterexamples from comparable scenarios exhibiting behavioral change.
        """
        counterexamples: List[Counterexample] = []
        contracts_by_scenario: Dict[str, SecurityContract] = {}

        if contracts:
            for c in contracts:
                for sid in c.scenarioIds:
                    contracts_by_scenario[sid] = c

        for diff in scenario_diffs:
            if diff.status != ScenarioComparisonStatus.COMPARABLE:
                continue

            if diff.transition not in (
                BehavioralTransition.NEWLY_AUTHORIZED,
                BehavioralTransition.NEWLY_FORBIDDEN,
            ):
                continue

            contract = contracts_by_scenario.get(diff.scenarioId)
            violated_contract_id = contract.id if contract else None
            violated_contract_title = contract.title if contract else None
            severity = contract.severity.value if contract else ("HIGH" if diff.transition == BehavioralTransition.NEWLY_AUTHORIZED else "MEDIUM")

            # Deterministic explanation
            if diff.transition == BehavioralTransition.NEWLY_AUTHORIZED:
                policies_str = (
                    f" (Determining policies: {', '.join(diff.candidateDeterminingPolicies)})"
                    if diff.candidateDeterminingPolicies
                    else ""
                )
                explanation = (
                    f"Behavioral Expansion (DENY -> ALLOW): Scenario '{diff.scenarioTitle or diff.scenarioId}' "
                    f"was DENIED under {baseline_label} but became PERMITTED under {candidate_label}{policies_str}."
                )
            else:
                policies_str = (
                    f" (Baseline determining policies: {', '.join(diff.baselineDeterminingPolicies)})"
                    if diff.baselineDeterminingPolicies
                    else ""
                )
                explanation = (
                    f"Behavioral Restriction (ALLOW -> DENY): Scenario '{diff.scenarioTitle or diff.scenarioId}' "
                    f"was PERMITTED under {baseline_label}{policies_str} but became DENIED under {candidate_label}."
                )

            if violated_contract_title:
                explanation += f" This violates Security Contract '{violated_contract_id}: {violated_contract_title}'."

            cx = Counterexample(
                id=f"cx_{diff.scenarioId}",
                scenarioId=diff.scenarioId,
                scenarioTitle=diff.scenarioTitle,
                principal=diff.principal,
                action=diff.action,
                resource=diff.resource,
                context=diff.context,
                baselinePolicyRef=baseline_label,
                candidatePolicyRef=candidate_label,
                baselineDecision=diff.baselineDecision or AuthorizationDecision.DENY,
                candidateDecision=diff.candidateDecision or AuthorizationDecision.DENY,
                transition=diff.transition,
                baselineDeterminingPolicies=diff.baselineDeterminingPolicies,
                candidateDeterminingPolicies=diff.candidateDeterminingPolicies,
                baselineDiagnostics=diff.baselineDiagnostics,
                candidateDiagnostics=diff.candidateDiagnostics,
                entitiesSnapshot=entities,
                explanation=explanation,
                violatedContractId=violated_contract_id,
                violatedContractTitle=violated_contract_title,
                severity=severity,
            )
            counterexamples.append(cx)

        return counterexamples

    def replay_counterexample(
        self, request: CounterexampleReplayRequest
    ) -> CounterexampleReplayResult:
        """
        Re-executes the exact scenario vector of a counterexample against both baseline
        and candidate policies using the live Cedar runtime path, verifying reproducibility.
        """
        cx = request.counterexample
        entities = request.entities or cx.entitiesSnapshot or []

        # 1. Replay against Baseline
        base_req = AuthorizationRequest(
            principal=cx.principal,
            action=cx.action,
            resource=cx.resource,
            context=cx.context,
            policyText=request.baselinePolicyText,
            schemaText=request.schemaText,
            entities=entities,
        )

        try:
            base_evidence = self.evaluation_service.evaluate(base_req)
            replayed_base_dec = base_evidence.decision
        except Exception as ex:
            return CounterexampleReplayResult(
                counterexampleId=cx.id,
                scenarioId=cx.scenarioId,
                isReproduced=False,
                recordedBaselineDecision=cx.baselineDecision,
                recordedCandidateDecision=cx.candidateDecision,
                mismatchReason=f"Baseline replay execution error: {str(ex)}",
            )

        # 2. Replay against Candidate
        cand_req = AuthorizationRequest(
            principal=cx.principal,
            action=cx.action,
            resource=cx.resource,
            context=cx.context,
            policyText=request.candidatePolicyText,
            schemaText=request.schemaText,
            entities=entities,
        )

        try:
            cand_evidence = self.evaluation_service.evaluate(cand_req)
            replayed_cand_dec = cand_evidence.decision
        except Exception as ex:
            return CounterexampleReplayResult(
                counterexampleId=cx.id,
                scenarioId=cx.scenarioId,
                isReproduced=False,
                recordedBaselineDecision=cx.baselineDecision,
                recordedCandidateDecision=cx.candidateDecision,
                replayedBaselineDecision=replayed_base_dec,
                mismatchReason=f"Candidate replay execution error: {str(ex)}",
            )

        # 3. Classify replayed transition
        if replayed_base_dec == AuthorizationDecision.DENY and replayed_cand_dec == AuthorizationDecision.ALLOW:
            replayed_trans = BehavioralTransition.NEWLY_AUTHORIZED
        elif replayed_base_dec == AuthorizationDecision.ALLOW and replayed_cand_dec == AuthorizationDecision.DENY:
            replayed_trans = BehavioralTransition.NEWLY_FORBIDDEN
        elif replayed_base_dec == AuthorizationDecision.ALLOW and replayed_cand_dec == AuthorizationDecision.ALLOW:
            replayed_trans = BehavioralTransition.UNCHANGED_ALLOW
        else:
            replayed_trans = BehavioralTransition.UNCHANGED_DENY

        # 4. Compare with recorded counterexample
        is_reproduced = (
            replayed_base_dec == cx.baselineDecision
            and replayed_cand_dec == cx.candidateDecision
            and replayed_trans == cx.transition
        )

        mismatch_reason = None
        if not is_reproduced:
            mismatch_reason = (
                f"Replay decision mismatch: recorded ({cx.baselineDecision} -> {cx.candidateDecision}, {cx.transition.value}), "
                f"but replayed ({replayed_base_dec} -> {replayed_cand_dec}, {replayed_trans.value})."
            )

        return CounterexampleReplayResult(
            counterexampleId=cx.id,
            scenarioId=cx.scenarioId,
            isReproduced=is_reproduced,
            recordedBaselineDecision=cx.baselineDecision,
            recordedCandidateDecision=cx.candidateDecision,
            replayedBaselineDecision=replayed_base_dec,
            replayedCandidateDecision=replayed_cand_dec,
            replayedTransition=replayed_trans,
            mismatchReason=mismatch_reason,
            baselineEvidence=base_evidence,
            candidateEvidence=cand_evidence,
        )
