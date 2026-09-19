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
import { GlassStatCard } from "@/components/common/GlassStatCard"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">
              Strands PolicyAuditAgent
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              Run ID: <code className="text-foreground">{AUDIT_RUN_MOCK.id}</code>
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-400 shadow-[0_0_10px_rgba(255,106,36,0.5)]" />
            Strands Audit & Governance Intelligence
          </h1>
        </div>

        <Button
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="text-xs gap-1.5 h-7 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_15px_rgba(255,106,36,0.3)]"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>{isRunningAudit ? "Orchestrating Tool Harness..." : "Trigger Full Audit"}</span>
        </Button>
      </div>

      {isRunningAudit && (
        <div className="space-y-1.5 p-3.5 rounded-xl bg-[#0D1015]/90 border border-orange-500/30 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-foreground font-medium font-mono">
            <span>Executing deterministic tool harness & LLM evidence synthesis...</span>
            <span className="text-orange-400 font-bold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-black/50" />
        </div>
      )}

      {/* KPI Status Row with Glass Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassStatCard
          label="Audit Gate Status"
          value="BLOCKED"
          subValue="Invariant Violations"
          deltaText="Gate Blocked"
          deltaType="negative"
          statusColor="red"
          chartType="sparkline"
          chartData={[1, 1, 2, 3, 3]}
        />
        <GlassStatCard
          label="Critical Findings"
          value={`${AUDIT_RUN_MOCK.criticalFindingsCount} Critical`}
          subValue="Action Wildcard Overrides"
          deltaText="High Risk"
          deltaType="negative"
          statusColor="red"
          chartType="bars"
          chartData={[0, 1, 2, 3]}
        />
        <GlassStatCard
          label="Contracts Failed"
          value={`${AUDIT_RUN_MOCK.contractsFailedCount} / 6`}
          subValue="SC-04 Failed Assertion"
          deltaText="1 Failure"
          deltaType="warning"
          statusColor="amber"
          chartType="bars"
          chartData={[1, 1, 1, 1]}
        />
        <GlassStatCard
          label="Counterexamples"
          value={`${AUDIT_RUN_MOCK.counterexamplesCount} Proved`}
          subValue="Deterministic Cedar WASM"
          deltaText="100% Validated"
          deltaType="neutral"
          statusColor="cyan"
          chartType="sparkline"
          chartData={[1, 2, 3, 3]}
        />
      </div>

      {/* Pipeline Execution Details Card */}
      <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-orange-400" />
            Deterministic Tool Invocation Trace
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-white/[0.06] text-xs">
            <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(24,184,104,0.5)]" />
                <div>
                  <span className="font-semibold text-foreground">1. Cedar Schema Validation</span>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Typechecked AST against declared AcmePay schema constraints.
                  </p>
                </div>
              </div>
              <StatusBadge status="PASS" size="xs" label="PASSED (0.4ms)" />
            </div>

            <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(24,184,104,0.5)]" />
                <div>
                  <span className="font-semibold text-foreground">2. Bounded Semantic Diff Matrix</span>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Evaluated 432 declared scenarios across v12 and v13.
                  </p>
                </div>
              </div>
              <StatusBadge status="PASS" size="xs" label="PASSED (1.8s)" />
            </div>

            <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-amber-400 shrink-0 shadow-[0_0_6px_rgba(245,181,68,0.5)]" />
                <div>
                  <span className="font-semibold text-foreground">3. Deterministic Counterexample Discovery</span>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Extracted 3 high-severity DENY ➔ ALLOW authorization expansions.
                  </p>
                </div>
              </div>
              <StatusBadge status="MEDIUM" size="xs" label="3 FLAGGED" />
            </div>

            <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                <div>
                  <span className="font-semibold text-foreground">4. Security Contract Verification</span>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion.
                  </p>
                </div>
              </div>
              <StatusBadge status="BLOCKED" size="xs" label="1 FAILED" />
            </div>

            <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 shadow-[0_0_6px_rgba(255,106,36,0.5)]" />
                <div>
                  <span className="font-semibold text-foreground">5. Grounded Evidence Synthesis</span>
                  <p className="text-[11px] text-muted-foreground font-sans">
                    Synthesized root cause analysis and remediation recommendations.
                  </p>
                </div>
              </div>
              <StatusBadge status="VERIFIED" size="xs" label="SYNTHESIZED" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structured Executive Audit Narrative */}
      <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-orange-400" />
              Executive Audit Synthesis Narrative
            </CardTitle>
            <span className="text-[10px] font-mono text-muted-foreground">
              Grounded in AST & Counterexample Evidence
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 text-xs text-muted-foreground leading-relaxed space-y-3 font-sans">
          <p className="text-foreground/90 leading-relaxed">
            {AUDIT_RUN_MOCK.aiSummary}
          </p>
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-foreground flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-[11px]">
              <strong className="text-red-400">Required Action:</strong> Re-insert explicit action equality checks (<code className="font-mono text-orange-400 font-semibold">Action::"view"</code>) in candidate policy v13 before re-evaluating the deployment gate.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
