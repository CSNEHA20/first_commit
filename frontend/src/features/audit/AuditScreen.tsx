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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">
              Strands PolicyAuditAgent
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              Run ID: <code className="text-orange-400 font-bold">{AUDIT_RUN_MOCK.id}</code>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-orange-400 shadow-[0_0_12px_rgba(255,106,36,0.6)]" />
            Strands Audit & Governance Intelligence
          </h1>
        </div>

        <Button
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="text-xs gap-1.5 h-8 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_20px_rgba(255,106,36,0.4)] transition-transform hover:scale-105"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>{isRunningAudit ? "Orchestrating Tool Harness..." : "Trigger Full Audit"}</span>
        </Button>
      </div>

      {isRunningAudit && (
        <div className="glass-panel-premium space-y-2 p-4 rounded-2xl border border-orange-500/40 shadow-xl">
          <div className="flex items-center justify-between text-xs text-foreground font-bold font-mono">
            <span>Executing deterministic tool harness & LLM evidence synthesis...</span>
            <span className="text-orange-400 font-black text-sm">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-black/50" />
        </div>
      )}

      {/* KPI Status Row with Glass Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
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
      <Card className="glass-card-premium">
        <CardHeader className="p-4 border-b border-white/[0.08]">
          <CardTitle className="text-xs font-bold flex items-center gap-2">
            <Layers className="h-4 w-4 text-orange-400" />
            Deterministic Tool Invocation Trace
          </CardTitle>
        </CardHeader>

        <CardContent className="p-3 space-y-2">
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
              <div>
                <span className="font-bold text-foreground text-xs">1. Cedar Schema Validation</span>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Typechecked AST against declared AcmePay schema constraints.
                </p>
              </div>
            </div>
            <StatusBadge status="PASS" size="xs" label="PASSED (0.4ms)" />
          </div>

          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
              <div>
                <span className="font-bold text-foreground text-xs">2. Bounded Semantic Diff Matrix</span>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Evaluated 432 declared scenarios across v12 and v13.
                </p>
              </div>
            </div>
            <StatusBadge status="PASS" size="xs" label="PASSED (1.8s)" />
          </div>

          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
            <div className="flex items-center gap-3">
              <XCircle className="h-4 w-4 text-amber-400 shrink-0 shadow-[0_0_8px_rgba(245,181,68,0.6)]" />
              <div>
                <span className="font-bold text-foreground text-xs">3. Deterministic Counterexample Discovery</span>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Extracted 3 high-severity DENY ➔ ALLOW authorization expansions.
                </p>
              </div>
            </div>
            <StatusBadge status="MEDIUM" size="xs" label="3 FLAGGED" />
          </div>

          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
            <div className="flex items-center gap-3">
              <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              <div>
                <span className="font-bold text-foreground text-xs">4. Security Contract Verification</span>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion.
                </p>
              </div>
            </div>
            <StatusBadge status="BLOCKED" size="xs" label="1 FAILED" />
          </div>

          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 shadow-[0_0_8px_rgba(255,106,36,0.6)]" />
              <div>
                <span className="font-bold text-foreground text-xs">5. Grounded Evidence Synthesis</span>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  Synthesized root cause analysis and remediation recommendations.
                </p>
              </div>
            </div>
            <StatusBadge status="VERIFIED" size="xs" label="SYNTHESIZED" />
          </div>
        </CardContent>
      </Card>

      {/* Structured Executive Audit Narrative */}
      <Card className="glass-card-premium">
        <CardHeader className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-400" />
              Executive Audit Synthesis Narrative
            </CardTitle>
            <span className="text-[10px] font-mono text-muted-foreground">
              Grounded in AST & Counterexample Evidence
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed space-y-3 font-sans">
          <p className="text-foreground/95 leading-relaxed text-xs">
            {AUDIT_RUN_MOCK.aiSummary}
          </p>
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-foreground flex items-center gap-3 shadow-[0_0_16px_rgba(239,68,68,0.15)]">
            <Lock className="h-5 w-5 text-red-400 shrink-0" />
            <span className="text-[11px]">
              <strong className="text-red-400">Required Action:</strong> Re-insert explicit action equality checks (<code className="font-mono text-orange-400 font-bold bg-orange-500/10 px-1 py-0.5 rounded border border-orange-500/20">Action::"view"</code>) in candidate policy v13 before re-evaluating the deployment gate.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
