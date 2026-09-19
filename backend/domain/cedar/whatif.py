"""
PolicyLab What-If Simulator Service (P1 Feature - Stage J2)
Evaluates proposed authorization changes against declared baseline policy and scenario suite.
Computes impact summary: delta actions, delta resources, delta principals, and resulting gate state.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from ..models.diff import PolicyDiffReport, PolicyDiffRequest
from ..models.regression import DeploymentGateStatus, RegressionReport, RegressionRunRequest
from ..models.scenario import ScenarioSuite
from .diff import CedarPolicyDiffService
from .regression import RegressionEngine


class WhatIfImpactSummary(BaseModel):
    deltaPrincipals: int
    deltaActions: int
    deltaResources: int
    newlyPermittedCount: int
    newlyForbiddenCount: int
    gateStatus: DeploymentGateStatus
    reasons: List[str] = Field(default_factory=list)


class WhatIfSimulationResponse(BaseModel):
    summary: str
    impact: WhatIfImpactSummary
    newlyPermittedVectors: List[Dict[str, str]] = Field(default_factory=list)
    newlyForbiddenVectors: List[Dict[str, str]] = Field(default_factory=list)
    isEligibleForDeployment: bool


class WhatIfSimulatorService:
    """
    Evaluates proposed authorization modifications before applying them to candidate policy.
    """

    def __init__(self, regression_engine: Optional[RegressionEngine] = None):
        self.regression_engine = regression_engine or RegressionEngine()

    def simulate_what_if(
        self,
        baseline_policy_text: str,
        proposed_policy_text: str,
        suite: ScenarioSuite,
        schema_text: Optional[str] = None,
        entities: Optional[List[Dict[str, Any]]] = None,
    ) -> WhatIfSimulationResponse:
        reg_req = RegressionRunRequest(
            baselinePolicyText=baseline_policy_text,
            candidatePolicyText=proposed_policy_text,
            schemaText=schema_text,
            entities=entities or [],
            suite=suite,
            baselineLabel="Current Baseline",
            candidateLabel="Proposed Change",
        )
        report = self.regression_engine.run_regression(reg_req)
        diff = report.diffReport
        impact = diff.impactSummary

        newly_permitted = [
            {"principal": sc.principal, "action": sc.action, "resource": sc.resource}
            for sc in diff.newlyAuthorizedScenarios
        ]
        newly_forbidden = [
            {"principal": sc.principal, "action": sc.action, "resource": sc.resource}
            for sc in diff.newlyForbiddenScenarios
        ]

        gate_status = report.gateDecision.status
        is_eligible = gate_status == DeploymentGateStatus.PASS

        summary = (
            f"What-If Analysis: Proposed change results in {impact.newlyAuthorizedCount} newly authorized vectors "
            f"and {impact.newlyForbiddenCount} newly forbidden vectors across {impact.deltaPrincipals} principals, "
            f"{impact.deltaActions} actions, and {impact.deltaResources} resources. "
            f"Gate status: {gate_status.value}."
        )

        impact_summary = WhatIfImpactSummary(
            deltaPrincipals=impact.deltaPrincipals,
            deltaActions=impact.deltaActions,
            deltaResources=impact.deltaResources,
            newlyPermittedCount=impact.newlyAuthorizedCount,
            newlyForbiddenCount=impact.newlyForbiddenCount,
            gateStatus=gate_status,
            reasons=report.gateDecision.reasons,
        )

        return WhatIfSimulationResponse(
            summary=summary,
            impact=impact_summary,
            newlyPermittedVectors=newly_permitted,
            newlyForbiddenVectors=newly_forbidden,
            isEligibleForDeployment=is_eligible,
        )
