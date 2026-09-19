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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-purple-600 dark:text-purple-400 border-purple-500/30">
              Strands Agents SDK
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">
              Run: {AUDIT_RUN_MOCK.id}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-500" />
            Policy Audit & Governance Report
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-tool orchestrated security audit evaluating invariants, counterexamples, and Bedrock synthesis.
          </p>
        </div>

        <Button
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="bg-purple-600 hover:bg-purple-500 text-white text-xs gap-1.5 font-semibold h-8 shadow-md shadow-purple-500/20"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {isRunningAudit ? "Orchestrating Audit..." : "Trigger Full Audit"}
        </Button>
      </div>

      {isRunningAudit && (
        <div className="space-y-1.5 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-purple-600 dark:text-purple-300 font-medium">
            <span>Strands PolicyAuditAgent running deterministic tool harness...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-purple-500/20" />
        </div>
      )}

      {/* KPI Status Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Audit Gate Status</span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-lg font-mono text-rose-500">
                ⛔ BLOCKED
              </CardTitle>
              <Badge variant="blocked">Gate Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Deployment restricted due to critical contract failures.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Critical Findings</span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-lg font-mono text-rose-500">
                {AUDIT_RUN_MOCK.criticalFindingsCount} Critical
              </CardTitle>
              <Badge variant="destructive">P0 Risk</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Contractor destructive privileges on sensitive records.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Contracts Violated</span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-lg font-mono text-amber-500">
                {AUDIT_RUN_MOCK.contractsFailedCount} / {AUDIT_RUN_MOCK.contractsFailedCount + AUDIT_RUN_MOCK.contractsPassedCount}
              </CardTitle>
              <Badge variant="warning">Regressions</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            SC-03, SC-04, and SC-05 failed expected assertions.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Counterexamples</span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-lg font-mono text-foreground">
                {AUDIT_RUN_MOCK.counterexamplesCount} Proved
              </CardTitle>
              <Badge variant="outline">Verified</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Deterministic proofs extracted from Cedar engine.
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Execution Details Card */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-500" />
            Strands Audit Pipeline Stages
          </CardTitle>
          <CardDescription>
            Tool invocation sequence executed by the PolicyAuditAgent.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-xs">
            <div className="p-3 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">1. Cedar Schema Validation</span>
                  <p className="text-[11px] text-muted-foreground">
                    Typechecked AST against acmepay.cedarschema.json.
                  </p>
                </div>
              </div>
              <Badge variant="allow">PASSED (0.4ms)</Badge>
            </div>

            <div className="p-3 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">2. Bounded Semantic Diff Matrix</span>
                  <p className="text-[11px] text-muted-foreground">
                    Evaluated 432 declared scenarios across v12 and v13.
                  </p>
                </div>
              </div>
              <Badge variant="allow">PASSED (1.8s)</Badge>
            </div>

            <div className="p-3 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">3. Deterministic Counterexample Discovery</span>
                  <p className="text-[11px] text-muted-foreground">
                    Extracted 3 high-severity DENY ➔ ALLOW authorization expansions.
                  </p>
                </div>
              </div>
              <Badge variant="warning">3 FINDINGS FLAGGED</Badge>
            </div>

            <div className="p-3 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">4. Security Contract Verification</span>
                  <p className="text-[11px] text-muted-foreground">
                    Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion.
                  </p>
                </div>
              </div>
              <Badge variant="blocked">1 CONTRACT FAILED</Badge>
            </div>

            <div className="p-3 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                <div>
                  <span className="font-semibold text-foreground">5. Amazon Bedrock Evidence Synthesis</span>
                  <p className="text-[11px] text-muted-foreground">
                    Claude 3.5 Sonnet synthesized root cause and remediation recommendations.
                  </p>
                </div>
              </div>
              <Badge variant="ai">SYNTHESIZED</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Grounded Narrative Card */}
      <Card className="border-purple-500/30 bg-purple-500/5">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Amazon Bedrock Executive Audit Narrative
            </CardTitle>
            <Badge variant="ai" className="text-[10px]">
              Anthropic Claude 3.5 Sonnet
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2 text-xs text-muted-foreground leading-relaxed space-y-3">
          <p>
            {AUDIT_RUN_MOCK.aiSummary}
          </p>
          <div className="p-3 rounded-lg bg-background border border-border text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-500 shrink-0" />
            <span>
              <strong>Action Required:</strong> Re-insert explicit action equality checks (`Action::"view"`) in candidate policy v13 before re-evaluating the deployment gate.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
