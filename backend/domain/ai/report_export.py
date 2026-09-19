"""
PolicyLab Structured Audit Report Export Service (P1 Feature - Stage J4)
Formats comprehensive verification and audit findings into exportable JSON and Markdown reports.
Distinguishes deterministic authorization proofs from AI explanations and operator decisions.
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from .agent import AuditWorkflowReport


class AuditExportResponse(BaseModel):
    exportId: str
    format: str  # "json" or "markdown"
    generatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AuditReportExportService:
    """
    Synthesizes compliant audit artifacts from structured audit workflow reports.
    """

    def export_report(self, audit_report: AuditWorkflowReport, export_format: str = "markdown") -> AuditExportResponse:
        import uuid
        export_id = f"exp_{uuid.uuid4().hex[:8]}"

        if export_format.lower() == "json":
            content = audit_report.model_dump_json(indent=2)
        else:
            content = self._render_markdown_report(audit_report)

        return AuditExportResponse(
            exportId=export_id,
            format=export_format.lower(),
            content=content,
            metadata={
                "auditRunId": audit_report.auditRunId,
                "gateDecision": audit_report.gateDecision.value,
                "status": audit_report.status.value,
                "agentIdentity": audit_report.agentIdentity,
            },
        )

    def _render_markdown_report(self, report: AuditWorkflowReport) -> str:
        lines: List[str] = [
            f"# PolicyLab Formal Authorization Audit Report",
            f"**Audit Run ID:** `{report.auditRunId}`  ",
            f"**Timestamp:** `{report.timestamp}`  ",
            f"**Audit Agent:** `{report.agentIdentity}`  ",
            f"**Pre-Deployment Gate Decision:** `{report.gateDecision.value}`  ",
            f"**Overall Status:** `{report.status.value}`  ",
            "",
            "---",
            "",
            "## 1. Executive Summary",
            report.summary,
            "",
            "---",
            "",
            "## 2. Deterministic Verification Gate",
            f"* **Gate Decision:** `{report.gateDecision.value}`",
        ]

        if report.regressionReport:
            gate = report.regressionReport.gateDecision
            lines.append(f"* **Blocking Violations:** {gate.blockingViolationsCount}")
            lines.append(f"* **Non-Blocking Violations:** {gate.nonBlockingViolationsCount}")
            lines.append("* **Decision Reasons:**")
            for r in gate.reasons:
                lines.append(f"  - {r}")

        lines.extend([
            "",
            "---",
            "",
            "## 3. Behavioral Diff & Blast Radius Analysis",
        ])

        if report.diffReport:
            impact = report.diffReport.impactSummary
            lines.extend([
                f"* **Total Scenarios Evaluated:** {impact.totalScenariosCompared}",
                f"* **Newly Authorized (Expansions):** {impact.newlyAuthorizedCount}",
                f"* **Newly Forbidden (Restrictions):** {impact.newlyForbiddenCount}",
                f"* **Unchanged:** {impact.unchangedAllowCount + impact.unchangedDenyCount}",
                f"* **Comparison Coverage:** {impact.comparisonCoveragePct}%",
                f"* **Affected Principals:** {', '.join(impact.affectedPrincipals) or 'None'}",
                f"* **Affected Actions:** {', '.join(impact.affectedActions) or 'None'}",
                f"* **Affected Resources:** {', '.join(impact.affectedResources) or 'None'}",
            ])

        lines.extend([
            "",
            "---",
            "",
            "## 4. Counterexample Evidence Ledger",
        ])

        if report.counterexamples:
            for idx, cx in enumerate(report.counterexamples, start=1):
                lines.extend([
                    f"### Counterexample #{idx}: `{cx.scenarioTitle or cx.scenarioId}`",
                    f"- **Vector:** Principal `{cx.principal}`, Action `{cx.action}`, Resource `{cx.resource}`",
                    f"- **Transition:** `{cx.baselineDecision.value}` → `{cx.candidateDecision.value}` ({cx.transition.value})",
                    f"- **Explanation:** {cx.explanation}",
                ])
                if cx.violatedContractId:
                    lines.append(f"- **Violated Security Contract:** `{cx.violatedContractId}: {cx.violatedContractTitle}`")
                lines.append("")
        else:
            lines.append("No counterexamples detected. Authorization behavior conforms to baseline expectations.")

        lines.extend([
            "",
            "---",
            "",
            "## 5. Grounded AI Explanations & Remediation Proposals",
        ])

        if report.aiExplanations:
            for idx, exp in enumerate(report.aiExplanations, start=1):
                lines.extend([
                    f"### Finding Analysis #{idx} (`{exp.findingId}`)",
                    f"* **Provider:** `{exp.provider}`",
                    f"* **Summary:** {exp.summary}",
                    f"* **Root Cause:** {exp.rootCause}",
                    f"* **Security Risk:** {exp.securityRisk}",
                    f"* **Citations Verified:** {', '.join(exp.evidenceReferences)}",
                    f"* **Remediation Proposal:**",
                    "```cedar",
                    exp.remediationCedar,
                    "```",
                    f"> **Note:** {exp.limitations}",
                    "",
                ])
        else:
            lines.append("No AI remediation explanations requested or needed.")

        lines.extend([
            "",
            "---",
            "",
            "## 6. Audit Trail & Tool Provenance",
        ])
        for inv in report.toolInvocations:
            lines.append(f"- `{inv.get('timestamp')}`: Tool `{inv.get('tool')}` executed.")

        lines.extend([
            "",
            "---",
            "*Report generated deterministically by PolicyLab Authorization Engineering Platform.*",
        ])

        return "\n".join(lines)
