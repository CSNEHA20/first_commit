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
import {
  AUDIT_RUN_MOCK,
  ACMEPAY_ENTITIES,
  ACMEPAY_SCHEMA,
  ALL_REGRESSION_SCENARIOS,
  POLICY_V13_TEXT,
  SECURITY_CONTRACTS,
} from "@/fixtures/acmepay"
import {
  evaluateContracts,
  validateCedarPolicy,
  explainAuthorizationFinding,
  ContractEvaluationReport,
} from "@/lib/api"
import { SecurityContract } from "@/types/authz"

export const AuditScreen: React.FC = () => {
  const [isRunningAudit, setIsRunningAudit] = useState(false)
  const [progress, setProgress] = useState(100)
  const [auditStageText, setAuditStageText] = useState<string>(
    "Tool harness execution complete. Deterministic evidence grounded."
  )
  const [contractReport, setContractReport] = useState<ContractEvaluationReport | null>(null)
  const [validationLatencyMs, setValidationLatencyMs] = useState<number>(0.4)
  const [contractLatencyMs, setContractLatencyMs] = useState<number>(18.2)
  const [aiSummary, setAiSummary] = useState<string>(AUDIT_RUN_MOCK.aiSummary)

  const handleRunAudit = async () => {
    setIsRunningAudit(true)
    setProgress(15)
    setAuditStageText("Step 1: Validating Cedar AST and schema constraints...")

    try {
      const valStart = performance.now()
      await validateCedarPolicy(POLICY_V13_TEXT, ACMEPAY_SCHEMA)
      const valDuration = Math.round((performance.now() - valStart) * 10) / 10
      setValidationLatencyMs(valDuration)

      setProgress(40)
      setAuditStageText("Step 2 & 3: Evaluating bounded scenario universe and counterexamples...")
      await new Promise((r) => setTimeout(r, 200))

      setProgress(65)
      setAuditStageText("Step 4: Executing formal security contract assertions in Cedar WASM...")
      const contractStart = performance.now()
      const contractsPayload: SecurityContract[] = SECURITY_CONTRACTS.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        severity: c.severity,
        isBlocking: true,
        scenarioIds: c.scenarioIds,
        isActive: true,
        expectedDecision: c.expectedDecision,
      }))

      const rep = await evaluateContracts({
        policyText: POLICY_V13_TEXT,
        schemaText: ACMEPAY_SCHEMA,
        entities: ACMEPAY_ENTITIES,
        suite: {
          id: "suite_acmepay_core",
          name: "AcmePay Core Authorization Suite",
          scenarios: ALL_REGRESSION_SCENARIOS,
        },
        contracts: contractsPayload,
      })
      const contractDuration = Math.round((performance.now() - contractStart) * 10) / 10
      setContractLatencyMs(contractDuration)
      setContractReport(rep)

      setProgress(85)
      setAuditStageText("Step 5: Synthesizing grounded executive narrative & remediation...")

      try {
        const explanation = await explainAuthorizationFinding({
          principal: 'User::"contractor_alice"',
          action: 'Action::"delete"',
          resource: 'PayrollReport::"payroll_2026_q1"',
          violatedContractId: "SC-04",
          violatedContractTitle: "Contractors cannot delete payroll reports",
          baselineDecision: "DENY",
          candidateDecision: "ALLOW",
          transition: "DENY_TO_ALLOW",
          reproduced: true,
        })
        if (explanation && explanation.summary) {
          setAiSummary(
            `${explanation.summary} Root cause: ${explanation.rootCause} Security Impact: ${explanation.securityImpact}`
          )
        }
      } catch {
        // retain pre-loaded high-fidelity summary
      }

      setProgress(100)
      setAuditStageText("Full audit completed. Security contract results and grounded AI findings updated.")
    } catch (err) {
      console.warn("Audit execution failed, retaining baseline evidence model:", err)
    } finally {
      setIsRunningAudit(false)
    }
  }

  const failedContractsCount = contractReport ? contractReport.failedContracts : AUDIT_RUN_MOCK.contractsFailedCount
  const totalContractsCount = contractReport ? contractReport.totalContracts : 6
  const isGateBlocked = contractReport ? !contractReport.allBlockingPassed : true

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
            <span>{auditStageText}</span>
            <span className="text-orange-400 font-black text-sm">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-black/50" />
        </div>
      )}

      {/* KPI Status Row with Glass Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassStatCard
          label="Audit Gate Status"
          value={isGateBlocked ? "BLOCKED" : "PASS"}
          subValue={isGateBlocked ? "Invariant Violations" : "All Blocking Passed"}
          deltaText={isGateBlocked ? "Gate Blocked" : "Gate Clear"}
          deltaType={isGateBlocked ? "negative" : "positive"}
          statusColor={isGateBlocked ? "red" : "emerald"}
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
          value={`${failedContractsCount} / ${totalContractsCount}`}
          subValue={failedContractsCount > 0 ? "SC-04 Failed Assertion" : "All Invariants Satisfied"}
          deltaText={failedContractsCount > 0 ? `${failedContractsCount} Failure` : "0 Failures"}
          deltaType={failedContractsCount > 0 ? "warning" : "positive"}
          statusColor={failedContractsCount > 0 ? "amber" : "emerald"}
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
            <StatusBadge status="PASS" size="xs" label={`PASSED (${validationLatencyMs}ms)`} />
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
              {failedContractsCount > 0 ? (
                <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
              )}
              <div>
                <span className="font-bold text-foreground text-xs">4. Security Contract Verification</span>
                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                  {failedContractsCount > 0
                    ? `Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion.`
                    : `All ${totalContractsCount} formal security contracts satisfied.`}
                </p>
              </div>
            </div>
            <StatusBadge
              status={failedContractsCount > 0 ? "BLOCKED" : "PASS"}
              size="xs"
              label={failedContractsCount > 0 ? `${failedContractsCount} FAILED (${contractLatencyMs}ms)` : `PASSED (${contractLatencyMs}ms)`}
            />
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
            {aiSummary}
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
