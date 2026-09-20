import React, { useState, useEffect, useMemo } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { SeverityBadge } from "@/components/common/SeverityBadge"
import { GlassStatCard } from "@/components/common/GlassStatCard"
import {
  SECURITY_CONTRACTS,
  ALL_REGRESSION_SCENARIOS,
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  ACMEPAY_ENTITIES,
} from "@/fixtures/acmepay"
import { RegressionReport, Scenario, SecurityContract } from "@/types/authz"
import { runRegression } from "@/lib/api"
import { useWorkspace } from "@/store/workspaceStore"

export const RegressionScreen: React.FC = () => {
  const { isDemoMode, activeWorkspace, connectedData } = useWorkspace()
  const [selectedVersion, setSelectedVersion] = useState<"v12" | "v13">("v13")
  const [isRunning, setIsRunning] = useState(false)
  const [filterTag, setFilterTag] = useState<string>("all")
  const [regressionReport, setRegressionReport] = useState<RegressionReport | null>(null)
  const [executionDurationMs, setExecutionDurationMs] = useState<number>(12.4)

  // Reset report on workspace switch
  useEffect(() => {
    setRegressionReport(null)
    setFilterTag("all")
  }, [activeWorkspace?.id, isDemoMode])

  const effectiveBaseline = isDemoMode
    ? POLICY_V12_TEXT
    : (connectedData?.baselinePolicyText || "")
  const effectiveCandidate = isDemoMode
    ? (selectedVersion === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT)
    : (connectedData?.candidatePolicyText || "")
  const effectiveBaselineLabel = isDemoMode
    ? "v12 (PROD)"
    : (connectedData?.baselineLabel || "Baseline")
  const effectiveCandidateLabel = isDemoMode
    ? (selectedVersion === "v12" ? "v12 (PROD)" : "v13 (Draft)")
    : (connectedData?.candidateLabel || "Candidate")

  const effectiveEntities = useMemo(() => {
    if (isDemoMode) return ACMEPAY_ENTITIES
    try {
      if (connectedData?.entitiesJson && connectedData.entitiesJson.trim()) {
        const p = JSON.parse(connectedData.entitiesJson)
        return Array.isArray(p) ? p : []
      }
    } catch {
      // ignore
    }
    return []
  }, [isDemoMode, connectedData?.entitiesJson])

  const declaredScenarios: Scenario[] = isDemoMode
    ? ALL_REGRESSION_SCENARIOS
    : (connectedData?.scenarios || [])

  const declaredContracts: SecurityContract[] = isDemoMode
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
    : (connectedData?.contracts || [])

  const handleRunSuite = async () => {
    if (!effectiveBaseline.trim() && !effectiveCandidate.trim()) return
    if (!isDemoMode && declaredScenarios.length === 0) return

    setIsRunning(true)
    const startTime = performance.now()
    try {
      const report = await runRegression({
        baselinePolicyText: effectiveBaseline,
        candidatePolicyText: effectiveCandidate,
        entities: effectiveEntities,
        schemaText: connectedData?.schemaText || undefined,
        suite: {
          id: `suite_${activeWorkspace?.id || "default"}`,
          name: isDemoMode ? "AcmePay Core Authorization Suite" : `${activeWorkspace?.name || "Connected"} Suite`,
          scenarios: declaredScenarios,
        },
        contracts: declaredContracts,
        baselineLabel: effectiveBaselineLabel,
        candidateLabel: effectiveCandidateLabel,
      })
      setRegressionReport(report)
      setExecutionDurationMs(Math.round((performance.now() - startTime) * 10) / 10)
    } catch (err) {
      console.error("Regression run failed:", err)
    } finally {
      setIsRunning(false)
    }
  }

  const scenarios: Scenario[] = declaredScenarios.map((s) => {
    if (regressionReport) {
      const diffMatch = regressionReport.diffReport?.scenarioDiffs?.find(
        (d: any) => d.scenarioId === s.id
      )
      if (diffMatch) {
        return {
          ...s,
          actualDecision: diffMatch.candidateDecision || "DENY",
        }
      }
    }
    if (isDemoMode && selectedVersion === "v12") {
      return {
        ...s,
        actualDecision: s.expectedDecision,
      }
    }
    return s
  })

  const filteredScenarios =
    filterTag === "all"
      ? scenarios
      : scenarios.filter((s) => s.tags.includes(filterTag))

  const passedCount = scenarios.filter((s) => s.actualDecision === s.expectedDecision).length
  const failedCount = scenarios.length - passedCount

  const gateDecision = regressionReport?.gateDecision
  const gateStatus = gateDecision?.status || (selectedVersion === "v12" ? "PASS" : "BLOCKED")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">
              Suite: {isDemoMode ? "AcmePay Security Invariants" : `${activeWorkspace?.name || "Connected"} Suite`}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge
              status={failedCount > 0 ? "BLOCKED" : "PASS"}
              label={failedCount > 0 ? `${failedCount} Violations` : `${passedCount}/${scenarios.length} Pass`}
              size="xs"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-orange-400 shadow-[0_0_12px_rgba(255,106,36,0.6)]" />
            Security Contract Invariants & Regression Suite
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Version Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/[0.12] backdrop-blur-md">
            <button
              onClick={() => {
                setSelectedVersion("v12")
                setRegressionReport(null)
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedVersion === "v12"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => {
                setSelectedVersion("v13")
                setRegressionReport(null)
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedVersion === "v13"
                  ? "bg-[#FF6A24] text-white shadow-[0_0_12px_rgba(255,106,36,0.4)]"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              v13 (Candidate Draft)
            </button>
          </div>

          <Button
            onClick={handleRunSuite}
            disabled={isRunning}
            className="text-xs gap-1.5 h-8 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_20px_rgba(255,106,36,0.4)] transition-transform hover:scale-105"
          >
            {isRunning ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            <span>{isRunning ? "Evaluating in Cedar..." : "Run Test Suite"}</span>
          </Button>
        </div>
      </div>

      {/* Pre-Deployment Gate Status Banner (Glass Panel) */}
      <div
        className={`glass-panel-premium relative p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xl ${
          gateStatus === "PASS"
            ? "border-emerald-500/40 bg-emerald-500/[0.08]"
            : "border-red-500/40 bg-red-500/[0.08]"
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.3] to-transparent pointer-events-none" />

        <div className="flex items-center gap-3.5">
          <div
            className={`p-2.5 rounded-xl ${
              gateStatus === "PASS"
                ? "bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(24,184,104,0.3)]"
                : "bg-red-500/20 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
            }`}
          >
            {gateStatus === "PASS" ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <ShieldAlert className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-foreground text-sm font-mono">
                Pre-Deployment Gate: {gateStatus === "PASS" ? "VERIFIED (PASS)" : "BLOCKED"}
              </span>
              <StatusBadge status={gateStatus} size="xs" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
              {gateDecision?.reasons?.[0] ||
                (gateStatus === "PASS"
                  ? "All 6 organizational security contracts satisfied. Zero blocking violations."
                  : "Blocking Invariant SC-04 failed: Contractor payroll deletion prohibited.")}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono text-muted-foreground shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
          <Clock className="h-3.5 w-3.5 text-orange-400" />
          <span>Duration: {executionDurationMs}ms · Cedar Engine</span>
        </div>
      </div>

      {/* Scoreboard Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassStatCard
          label="Total Scenarios"
          value={scenarios.length}
          subValue="AcmePay Test Suite"
          deltaText="100% Executed"
          deltaType="neutral"
          statusColor="orange"
          chartType="sparkline"
          chartData={[10, 12, 14, 16, 18, 18]}
        />
        <GlassStatCard
          label="Verified Passed"
          value={passedCount}
          subValue="Assertions Satisfied"
          deltaText={`${Math.round((passedCount / scenarios.length) * 100)}% Pass`}
          deltaType="positive"
          statusColor="emerald"
          chartType="bars"
          chartData={[10, 12, 14, 15, 15]}
        />
        <GlassStatCard
          label="Regressions"
          value={failedCount}
          subValue="Invariant Violations"
          deltaText={failedCount > 0 ? "BLOCKING" : "CLEAR"}
          deltaType={failedCount > 0 ? "negative" : "positive"}
          statusColor={failedCount > 0 ? "red" : "emerald"}
          chartType="bars"
          chartData={[0, 1, 2, 3, 3]}
        />
        <GlassStatCard
          label="Engine Mode"
          value="Cedar WASM"
          subValue="Deterministic AST"
          deltaText="Sub-millisecond"
          deltaType="neutral"
          statusColor="cyan"
          chartType="sparkline"
          chartData={[5, 7, 8, 10, 12]}
        />
      </div>

      {/* Dense Security Contracts Invariant Table (Compliance View) */}
      <Card className="glass-card-premium">
        <CardHeader className="p-4 border-b border-white/[0.08]">
          <CardTitle className="text-xs font-bold flex items-center justify-between">
            <span>Organizational Security Invariant Contracts (6 Active Invariants)</span>
            <span className="text-[10px] font-mono text-muted-foreground font-normal">
              AcmePay Governance Policy Store
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {SECURITY_CONTRACTS.map((c) => {
            const liveContract = regressionReport?.contractResults?.find((r) => r.contractId === c.id)
            const isFailing = liveContract
              ? liveContract.status === "FAIL"
              : selectedVersion === "v13" && c.status === "FAILED"

            return (
              <div
                key={c.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all duration-200 backdrop-blur-md hover:-translate-y-0.5 ${
                  isFailing
                    ? "border-red-500/30 bg-red-500/[0.06] shadow-[0_4px_16px_rgba(239,68,68,0.15)]"
                    : "border-white/[0.08] bg-black/30 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isFailing ? (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_8px_rgba(24,184,104,0.6)]" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold text-foreground text-xs">{c.id}</code>
                      <span className="font-semibold text-foreground text-xs">{c.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                      {c.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                  <SeverityBadge severity={c.severity} />
                  <StatusBadge status={isFailing ? "BLOCKED" : "PASS"} size="xs" label={isFailing ? "FAIL" : "PASS"} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Executable Scenario Assertions Table */}
      <Card className="glass-card-premium">
        <CardHeader className="p-4 border-b border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-xs font-bold">
              Executable Scenario Assertions ({filteredScenarios.length} Scenarios)
            </CardTitle>

            {/* Filter Tags */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3 w-3 text-muted-foreground mr-1" />
              {["all", "admin", "editor", "contractor", "multi-tenant"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all font-mono backdrop-blur-sm ${
                    filterTag === tag
                      ? "bg-[#FF6A24] text-white shadow-[0_0_12px_rgba(255,106,36,0.4)]"
                      : "text-muted-foreground hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-2">
          {filteredScenarios.map((s) => {
            const isPass = s.actualDecision === s.expectedDecision
            return (
              <div
                key={s.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition-all duration-200 backdrop-blur-md ${
                  isPass
                    ? "border-white/[0.08] bg-black/30 hover:bg-white/[0.04]"
                    : "border-red-500/30 bg-red-500/[0.07] shadow-[0_4px_16px_rgba(239,68,68,0.15)]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isPass ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(24,184,104,0.5)]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                  )}

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 truncate">
                      <code className="font-mono text-[10px] text-orange-400 font-bold">[{s.id}]</code>
                      <span className="font-bold text-foreground truncate text-xs">{s.title}</span>
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                      {s.principal} ➔ {s.action} ➔ {s.resource}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-[10px] font-mono hidden sm:block">
                    <span className="text-muted-foreground">Expected: {s.expectedDecision} · Actual: </span>
                    <strong className={isPass ? "text-emerald-400" : "text-red-400 font-bold"}>
                      {s.actualDecision}
                    </strong>
                  </div>

                  <StatusBadge status={isPass ? "PASS" : "BLOCKED"} size="xs" label={isPass ? "PASS" : "FAIL"} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
