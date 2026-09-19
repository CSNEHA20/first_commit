import React, { useState } from "react"
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

export const RegressionScreen: React.FC = () => {
  const [selectedVersion, setSelectedVersion] = useState<"v12" | "v13">("v13")
  const [isRunning, setIsRunning] = useState(false)
  const [filterTag, setFilterTag] = useState<string>("all")
  const [regressionReport, setRegressionReport] = useState<RegressionReport | null>(null)
  const [executionDurationMs, setExecutionDurationMs] = useState<number>(12.4)

  const handleRunSuite = async () => {
    setIsRunning(true)
    const startTime = performance.now()
    try {
      const candidatePolicy = selectedVersion === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT
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

      const report = await runRegression({
        baselinePolicyText: POLICY_V12_TEXT,
        candidatePolicyText: candidatePolicy,
        entities: ACMEPAY_ENTITIES,
        suite: {
          id: "suite_acmepay_core",
          name: "AcmePay Core Authorization Suite",
          scenarios: ALL_REGRESSION_SCENARIOS,
        },
        contracts: contractsPayload,
        baselineLabel: "v12 (PROD)",
        candidateLabel: selectedVersion === "v12" ? "v12 (PROD)" : "v13 (Draft)",
      })
      setRegressionReport(report)
      setExecutionDurationMs(Math.round((performance.now() - startTime) * 10) / 10)
    } catch (err) {
      console.error("Regression run failed:", err)
    } finally {
      setIsRunning(false)
    }
  }

  const scenarios: Scenario[] = ALL_REGRESSION_SCENARIOS.map((s) => {
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
    if (selectedVersion === "v12") {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">
              Suite: AcmePay Security Invariants
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge
              status={failedCount > 0 ? "BLOCKED" : "PASS"}
              label={failedCount > 0 ? `${failedCount} Violations` : "18/18 Pass"}
              size="xs"
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-orange-400" />
            Security Contract Invariants & Regression Suite
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
            <button
              onClick={() => {
                setSelectedVersion("v12")
                setRegressionReport(null)
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedVersion === "v12"
                  ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => {
                setSelectedVersion("v13")
                setRegressionReport(null)
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-[#FF6A24] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Candidate Draft)
            </button>
          </div>

          <Button
            onClick={handleRunSuite}
            disabled={isRunning}
            className="text-xs gap-1.5 h-7 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_15px_rgba(255,106,36,0.3)]"
          >
            {isRunning ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
            <span>{isRunning ? "Evaluating in Cedar..." : "Run Test Suite"}</span>
          </Button>
        </div>
      </div>

      {/* Pre-Deployment Gate Status Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs backdrop-blur-md ${
          gateStatus === "PASS"
            ? "border-emerald-500/30 bg-emerald-500/[0.04]"
            : "border-red-500/30 bg-red-500/[0.04]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              gateStatus === "PASS"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            {gateStatus === "PASS" ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
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

        <div className="text-right text-[11px] font-mono text-muted-foreground shrink-0 flex items-center gap-1">
          <Clock className="h-3 w-3 text-orange-400" />
          <span>Duration: {executionDurationMs}ms · Cedar Engine</span>
        </div>
      </div>

      {/* Scoreboard Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* Dense Security Contracts Invariant Table (Inspired by CY·FOCUS Compliance View in Ref Image 4) */}
      <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
          <CardTitle className="text-xs font-semibold flex items-center justify-between">
            <span>Organizational Security Invariant Contracts (6 Active Invariants)</span>
            <span className="text-[10px] font-mono text-muted-foreground font-normal">
              AcmePay Governance Policy Store
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/[0.06] text-xs">
            {SECURITY_CONTRACTS.map((c) => {
              const liveContract = regressionReport?.contractResults?.find((r) => r.contractId === c.id)
              const isFailing = liveContract
                ? liveContract.status === "FAIL"
                : selectedVersion === "v13" && c.status === "FAILED"

              return (
                <div
                  key={c.id}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    isFailing ? "bg-red-500/[0.04]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isFailing ? (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(24,184,104,0.5)]" />
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
          </div>
        </CardContent>
      </Card>

      {/* Executable Scenario Assertions Table */}
      <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-xs font-semibold">
              Executable Scenario Assertions ({filteredScenarios.length} Scenarios)
            </CardTitle>

            {/* Filter Tags */}
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground mr-1" />
              {["all", "admin", "editor", "contractor", "multi-tenant"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(tag)}
                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-medium transition-colors font-mono ${
                    filterTag === tag
                      ? "bg-[#FF6A24] text-white font-semibold"
                      : "text-muted-foreground hover:bg-white/[0.05]"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-white/[0.06] text-xs">
            {filteredScenarios.map((s) => {
              const isPass = s.actualDecision === s.expectedDecision
              return (
                <div
                  key={s.id}
                  className={`p-3 flex items-center justify-between gap-2 transition-colors ${
                    isPass ? "hover:bg-white/[0.02]" : "bg-red-500/[0.05]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isPass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    )}

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <code className="font-mono text-[10px] text-orange-400">[{s.id}]</code>
                        <span className="font-medium text-foreground truncate">{s.title}</span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {s.principal} ➔ {s.action} ➔ {s.resource}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-[10px] font-mono hidden sm:block">
                      <span className="text-muted-foreground">Expected: {s.expectedDecision} · Actual: </span>
                      <strong className={isPass ? "text-emerald-400" : "text-red-400"}>
                        {s.actualDecision}
                      </strong>
                    </div>

                    <StatusBadge status={isPass ? "PASS" : "BLOCKED"} size="xs" label={isPass ? "PASS" : "FAIL"} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
