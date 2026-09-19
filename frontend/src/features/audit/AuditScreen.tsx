import React, { useState } from "react"
import {
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Progress } from "@/components/ui/progress"
import { AUDIT_RUN_MOCK } from "@/fixtures/acmepay"

export const AuditScreen: React.FC = () => {
  const [isRunningAudit, setIsRunningAudit] = useState(false)
  const [progress, setProgress] = useState(100)

  const handleRunAudit = () => {
    setIsRunningAudit(true)
    setProgress(20)
    setTimeout(() => setProgress(50), 300)
    setTimeout(() => setProgress(80), 600)
    setTimeout(() => {
      setProgress(100)
      setIsRunningAudit(false)
    }, 900)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              Strands PolicyAuditAgent
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              Run: {AUDIT_RUN_MOCK.id}
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Strands Audit & Governance Intelligence
          </h1>
        </div>

        <Button
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="text-xs gap-1.5 h-7 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>{isRunningAudit ? "Orchestrating Audit..." : "Trigger Full Audit"}</span>
        </Button>
      </div>

      {isRunningAudit && (
        <div className="space-y-1 p-3 rounded-md bg-muted/40 border border-border">
          <div className="flex items-center justify-between text-xs text-foreground font-medium">
            <span>Executing deterministic tool harness...</span>
            <span className="font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* KPI Status Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-md border border-status-blocked/30 bg-status-blocked/[0.03]">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Audit Gate Status
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-status-deny">
              BLOCKED
            </span>
            <StatusBadge status="BLOCKED" size="xs" />
          </div>
        </div>

        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Critical Findings
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-status-deny">
              {AUDIT_RUN_MOCK.criticalFindingsCount} Critical
            </span>
            <StatusBadge status="CRITICAL" size="xs" />
          </div>
        </div>

        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Contracts Failed
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-status-warning">
              {AUDIT_RUN_MOCK.contractsFailedCount} / {AUDIT_RUN_MOCK.contractsFailedCount + AUDIT_RUN_MOCK.contractsPassedCount}
            </span>
            <StatusBadge status="MEDIUM" size="xs" label="Violations" />
          </div>
        </div>

        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Counterexamples
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base font-bold text-foreground">
              {AUDIT_RUN_MOCK.counterexamplesCount} Proved
            </span>
            <StatusBadge status="VERIFIED" size="xs" />
          </div>
        </div>
      </div>

      {/* Pipeline Execution Details Card */}
      <Card className="border-border bg-card">
        <CardHeader className="p-3.5 pb-2 border-b border-border">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            Deterministic Tool Invocation Trace
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border text-xs">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">1. Cedar Schema Validation</span>
                  <p className="text-[11px] text-muted-foreground">
                    Typechecked AST against schema.
                  </p>
                </div>
              </div>
              <StatusBadge status="PASS" size="xs" label="PASSED (0.4ms)" />
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">2. Bounded Semantic Diff Matrix</span>
                  <p className="text-[11px] text-muted-foreground">
                    Evaluated 432 declared scenarios across v12 and v13.
                  </p>
                </div>
              </div>
              <StatusBadge status="PASS" size="xs" label="PASSED (1.8s)" />
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <XCircle className="h-3.5 w-3.5 text-status-warning shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">3. Deterministic Counterexample Discovery</span>
                  <p className="text-[11px] text-muted-foreground">
                    Extracted 3 high-severity DENY ➔ ALLOW authorization expansions.
                  </p>
                </div>
              </div>
              <StatusBadge status="MEDIUM" size="xs" label="3 FLAGGED" />
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <XCircle className="h-3.5 w-3.5 text-status-deny shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">4. Security Contract Verification</span>
                  <p className="text-[11px] text-muted-foreground">
                    Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion.
                  </p>
                </div>
              </div>
              <StatusBadge status="BLOCKED" size="xs" label="1 FAILED" />
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">5. Grounded Evidence Synthesis</span>
                  <p className="text-[11px] text-muted-foreground">
                    Synthesized root cause and remediation recommendations.
                  </p>
                </div>
              </div>
              <StatusBadge status="VERIFIED" size="xs" label="SYNTHESIZED" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structured Executive Audit Narrative */}
      <Card className="border-border bg-card">
        <CardHeader className="p-3.5 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Executive Audit Synthesis Narrative
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 text-xs text-muted-foreground leading-relaxed space-y-2.5">
          <p>
            {AUDIT_RUN_MOCK.aiSummary}
          </p>
          <div className="p-2.5 rounded bg-status-blocked/10 border border-status-blocked/20 text-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-status-deny shrink-0" />
            <span className="text-[11px]">
              <strong>Required Action:</strong> Re-insert explicit action equality checks (<code className="font-mono text-status-deny font-semibold">Action::"view"</code>) in candidate policy v13 before re-evaluating the deployment gate.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
