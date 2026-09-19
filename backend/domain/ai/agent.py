"""
PolicyLab Strands Policy Audit Agent (Stage G)
Agent Identity: PolicyAuditAgent
Orchestrates the 9-stage authorization security audit using deterministic tools:
validate_policy -> calculate_semantic_diff -> find_counterexamples ->
get_security_contracts -> run_regression_suite -> grounded_bedrock_explanation.
CRITICAL: Deterministic Cedar tools own the authorization truth.
The Strands agent orchestrates and reports, but can NEVER override contract failures
or approve production deployment.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from ..cedar.contract import SecurityContractService
from ..cedar.counterexample import CounterexampleEngine
from ..cedar.diff import CedarPolicyDiffService
from ..cedar.regression import RegressionEngine
from ..cedar.validation import CedarValidationService
from ..models.contract import ContractStatus, SecurityContract
from ..models.counterexample import Counterexample
from ..models.diff import PolicyDiffReport, PolicyDiffRequest
from ..models.explanation import AIExplanationRequest, AIExplanationResponse
from ..models.regression import DeploymentGateStatus, RegressionReport, RegressionRunRequest
from ..models.scenario import ScenarioSuite
from .explanation import AIExplanationService


class AuditRunStatus(str, Enum):
    COMPLETED_PASS = "COMPLETED_PASS"
    COMPLETED_BLOCKED = "COMPLETED_BLOCKED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    EXECUTION_ERROR = "EXECUTION_ERROR"


class AuditWorkflowReport(BaseModel):
    """Structured audit report produced by PolicyAuditAgent."""
    auditRunId: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    agentIdentity: str = "PolicyAuditAgent"
    status: AuditRunStatus
    gateDecision: DeploymentGateStatus
    summary: str
    validationReport: Dict[str, Any]
    diffReport: Optional[PolicyDiffReport] = None
    counterexamples: List[Counterexample] = Field(default_factory=list)
    contractResults: List[Dict[str, Any]] = Field(default_factory=list)
    regressionReport: Optional[RegressionReport] = None
    aiExplanations: List[AIExplanationResponse] = Field(default_factory=list)
    toolInvocations: List[Dict[str, Any]] = Field(default_factory=list)
    evidenceLedger: Dict[str, Any] = Field(default_factory=dict)


class PolicyAuditAgent:
    """
    Strands orchestration agent coordinating verification tools and synthesizing findings.
    """

    def __init__(
        self,
        validation_service: Optional[CedarValidationService] = None,
        diff_service: Optional[CedarPolicyDiffService] = None,
        counterexample_engine: Optional[CounterexampleEngine] = None,
        contract_service: Optional[SecurityContractService] = None,
        regression_engine: Optional[RegressionEngine] = None,
        explanation_service: Optional[AIExplanationService] = None,
    ):
        self.validation_service = validation_service or CedarValidationService()
        self.diff_service = diff_service or CedarPolicyDiffService()
        self.counterexample_engine = counterexample_engine or CounterexampleEngine()
        self.contract_service = contract_service or SecurityContractService()
        self.regression_engine = regression_engine or RegressionEngine()
        self.explanation_service = explanation_service or AIExplanationService()

    def execute_audit(
        self,
        baseline_policy_text: str,
        candidate_policy_text: str,
        suite: ScenarioSuite,
        contracts: Optional[List[SecurityContract]] = None,
        schema_text: Optional[str] = None,
        entities: Optional[List[Dict[str, Any]]] = None,
        baseline_label: str = "Baseline Production (v12)",
        candidate_label: str = "Candidate Release (v13)",
        run_ai_explanation: bool = True,
    ) -> AuditWorkflowReport:
        import uuid
        audit_id = f"audit_{uuid.uuid4().hex[:8]}"
        tool_invocations: List[Dict[str, Any]] = []

        # Tool 1: validate_policy (Candidate)
        t1_start = datetime.now(timezone.utc).isoformat()
        cand_val = self.validation_service.validate(candidate_policy_text, schema_text)
        tool_invocations.append({
            "tool": "validate_policy",
            "target": "candidate",
            "success": cand_val.isValid,
            "timestamp": t1_start,
        })
        if not cand_val.isValid:
            return AuditWorkflowReport(
                auditRunId=audit_id,
                status=AuditRunStatus.VALIDATION_FAILED,
                gateDecision=DeploymentGateStatus.BLOCKED,
                summary=f"Audit halted: Candidate policy failed Cedar syntax validation with {len(cand_val.errors)} errors.",
                validationReport={"candidateValid": False, "errors": [e.message for e in cand_val.errors]},
                toolInvocations=tool_invocations,
            )

        # Tool 2: validate_policy (Baseline)
        t2_start = datetime.now(timezone.utc).isoformat()
        base_val = self.validation_service.validate(baseline_policy_text, schema_text)
        tool_invocations.append({
            "tool": "validate_policy",
            "target": "baseline",
            "success": base_val.isValid,
            "timestamp": t2_start,
        })
        if not base_val.isValid:
            return AuditWorkflowReport(
                auditRunId=audit_id,
                status=AuditRunStatus.VALIDATION_FAILED,
                gateDecision=DeploymentGateStatus.BLOCKED,
                summary="Audit halted: Baseline policy failed Cedar syntax validation.",
                validationReport={"baselineValid": False, "errors": [e.message for e in base_val.errors]},
                toolInvocations=tool_invocations,
            )

        # Tool 3 & 4: run_regression_suite (Calculates diff, counterexamples, contracts, gate)
        t3_start = datetime.now(timezone.utc).isoformat()
        reg_req = RegressionRunRequest(
            baselinePolicyText=baseline_policy_text,
            candidatePolicyText=candidate_policy_text,
            schemaText=schema_text,
            entities=entities or [],
            suite=suite,
            contracts=contracts or [],
            baselineLabel=baseline_label,
            candidateLabel=candidate_label,
        )
        regression_report = self.regression_engine.run_regression(reg_req)
        tool_invocations.append({
            "tool": "run_regression_suite",
            "runId": regression_report.runId,
            "gateStatus": regression_report.gateDecision.status.value,
            "timestamp": t3_start,
        })

        # Tool 5: Grounded Bedrock Explanation (for critical findings)
        ai_explanations: List[AIExplanationResponse] = []
        if run_ai_explanation and regression_report.counterexamples:
            for cx in regression_report.counterexamples[:3]:  # Top 3 counterexamples
                t4_start = datetime.now(timezone.utc).isoformat()
                exp_req = AIExplanationRequest(
                    findingId=f"finding_{cx.id}",
                    scenarioId=cx.scenarioId,
                    scenarioTitle=cx.scenarioTitle,
                    principal=cx.principal,
                    action=cx.action,
                    resource=cx.resource,
                    baselineDecision=cx.baselineDecision,
                    candidateDecision=cx.candidateDecision,
                    transition=cx.transition,
                    determiningPolicies=cx.candidateDeterminingPolicies,
                    violatedContractId=cx.violatedContractId,
                    violatedContractTitle=cx.violatedContractTitle,
                    regressionRunId=regression_report.runId,
                )
                exp = self.explanation_service.explain(exp_req)
                ai_explanations.append(exp)
                tool_invocations.append({
                    "tool": "grounded_bedrock_explanation",
                    "findingId": exp_req.findingId,
                    "provider": exp.provider,
                    "timestamp": t4_start,
                })

        gate_status = regression_report.gateDecision.status
        overall_status = (
            AuditRunStatus.COMPLETED_PASS
            if gate_status == DeploymentGateStatus.PASS
            else AuditRunStatus.COMPLETED_BLOCKED
        )

        impact = regression_report.diffReport.impactSummary
        summary = (
            f"PolicyAuditAgent evaluated {impact.totalScenariosCompared} scenarios across baseline ({baseline_label}) "
            f"and candidate ({candidate_label}). Detected {impact.newlyAuthorizedCount} newly authorized and "
            f"{impact.newlyForbiddenCount} newly forbidden scenario vectors. "
            f"Deployment Gate: {gate_status.value}."
        )

        return AuditWorkflowReport(
            auditRunId=audit_id,
            status=overall_status,
            gateDecision=gate_status,
            summary=summary,
            validationReport={"candidateValid": True, "baselineValid": True},
            diffReport=regression_report.diffReport,
            counterexamples=regression_report.counterexamples,
            contractResults=[c.model_dump() for c in regression_report.contractResults],
            regressionReport=regression_report,
            aiExplanations=ai_explanations,
            toolInvocations=tool_invocations,
            evidenceLedger={
                "auditId": audit_id,
                "regressionRunId": regression_report.runId,
                "gateDecision": gate_status.value,
                "reasons": regression_report.gateDecision.reasons,
            },
        )
