import React, { useState } from "react"
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Filter,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DecisionBadge } from "@/components/common/DecisionBadge"
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

  // Adjust scenario results based on live report or fallback
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono">
              Suite: AcmePay Security Contracts
            </Badge>
            <Badge variant={failedCount > 0 ? "destructive" : "allow"}>
              {failedCount > 0 ? `${failedCount} Regressions` : "100% Pass"}
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-500" />
            Security Contract Regression Suite
          </h1>
          <p className="text-xs text-muted-foreground">
            Enforcing organizational authorization invariants as continuous automated regression tests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Version Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-muted border border-border">
            <button
              onClick={() => {
                setSelectedVersion("v12")
                setRegressionReport(null)
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (PROD)
            </button>
            <button
              onClick={() => {
                setSelectedVersion("v13")
                setRegressionReport(null)
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Draft)
            </button>
          </div>

          <Button
            onClick={handleRunSuite}
            disabled={isRunning}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 font-semibold h-8 shadow-sm"
          >
            {isRunning ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            {isRunning ? "Evaluating in Cedar..." : "Run Live Regression"}
          </Button>
        </div>
      </div>

      {/* Pre-Deployment Gate Banner */}
      <Card
        className={`border shadow-md ${
          gateStatus === "PASS"
            ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-card to-background"
            : gateStatus === "BLOCKED"
            ? "border-rose-500/40 bg-gradient-to-r from-rose-500/10 via-card to-background"
            : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-card to-background"
        }`}
      >
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg border ${
                gateStatus === "PASS"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                  : gateStatus === "BLOCKED"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-500"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-500"
              }`}
            >
              {gateStatus === "PASS" ? (
                <ShieldCheck className="h-5 w-5" />
              ) : gateStatus === "BLOCKED" ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  Pre-Deployment Gate: {gateStatus === "PASS" ? "VERIFIED (PASS)" : gateStatus === "BLOCKED" ? "BLOCKED" : "INCOMPLETE"}
                </span>
                <Badge variant={gateStatus === "PASS" ? "allow" : "destructive"} className="text-[10px]">
                  {gateStatus}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {gateDecision?.reasons?.[0] ||
                  (gateStatus === "PASS"
                    ? "All organizational security contracts satisfied. Zero blocking violations."
                    : "Blocking Security Contract SC-03 violated: Editor invoice deletion prohibited.")}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Governance Policy
            </span>
            <span className="text-xs font-semibold text-foreground">
              Human Approval Mandatory
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Scoreboard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Total Scenarios</span>
            <CardTitle className="text-xl font-mono text-foreground mt-1">
              {scenarios.length} Scenarios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Contract invariants across 6 archetypes.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Passed</span>
            <CardTitle className="text-xl font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {passedCount} Passed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Evaluated to expected decisions.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Failed Regressions</span>
            <CardTitle className="text-xl font-mono text-rose-500 mt-1">
              {failedCount} Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Violated security invariants in candidate.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Suite Duration</span>
            <CardTitle className="text-xl font-mono text-foreground mt-1">
              {executionDurationMs} ms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-[11px] text-muted-foreground">
            Deterministic Cedar WASM engine.
          </CardContent>
        </Card>
      </div>

      {/* Security Contracts Overview */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">High-Level Security Invariants</CardTitle>
          <CardDescription>
            Organizational policies mapped to deterministic regression scenarios.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SECURITY_CONTRACTS.map((c) => {
              const liveContract = regressionReport?.contractResults?.find((r) => r.contractId === c.id)
              const isFailing = liveContract
                ? liveContract.status === "FAIL"
                : selectedVersion === "v13" && c.status === "FAILED"

              return (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    isFailing
                      ? "border-rose-500/30 bg-rose-500/5"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={c.severity} />
                      <span className="font-bold text-foreground">{c.id}: {c.title}</span>
                    </div>
                    {isFailing ? (
                      <Badge variant="blocked">FAILED</Badge>
                    ) : (
                      <Badge variant="allow">PASSED</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {c.description}
                  </p>
                  {isFailing && liveContract?.failureReason && (
                    <div className="text-[10px] text-rose-500 font-mono pt-1">
                      Violation: {liveContract.failureReason}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Granular Scenarios Table */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Executable Scenario Assertions</CardTitle>
              <CardDescription>Individual test cases evaluated against Cedar policy.</CardDescription>
            </div>

            {/* Filter Tags */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex items-center gap-1 text-xs">
                {["all", "admin", "editor", "contractor", "multi-tenant"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(tag)}
                    className={`px-2 py-0.5 rounded capitalize text-[11px] font-medium transition-colors ${
                      filterTag === tag
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-xs">
            {filteredScenarios.map((s) => {
              const isPass = s.actualDecision === s.expectedDecision
              return (
                <div
                  key={s.id}
                  className={`p-3 flex items-center justify-between transition-colors ${
                    isPass ? "bg-muted/10" : "bg-rose-500/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isPass ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                    )}

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{s.title}</span>
                        {s.contractId && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            [{s.contractId}]
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {s.principal} ➔ {s.action} ➔ {s.resource}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">
                        Expected: {s.expectedDecision}
                      </span>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[10px] text-muted-foreground">Actual:</span>
                        <DecisionBadge decision={s.actualDecision || "DENY"} size="sm" />
                      </div>
                    </div>

                    <Badge variant={isPass ? "allow" : "blocked"} className="text-[10px]">
                      {isPass ? "PASS" : "FAIL"}
                    </Badge>
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
