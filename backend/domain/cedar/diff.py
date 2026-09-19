"""
PolicyLab Policy Diff Service
Orchestrates deterministic policy comparison, behavioral transition classification,
and bounded impact analysis between baseline and candidate Cedar policy sets.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from .runner import ScenarioRunner
from .validation import CedarValidationService
from ..models.authz import AuthorizationDecision
from ..models.diff import (
    BehavioralTransition,
    BoundedImpactSummary,
    PolicyDiffReport,
    PolicyDiffRequest,
    ScenarioComparisonStatus,
    ScenarioDiffResult,
)
from ..models.scenario import ScenarioExecutionStatus


class CedarPolicyDiffService:
    """
    Deterministic comparison engine that evaluates the exact same declared scenario suite
    against baseline and candidate policy sets, producing a bounded impact matrix.
    """

    def __init__(
        self,
        scenario_runner: Optional[ScenarioRunner] = None,
        validation_service: Optional[CedarValidationService] = None,
    ):
        self.scenario_runner = scenario_runner or ScenarioRunner()
        self.validation_service = validation_service or CedarValidationService()

    def compare(self, request: PolicyDiffRequest) -> PolicyDiffReport:
        """
        Executes policy comparison and computes bounded blast radius metrics.
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

        # 3. Handle empty scenario suite
        if not request.suite.scenarios:
            impact_summary = BoundedImpactSummary(
                totalScenariosDeclared=0,
                totalScenariosCompared=0,
                uncomparableScenariosCount=0,
                unchangedAllowCount=0,
                unchangedDenyCount=0,
                newlyForbiddenCount=0,
                newlyAuthorizedCount=0,
                baselineExecutionErrorsCount=0,
                candidateExecutionErrorsCount=0,
                comparisonCoveragePct=0.0,
                newlyForbiddenRatePct=0.0,
                newlyAuthorizedRatePct=0.0,
                unchangedRatePct=0.0,
                deltaPrincipals=0,
                deltaActions=0,
                deltaResources=0,
                affectedPrincipals=[],
                affectedActions=[],
                affectedResources=[],
            )
            return PolicyDiffReport(
                reportId=f"diff_{uuid.uuid4().hex[:8]}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                engine="cedar-wasm@4.13.0",
                baselineLabel=request.baselineLabel,
                candidateLabel=request.candidateLabel,
                impactSummary=impact_summary,
                scenarioDiffs=[],
                newlyAuthorizedScenarios=[],
                newlyForbiddenScenarios=[],
            )

        # 4. Execute baseline and candidate runs
        baseline_run = self.scenario_runner.run_suite(
            policy_text=request.baselinePolicyText,
            suite=request.suite,
            schema_text=request.schemaText,
            entities=request.entities,
        )

        candidate_run = self.scenario_runner.run_suite(
            policy_text=request.candidatePolicyText,
            suite=request.suite,
            schema_text=request.schemaText,
            entities=request.entities,
        )

        # 5. Result alignment by stable scenario ID
        baseline_map = {r.scenarioId: r for r in baseline_run.results}
        candidate_map = {r.scenarioId: r for r in candidate_run.results}

        scenario_diffs: List[ScenarioDiffResult] = []

        for sc in request.suite.scenarios:
            b_res = baseline_map.get(sc.id)
            c_res = candidate_map.get(sc.id)

            if b_res is None or c_res is None:
                scenario_diffs.append(
                    ScenarioDiffResult(
                        scenarioId=sc.id,
                        scenarioTitle=sc.title,
                        principal=sc.principal,
                        action=sc.action,
                        resource=sc.resource,
                        context=sc.context,
                        status=ScenarioComparisonStatus.UNCOMPARABLE,
                        transition=None,
                        error="Missing scenario result in baseline or candidate run",
                    )
                )
            elif (
                b_res.status == ScenarioExecutionStatus.EXECUTION_ERROR
                or c_res.status == ScenarioExecutionStatus.EXECUTION_ERROR
            ):
                errs = []
                if b_res.status == ScenarioExecutionStatus.EXECUTION_ERROR:
                    errs.append(f"Baseline error: {b_res.error}")
                if c_res.status == ScenarioExecutionStatus.EXECUTION_ERROR:
                    errs.append(f"Candidate error: {c_res.error}")
                scenario_diffs.append(
                    ScenarioDiffResult(
                        scenarioId=sc.id,
                        scenarioTitle=sc.title,
                        principal=sc.principal,
                        action=sc.action,
                        resource=sc.resource,
                        context=sc.context,
                        status=ScenarioComparisonStatus.UNCOMPARABLE,
                        transition=None,
                        baselineDecision=b_res.decision,
                        candidateDecision=c_res.decision,
                        baselineDeterminingPolicies=b_res.determiningPolicies,
                        candidateDeterminingPolicies=c_res.determiningPolicies,
                        baselineDiagnostics=b_res.diagnostics,
                        candidateDiagnostics=c_res.diagnostics,
                        error="; ".join(errs),
                    )
                )
            else:
                b_dec = b_res.decision
                c_dec = c_res.decision

                if b_dec == AuthorizationDecision.ALLOW and c_dec == AuthorizationDecision.ALLOW:
                    transition = BehavioralTransition.UNCHANGED_ALLOW
                elif b_dec == AuthorizationDecision.DENY and c_dec == AuthorizationDecision.DENY:
                    transition = BehavioralTransition.UNCHANGED_DENY
                elif b_dec == AuthorizationDecision.ALLOW and c_dec == AuthorizationDecision.DENY:
                    transition = BehavioralTransition.NEWLY_FORBIDDEN
                elif b_dec == AuthorizationDecision.DENY and c_dec == AuthorizationDecision.ALLOW:
                    transition = BehavioralTransition.NEWLY_AUTHORIZED
                else:
                    transition = BehavioralTransition.UNCHANGED_DENY

                scenario_diffs.append(
                    ScenarioDiffResult(
                        scenarioId=sc.id,
                        scenarioTitle=sc.title,
                        principal=sc.principal,
                        action=sc.action,
                        resource=sc.resource,
                        context=sc.context,
                        status=ScenarioComparisonStatus.COMPARABLE,
                        transition=transition,
                        baselineDecision=b_dec,
                        candidateDecision=c_dec,
                        baselineDeterminingPolicies=b_res.determiningPolicies,
                        candidateDeterminingPolicies=c_res.determiningPolicies,
                        baselineDiagnostics=b_res.diagnostics,
                        candidateDiagnostics=c_res.diagnostics,
                        error=None,
                    )
                )

        # 6. Aggregate counts & bounded metrics
        total_declared = len(request.suite.scenarios)
        total_compared = sum(
            1 for d in scenario_diffs if d.status == ScenarioComparisonStatus.COMPARABLE
        )
        uncomparable_count = sum(
            1 for d in scenario_diffs if d.status == ScenarioComparisonStatus.UNCOMPARABLE
        )
        unchanged_allow = sum(
            1 for d in scenario_diffs if d.transition == BehavioralTransition.UNCHANGED_ALLOW
        )
        unchanged_deny = sum(
            1 for d in scenario_diffs if d.transition == BehavioralTransition.UNCHANGED_DENY
        )
        newly_forbidden = sum(
            1 for d in scenario_diffs if d.transition == BehavioralTransition.NEWLY_FORBIDDEN
        )
        newly_authorized = sum(
            1 for d in scenario_diffs if d.transition == BehavioralTransition.NEWLY_AUTHORIZED
        )

        coverage_pct = (
            round((total_compared / total_declared * 100), 2) if total_declared > 0 else 0.0
        )
        forbidden_rate_pct = (
            round((newly_forbidden / total_compared * 100), 2) if total_compared > 0 else 0.0
        )
        authorized_rate_pct = (
            round((newly_authorized / total_compared * 100), 2) if total_compared > 0 else 0.0
        )
        unchanged_rate_pct = (
            round(((unchanged_allow + unchanged_deny) / total_compared * 100), 2)
            if total_compared > 0
            else 0.0
        )

        changed_scenarios = [
            d
            for d in scenario_diffs
            if d.transition
            in (BehavioralTransition.NEWLY_AUTHORIZED, BehavioralTransition.NEWLY_FORBIDDEN)
        ]
        affected_principals = sorted(list(set(d.principal for d in changed_scenarios)))
        affected_actions = sorted(list(set(d.action for d in changed_scenarios)))
        affected_resources = sorted(list(set(d.resource for d in changed_scenarios)))

        impact_summary = BoundedImpactSummary(
            totalScenariosDeclared=total_declared,
            totalScenariosCompared=total_compared,
            uncomparableScenariosCount=uncomparable_count,
            unchangedAllowCount=unchanged_allow,
            unchangedDenyCount=unchanged_deny,
            newlyForbiddenCount=newly_forbidden,
            newlyAuthorizedCount=newly_authorized,
            baselineExecutionErrorsCount=baseline_run.errorCount,
            candidateExecutionErrorsCount=candidate_run.errorCount,
            comparisonCoveragePct=coverage_pct,
            newlyForbiddenRatePct=forbidden_rate_pct,
            newlyAuthorizedRatePct=authorized_rate_pct,
            unchangedRatePct=unchanged_rate_pct,
            deltaPrincipals=len(affected_principals),
            deltaActions=len(affected_actions),
            deltaResources=len(affected_resources),
            affectedPrincipals=affected_principals,
            affectedActions=affected_actions,
            affectedResources=affected_resources,
        )

        newly_auth_list = [
            d for d in scenario_diffs if d.transition == BehavioralTransition.NEWLY_AUTHORIZED
        ]
        newly_forbid_list = [
            d for d in scenario_diffs if d.transition == BehavioralTransition.NEWLY_FORBIDDEN
        ]

        return PolicyDiffReport(
            reportId=f"diff_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            engine="cedar-wasm@4.13.0",
            baselineLabel=request.baselineLabel,
            candidateLabel=request.candidateLabel,
            impactSummary=impact_summary,
            scenarioDiffs=scenario_diffs,
            newlyAuthorizedScenarios=newly_auth_list,
            newlyForbiddenScenarios=newly_forbid_list,
        )
