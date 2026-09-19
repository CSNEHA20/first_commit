import React, { useState } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { SeverityBadge } from "@/components/common/SeverityBadge"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              Suite: AcmePay Security Invariants
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge
              status={failedCount > 0 ? "BLOCKED" : "PASS"}
              label={failedCount > 0 ? `${failedCount} Failures` : "18/18 Pass"}
              size="xs"
            />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Security Contract Invariants & Regression Suite
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Switcher */}
          <div className="flex items-center p-0.5 rounded-md bg-muted border border-border">
            <button
              onClick={() => {
                setSelectedVersion("v12")
                setRegressionReport(null)
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                selectedVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-semibold"
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
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Draft)
            </button>
          </div>

          <Button
            onClick={handleRunSuite}
            disabled={isRunning}
            className="text-xs gap-1.5 h-7 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
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
        className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          gateStatus === "PASS"
            ? "border-status-allow/30 bg-status-allow/[0.03]"
            : "border-status-blocked/30 bg-status-blocked/[0.03]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded ${
              gateStatus === "PASS"
                ? "bg-status-allow/15 text-status-allow"
                : "bg-status-blocked/15 text-status-deny"
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
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {gateDecision?.reasons?.[0] ||
                (gateStatus === "PASS"
                  ? "All 6 organizational security contracts satisfied. Zero blocking violations."
                  : "Blocking Invariant SC-04 failed: Contractor payroll deletion prohibited.")}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono text-muted-foreground shrink-0">
          Duration: {executionDurationMs}ms · Cedar Engine
        </div>
      </div>

      {/* Scoreboard Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Total Scenarios
          </span>
          <span className="text-lg font-bold text-foreground mt-0.5 block">
            {scenarios.length}
          </span>
        </div>

        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Passed
          </span>
          <span className="text-lg font-bold text-status-allow mt-0.5 block">
            {passedCount}
          </span>
        </div>

        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Regressions
          </span>
          <span className="text-lg font-bold text-status-deny mt-0.5 block">
            {failedCount}
          </span>
        </div>

        <div className="p-3 rounded-md border border-border bg-card">
          <span className="text-[10px] font-semibold text-muted-foreground font-sans uppercase block">
            Execution Mode
          </span>
          <span className="text-xs font-bold text-foreground mt-1 block">
            DETERMINISTIC
          </span>
        </div>
      </div>

      {/* Dense Security Contracts Invariant Table */}
      <Card className="border-border bg-card">
        <CardHeader className="p-3.5 pb-2 border-b border-border">
          <CardTitle className="text-xs font-semibold">
            Organizational Security Invariant Contracts (6 Active Invariants)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border text-xs">
            {SECURITY_CONTRACTS.map((c) => {
              const liveContract = regressionReport?.contractResults?.find((r) => r.contractId === c.id)
              const isFailing = liveContract
                ? liveContract.status === "FAIL"
                : selectedVersion === "v13" && c.status === "FAILED"

              return (
                <div
                  key={c.id}
                  className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                    isFailing ? "bg-status-blocked/[0.03]" : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isFailing ? (
                      <XCircle className="h-4 w-4 text-status-deny shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-status-allow shrink-0" />
                    )}

                    <div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-bold text-foreground">{c.id}</code>
                        <span className="font-semibold text-foreground">{c.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {c.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
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
      <Card className="border-border bg-card">
        <CardHeader className="p-3.5 pb-2 border-b border-border">
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
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    filterTag === tag
                      ? "bg-foreground text-background font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border text-xs">
            {filteredScenarios.map((s) => {
              const isPass = s.actualDecision === s.expectedDecision
              return (
                <div
                  key={s.id}
                  className={`p-3 flex items-center justify-between gap-2 transition-colors ${
                    isPass ? "hover:bg-muted/30" : "bg-status-blocked/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isPass ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-status-deny shrink-0" />
                    )}

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <code className="font-mono text-[10px] text-muted-foreground">[{s.id}]</code>
                        <span className="font-medium text-foreground truncate">{s.title}</span>
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">
                        {s.principal} ➔ {s.action} ➔ {s.resource}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-[10px] font-mono hidden sm:block">
                      <span className="text-muted-foreground">Exp: {s.expectedDecision} · Act: </span>
                      <strong className={isPass ? "text-status-allow" : "text-status-deny"}>
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
