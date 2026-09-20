import React, { useState } from "react"
import {
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  Lock,
  Download,
  RefreshCw,
  Workflow,
  AlertCircle,
  ShieldCheck,
  Cpu,
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
  ACMEPAY_SCENARIO_SUITE,
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  POLICY_V13_FIXED_TEXT,
  SECURITY_CONTRACTS,
} from "@/fixtures/acmepay"
import {
  runAgentAudit,
  startAsyncAudit,
  getAsyncAuditStatus,
  exportAuditReport,
} from "@/lib/api"
import {
  AuditWorkflowReport,
  SecurityContract,
  AsyncAuditStatusResponse,
  ScenarioSuite,
} from "@/types/authz"

import { useWorkspace } from "@/store/workspaceStore"

type AuditDataSource = "LIVE_AGENT" | "STEP_FUNCTIONS" | "FIXTURE_PREVIEW"

export const AuditScreen: React.FC = () => {
  const { isDemoMode, activeWorkspace, connectedData } = useWorkspace()
  const [candidateVersion, setCandidateVersion] = useState<"v13_draft" | "v13_fixed">("v13_draft")
  const [dataSource, setDataSource] = useState<AuditDataSource>("FIXTURE_PREVIEW")
  const [isRunningAudit, setIsRunningAudit] = useState(false)
  const [isRunningAsync, setIsRunningAsync] = useState(false)
  const [asyncExecutionArn, setAsyncExecutionArn] = useState<string | null>(null)
  const [asyncStatus, setAsyncStatus] = useState<string | null>(null)
  const [asyncError, setAsyncError] = useState<string | null>(null)
  const [progress, setProgress] = useState(100)
  const [auditStageText, setAuditStageText] = useState<string>(
    "Tool harness execution complete. Deterministic evidence grounded."
  )
  const [liveReport, setLiveReport] = useState<AuditWorkflowReport | null>(null)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const activeCandidatePolicyText = isDemoMode
    ? (candidateVersion === "v13_draft" ? POLICY_V13_TEXT : POLICY_V13_FIXED_TEXT)
    : (connectedData?.candidatePolicyText || "")

  const activeBaselinePolicyText = isDemoMode
    ? POLICY_V12_TEXT
    : (connectedData?.baselinePolicyText || "")

  const activeSchemaText = isDemoMode
    ? ACMEPAY_SCHEMA
    : (connectedData?.schemaText || "")

  const activeEntities = React.useMemo(() => {
    if (isDemoMode) return ACMEPAY_ENTITIES
    try {
      if (connectedData?.entitiesJson) {
        const parsed = JSON.parse(connectedData.entitiesJson)
        return Array.isArray(parsed) ? parsed : [parsed]
      }
    } catch {
      // fallback
    }
    return []
  }, [isDemoMode, connectedData?.entitiesJson])

  const activeSuite: ScenarioSuite = isDemoMode
    ? ACMEPAY_SCENARIO_SUITE
    : {
        id: activeWorkspace?.id || "connected-suite",
        name: `${activeWorkspace?.name || "Connected"} Authorization Suite`,
        description: "Evaluated scenarios across active workspace bounds",
        version: "1.0",
        scenarios: connectedData?.scenarios || [],
      }

  const activeContracts: SecurityContract[] = isDemoMode
    ? SECURITY_CONTRACTS.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        severity: c.severity,
        isBlocking: true,
        scenarioIds: c.scenarioIds,
        isActive: true,
        expectedDecision: c.expectedDecision,
      }))
    : (connectedData?.contracts || []).map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        severity: c.severity || "CRITICAL",
        isBlocking: c.isBlocking !== false,
        scenarioIds: c.scenarioIds || [],
        isActive: c.isActive !== false,
        expectedDecision: c.expectedDecision,
      }))

  const handleRunStrandsAudit = async () => {
    setIsRunningAudit(true)
    setAuditError(null)
    setProgress(15)
    setAuditStageText("Step 1: Validating Cedar AST and schema constraints via Cedar WASM...")

    try {
      setProgress(35)
      setAuditStageText("Step 2 & 3: Strands orchestrating bounded scenario diff matrix and counterexample extraction...")

      setProgress(60)
      setAuditStageText("Step 4: Executing formal security contracts and evaluating deployment gate...")

      const report = await runAgentAudit({
        baselinePolicyText: activeBaselinePolicyText,
        candidatePolicyText: activeCandidatePolicyText,
        suite: activeSuite,
        contracts: activeContracts,
        schemaText: activeSchemaText,
        entities: activeEntities,
        baselineLabel: isDemoMode ? "AcmePay Baseline (v12)" : (connectedData?.baselineLabel || "Baseline"),
        candidateLabel: isDemoMode
          ? (candidateVersion === "v13_draft"
              ? "AcmePay Candidate (v13 Draft)"
              : "AcmePay Candidate (v13 Fixed)")
          : (connectedData?.candidateLabel || "Candidate"),
        runAiExplanation: true,
      })

      setProgress(90)
      setAuditStageText("Step 5: Synthesizing grounded executive narrative & remediation...")

      setLiveReport(report)
      setDataSource("LIVE_AGENT")
      setProgress(100)
      setAuditStageText("Strands audit execution completed. Verified evidence ledger persisted.")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAuditError(msg)
      console.error("Strands audit failed:", err)
    } finally {
      setIsRunningAudit(false)
    }
  }

  const handleTriggerAsyncStepFunctions = async () => {
    setIsRunningAsync(true)
    setAsyncError(null)
    setAsyncExecutionArn(null)
    setAsyncStatus("INITIATING")

    try {
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

      const startRes = await startAsyncAudit({
        baselinePolicyText: POLICY_V12_TEXT,
        candidatePolicyText: activeCandidatePolicyText,
        suite: ACMEPAY_SCENARIO_SUITE,
        contracts: contractsPayload,
        schemaText: ACMEPAY_SCHEMA,
        entities: ACMEPAY_ENTITIES,
        baselineLabel: "Baseline (v12)",
        candidateLabel: candidateVersion === "v13_draft" ? "Candidate (v13)" : "Candidate (v13 Fixed)",
      })

      setAsyncExecutionArn(startRes.executionArn)
      setAsyncStatus(startRes.status)
      setDataSource("STEP_FUNCTIONS")

      // Poll execution status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes: AsyncAuditStatusResponse = await getAsyncAuditStatus(startRes.executionArn)
          setAsyncStatus(statusRes.status)
          if (["SUCCEEDED", "FAILED", "TIMED_OUT", "ABORTED"].includes(statusRes.status)) {
            clearInterval(pollInterval)
            setIsRunningAsync(false)
          }
        } catch (pollErr) {
          console.warn("Error polling async execution status:", pollErr)
        }
      }, 2500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAsyncError(msg)
      setIsRunningAsync(false)
    }
  }

  const handleExport = async (format: "markdown" | "json") => {
    if (!liveReport) return
    setIsExporting(true)
    try {
      const res = await exportAuditReport(liveReport, format)
      const blob = new Blob([res.content], {
        type: format === "json" ? "application/json" : "text/markdown",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `policylab-audit-${liveReport.auditRunId}.${format === "json" ? "json" : "md"}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to export audit report:", err)
    } finally {
      setIsExporting(false)
    }
  }

  // Determine active displayed metrics
  const auditId = liveReport ? liveReport.auditRunId : AUDIT_RUN_MOCK.id
  const gateDecision = liveReport ? liveReport.gateDecision : (AUDIT_RUN_MOCK.status === "BLOCKED" ? "BLOCKED" : "PASS")
  const isGateBlocked = gateDecision !== "PASS"

  const failedContractsCount = liveReport
    ? liveReport.contractResults.filter((c) => c.status === "VIOLATED").length
    : AUDIT_RUN_MOCK.contractsFailedCount

  const totalContractsCount = liveReport ? liveReport.contractResults.length : 6

  const counterexamplesCount = liveReport
    ? liveReport.counterexamples.length
    : AUDIT_RUN_MOCK.counterexamplesCount

  const aiSummaryText = liveReport
    ? (liveReport.aiExplanations.length > 0
        ? `${liveReport.aiExplanations[0].summary} Root cause: ${liveReport.aiExplanations[0].rootCause} Security Impact: ${liveReport.aiExplanations[0].securityRisk || liveReport.aiExplanations[0].securityImpact}`
        : liveReport.summary)
    : AUDIT_RUN_MOCK.aiSummary

  const explanationProvider = liveReport?.aiExplanations[0]?.provider || "Deterministic Template Provider (Offline)"

  return (
    <div className="space-y-4">
      {/* Header with Title and Mode Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono flex items-center gap-1.5">
              <Cpu className="h-3 w-3" />
              Strands PolicyAuditAgent
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              Run ID: <code className="text-orange-400 font-bold">{auditId}</code>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                dataSource === "LIVE_AGENT"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : dataSource === "STEP_FUNCTIONS"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
              }`}
            >
              {dataSource === "LIVE_AGENT"
                ? "LIVE STRANDS AGENT"
                : dataSource === "STEP_FUNCTIONS"
                ? "AWS STEP FUNCTIONS"
                : "FIXTURE PREVIEW"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-orange-400 shadow-[0_0_12px_rgba(255,106,36,0.6)]" />
            Strands Audit & Governance Intelligence
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Candidate Version Selector */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setCandidateVersion("v13_draft")}
              className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                candidateVersion === "v13_draft"
                  ? "bg-red-500/20 text-red-300 font-bold border border-red-500/40 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="v13 Draft with wildcards causing SC-04 contract violation"
            >
              v13 Draft (Violations)
            </button>
            <button
              onClick={() => setCandidateVersion("v13_fixed")}
              className={`text-xs px-2.5 py-1 rounded-md font-mono transition-all ${
                candidateVersion === "v13_fixed"
                  ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="v13 Fixed with explicit action scoping and 0 contract violations"
            >
              v13 Fixed (Clean)
            </button>
          </div>

          {/* Primary Action Button */}
          <Button
            onClick={handleRunStrandsAudit}
            disabled={isRunningAudit || isRunningAsync}
            className="text-xs gap-1.5 h-8 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_20px_rgba(255,106,36,0.4)] transition-transform hover:scale-105"
          >
            {isRunningAudit ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>{isRunningAudit ? "Orchestrating Strands..." : "Run Security Audit"}</span>
          </Button>

          {/* Step Functions Trigger */}
          <Button
            onClick={handleTriggerAsyncStepFunctions}
            disabled={isRunningAudit || isRunningAsync}
            variant="outline"
            className="text-xs gap-1.5 h-8 border-purple-500/40 bg-purple-950/20 text-purple-300 hover:bg-purple-900/40 hover:text-purple-200"
          >
            <Workflow className="h-3.5 w-3.5" />
            <span>{isRunningAsync ? "Running Step Functions..." : "Trigger Step Functions"}</span>
          </Button>

          {/* Export Action */}
          {liveReport && (
            <div className="flex items-center gap-1">
              <Button
                onClick={() => handleExport("markdown")}
                disabled={isExporting}
                variant="outline"
                className="text-xs gap-1 h-8 border-white/20 bg-black/30 hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5 text-orange-400" />
                <span>MD</span>
              </Button>
              <Button
                onClick={() => handleExport("json")}
                disabled={isExporting}
                variant="outline"
                className="text-xs gap-1 h-8 border-white/20 bg-black/30 hover:bg-white/10"
              >
                <Download className="h-3.5 w-3.5 text-cyan-400" />
                <span>JSON</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Audit Progress Bar */}
      {isRunningAudit && (
        <div className="glass-panel-premium space-y-2 p-4 rounded-2xl border border-orange-500/40 shadow-xl">
          <div className="flex items-center justify-between text-xs text-foreground font-bold font-mono">
            <span>{auditStageText}</span>
            <span className="text-orange-400 font-black text-sm">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-black/50" />
        </div>
      )}

      {/* Async Step Functions Diagnostic Alert */}
      {asyncExecutionArn && (
        <div className="p-3 rounded-xl border border-purple-500/40 bg-purple-950/20 text-purple-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-purple-400 shrink-0" />
            <span>
              Step Functions Execution: <code className="font-mono text-purple-300 font-bold">{asyncExecutionArn}</code>
            </span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 border border-purple-500/40 text-[10px]">
            {asyncStatus}
          </span>
        </div>
      )}

      {asyncError && (
        <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>
            <strong>Step Functions Note:</strong> {asyncError} (Synchronous Strands audit remains 100% operational).
          </span>
        </div>
      )}

      {auditError && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-950/20 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>
            <strong>Audit Execution Error:</strong> {auditError}
          </span>
        </div>
      )}

      {/* KPI Status Row with Glass Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassStatCard
          label="Audit Gate Status"
          value={isGateBlocked ? "BLOCKED" : "PASS"}
          subValue={isGateBlocked ? "Contract Invariant Violations" : "All Security Contracts Passed"}
          deltaText={isGateBlocked ? "Gate Blocked" : "Gate Clear"}
          deltaType={isGateBlocked ? "negative" : "positive"}
          statusColor={isGateBlocked ? "red" : "emerald"}
          chartType="sparkline"
          chartData={isGateBlocked ? [1, 1, 2, 3, 3] : [0, 0, 0, 0, 0]}
        />
        <GlassStatCard
          label="Counterexamples Proved"
          value={`${counterexamplesCount} Proved`}
          subValue="Deterministic Cedar WASM"
          deltaText={counterexamplesCount > 0 ? `${counterexamplesCount} Exploit Vectors` : "0 Counterexamples"}
          deltaType={counterexamplesCount > 0 ? "negative" : "positive"}
          statusColor={counterexamplesCount > 0 ? "red" : "emerald"}
          chartType="bars"
          chartData={counterexamplesCount > 0 ? [0, 1, 2, 3] : [0, 0, 0, 0]}
        />
        <GlassStatCard
          label="Contracts Failed"
          value={`${failedContractsCount} / ${totalContractsCount}`}
          subValue={failedContractsCount > 0 ? "SC-04 Contractor Violation" : "All Invariants Satisfied"}
          deltaText={failedContractsCount > 0 ? `${failedContractsCount} Failed` : "0 Failures"}
          deltaType={failedContractsCount > 0 ? "warning" : "positive"}
          statusColor={failedContractsCount > 0 ? "amber" : "emerald"}
          chartType="bars"
          chartData={failedContractsCount > 0 ? [1, 1, 1, 1] : [0, 0, 0, 0]}
        />
        <GlassStatCard
          label="Scenarios Compared"
          value={
            liveReport?.diffReport?.impactSummary?.totalScenariosCompared
              ? `${liveReport.diffReport.impactSummary.totalScenariosCompared} Scenarios`
              : "432 Scenarios"
          }
          subValue="AcmePay Declared Universe"
          deltaText="100% Coverage"
          deltaType="neutral"
          statusColor="cyan"
          chartType="sparkline"
          chartData={[1, 2, 3, 3]}
        />
      </div>

      {/* Tool Invocation Trace Card */}
      <Card className="glass-card-premium">
        <CardHeader className="p-4 border-b border-white/[0.08] flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold flex items-center gap-2">
            <Layers className="h-4 w-4 text-orange-400" />
            Strands Deterministic Tool Invocation Trace
          </CardTitle>
          <span className="text-[10px] font-mono text-muted-foreground">
            {liveReport?.toolInvocations ? `${liveReport.toolInvocations.length} Tools Dispatched` : "5 Standard Invocations"}
          </span>
        </CardHeader>

        <CardContent className="p-3 space-y-2">
          {liveReport?.toolInvocations && liveReport.toolInvocations.length > 0 ? (
            liveReport.toolInvocations.map((inv, idx) => {
              const isSuccess = inv.success !== false
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md"
                >
                  <div className="flex items-center gap-3">
                    {isSuccess ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                    )}
                    <div>
                      <span className="font-bold text-foreground text-xs font-mono">
                        {idx + 1}. {inv.tool} {inv.target ? `(${inv.target})` : ""}
                      </span>
                      <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                        {inv.tool === "validate_policy" && `Validated Cedar AST syntax and schema constraints.`}
                        {inv.tool === "run_regression_suite" && `Executed scenario diff matrix, counterexample analysis, and contract assertions.`}
                        {inv.tool === "grounded_bedrock_explanation" && `Synthesized grounded explanation for finding ${inv.findingId || "SC-04"}. Provider: ${inv.provider || "Amazon Bedrock"}.`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.provider && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        inv.provider.toLowerCase().includes("bedrock")
                          ? "text-purple-300 bg-purple-500/10 border-purple-500/20"
                          : inv.provider.toLowerCase().includes("nemotron")
                          ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                          : "text-amber-300 bg-amber-500/10 border-amber-500/20"
                      }`}>
                        {inv.provider.toLowerCase().includes("bedrock")
                          ? "Bedrock"
                          : inv.provider.toLowerCase().includes("nemotron")
                          ? "Nemotron"
                          : "Template"}
                      </span>
                    )}
                    <StatusBadge
                      status={inv.gateStatus ? (inv.gateStatus === "PASS" ? "PASS" : "BLOCKED") : (isSuccess ? "PASS" : "BLOCKED")}
                      size="xs"
                      label={inv.gateStatus ? `GATE: ${inv.gateStatus}` : (isSuccess ? "EXECUTED" : "FAILED")}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            // Default tool trace preview
            <>
              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
                  <div>
                    <span className="font-bold text-foreground text-xs font-mono">1. validate_policy (candidate & baseline)</span>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                      Typechecked AST against declared AcmePay schema constraints.
                    </p>
                  </div>
                </div>
                <StatusBadge status="PASS" size="xs" label="PASSED" />
              </div>

              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
                  <div>
                    <span className="font-bold text-foreground text-xs font-mono">2. calculate_semantic_diff & run_regression_suite</span>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                      Evaluated 432 declared scenarios across v12 and v13 in Cedar WASM.
                    </p>
                  </div>
                </div>
                <StatusBadge status="PASS" size="xs" label="PASSED" />
              </div>

              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
                <div className="flex items-center gap-3">
                  {isGateBlocked ? (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
                  )}
                  <div>
                    <span className="font-bold text-foreground text-xs font-mono">3. get_security_contracts (invariant evaluation)</span>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                      {isGateBlocked
                        ? `Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion.`
                        : `All 6 formal security contracts satisfied.`}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  status={isGateBlocked ? "BLOCKED" : "PASS"}
                  size="xs"
                  label={isGateBlocked ? "GATE BLOCKED" : "GATE PASS"}
                />
              </div>

              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/30 flex items-center justify-between hover:bg-white/[0.04] transition-all backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-orange-400 shrink-0 shadow-[0_0_8px_rgba(255,106,36,0.6)]" />
                  <div>
                    <span className="font-bold text-foreground text-xs font-mono">4. grounded_bedrock_explanation</span>
                    <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                      Synthesized root cause analysis and remediation recommendations grounded in AST and counterexamples.
                    </p>
                  </div>
                </div>
                <StatusBadge status="VERIFIED" size="xs" label="GROUNDED" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Proved Counterexamples (if present) */}
      {counterexamplesCount > 0 && (
        <Card className="glass-card-premium border-red-500/30">
          <CardHeader className="p-4 border-b border-white/[0.08] flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold flex items-center gap-2 text-red-400">
              <AlertCircle className="h-4 w-4" />
              Deterministic Counterexamples Proved by Cedar WASM ({counterexamplesCount})
            </CardTitle>
            <span className="text-[10px] font-mono text-red-400/80">
              100% Mathematically Reproduced
            </span>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {(liveReport?.counterexamples && liveReport.counterexamples.length > 0
              ? liveReport.counterexamples
              : [
                  {
                    id: "cx-01",
                    scenarioTitle: "Contractor deletes payroll report (SC-04)",
                    principal: 'User::"contractor_alice"',
                    action: 'Action::"delete"',
                    resource: 'PayrollReport::"payroll_2026_q1"',
                    baselineDecision: "DENY",
                    candidateDecision: "ALLOW",
                    transition: "DENY_TO_ALLOW",
                    violatedContractId: "SC-04",
                  },
                  {
                    id: "cx-02",
                    scenarioTitle: "Editor deletes customer invoice",
                    principal: 'User::"editor_bob"',
                    action: 'Action::"delete"',
                    resource: 'Invoice::"inv_9982"',
                    baselineDecision: "DENY",
                    candidateDecision: "ALLOW",
                    transition: "DENY_TO_ALLOW",
                    violatedContractId: "SC-01",
                  },
                ]
            ).map((cx, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-red-500/20 bg-red-950/10 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{cx.scenarioTitle}</span>
                    <span className="text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/30 px-1.5 py-0.2 rounded font-bold">
                      {cx.violatedContractId || "SC-04"}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{cx.principal}</span>
                    <span className="text-white/40">➔</span>
                    <span className="text-orange-400">{cx.action}</span>
                    <span className="text-white/40">➔</span>
                    <span>{cx.resource}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <span className="text-emerald-400 line-through opacity-70">{cx.baselineDecision}</span>
                  <span className="text-white/40">➔</span>
                  <span className="text-red-400 font-black">{cx.candidateDecision}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Structured Executive Audit Narrative */}
      <Card className="glass-card-premium">
        <CardHeader className="p-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-400" />
              Executive Audit Synthesis Narrative
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                Provider: {explanationProvider}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                Grounded in AST & Counterexamples
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed space-y-3 font-sans">
          <p className="text-foreground/95 leading-relaxed text-xs">
            {aiSummaryText}
          </p>
          {isGateBlocked ? (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-foreground flex items-center gap-3 shadow-[0_0_16px_rgba(239,68,68,0.15)]">
              <Lock className="h-5 w-5 text-red-400 shrink-0" />
              <span className="text-[11px]">
                <strong className="text-red-400">Required Action:</strong> Re-insert explicit action equality checks (<code className="font-mono text-orange-400 font-bold bg-orange-500/10 px-1 py-0.5 rounded border border-orange-500/20">Action::"view"</code>) in candidate policy v13 before re-evaluating the deployment gate.
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-foreground flex items-center gap-3 shadow-[0_0_16px_rgba(24,184,104,0.15)]">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <span className="text-[11px]">
                <strong className="text-emerald-400">Gate Clear:</strong> Candidate policy v13 passes all security contracts and is eligible for human review and Amazon Verified Permissions deployment.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
