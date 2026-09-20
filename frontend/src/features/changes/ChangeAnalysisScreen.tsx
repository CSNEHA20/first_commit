import React, { useState, useCallback } from "react"
import {
  GitCompare,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Code2,
  ChevronRight,
  Info,
  ShieldAlert,
  Play,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/common/StatusBadge"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { SeverityBadge } from "@/components/common/SeverityBadge"
import { EvidenceDrawer } from "@/components/common/EvidenceDrawer"
import {
  BLAST_RADIUS_RESULT,
  TOP_COUNTEREXAMPLES,
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  POLICY_V13_FIXED_TEXT,
  ACMEPAY_ENTITIES,
  ACMEPAY_SCHEMA,
  ACMEPAY_SCENARIO_SUITE,
} from "@/fixtures/acmepay"
import { Counterexample, CounterexampleReplayResult } from "@/types/authz"
import {
  comparePolicies,
  generateCounterexamples,
  replayCounterexample,
  PolicyDiffReport,
} from "@/lib/api"

export const ChangeAnalysisScreen: React.FC = () => {
  const [candidateVersion, setCandidateVersion] = useState<"v13" | "v13_fixed">("v13")
  const [selectedCounterexample, setSelectedCounterexample] =
    useState<Counterexample | null>(TOP_COUNTEREXAMPLES[0])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Live Analysis States
  const [diffReport, setDiffReport] = useState<PolicyDiffReport | null>(null)
  const [counterexamples, setCounterexamples] = useState<Counterexample[]>(TOP_COUNTEREXAMPLES)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisSource, setAnalysisSource] = useState<"LIVE_BACKEND" | "FIXTURE_PREVIEW">("FIXTURE_PREVIEW")
  const [analysisDurationMs, setAnalysisDurationMs] = useState<number | null>(null)
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null)

  // Replay States
  const [replayingId, setReplayingId] = useState<string | null>(null)
  const [replayResults, setReplayResults] = useState<Record<string, CounterexampleReplayResult>>({})

  const candidatePolicyText =
    candidateVersion === "v13" ? POLICY_V13_TEXT : POLICY_V13_FIXED_TEXT
  const candidateLabel =
    candidateVersion === "v13" ? "v13 (Candidate Draft)" : "v13 (Fixed / Verified)"

  const handleRunLiveAnalysis = useCallback(async () => {
    setIsAnalyzing(true)
    setAnalysisError(null)
    const startTime = performance.now()

    try {
      const [diffRes, cxRes] = await Promise.all([
        comparePolicies({
          baselinePolicyText: POLICY_V12_TEXT,
          candidatePolicyText,
          schemaText: ACMEPAY_SCHEMA,
          entities: ACMEPAY_ENTITIES,
          suite: ACMEPAY_SCENARIO_SUITE,
          baselineLabel: "v12 (Production Baseline)",
          candidateLabel,
        }),
        generateCounterexamples({
          baselinePolicyText: POLICY_V12_TEXT,
          candidatePolicyText,
          schemaText: ACMEPAY_SCHEMA,
          entities: ACMEPAY_ENTITIES,
          suite: ACMEPAY_SCENARIO_SUITE,
          baselineLabel: "v12 (Production Baseline)",
          candidateLabel,
        }),
      ])

      const duration = Math.round((performance.now() - startTime) * 10) / 10
      setDiffReport(diffRes)
      setCounterexamples(cxRes)
      setAnalysisSource("LIVE_BACKEND")
      setAnalysisDurationMs(duration)
      setLastAnalyzedAt(new Date().toLocaleTimeString())

      if (cxRes.length > 0) {
        setSelectedCounterexample(cxRes[0])
      } else {
        setSelectedCounterexample(null)
      }
    } catch (err: any) {
      console.error("Live analysis failed:", err)
      setAnalysisError(
        err.message || "Live backend analysis failed. Please verify Cedar backend service is running."
      )
    } finally {
      setIsAnalyzing(false)
    }
  }, [candidatePolicyText, candidateLabel])

  const handleOpenEvidence = (cx: Counterexample) => {
    setSelectedCounterexample(cx)
    setIsDrawerOpen(true)
  }

  const handleReplayCounterexample = async (e: React.MouseEvent, cx: Counterexample) => {
    e.stopPropagation()
    setReplayingId(cx.id)
    try {
      const res = await replayCounterexample({
        counterexample: cx,
        baselinePolicyText: POLICY_V12_TEXT,
        candidatePolicyText,
        entities: ACMEPAY_ENTITIES,
      })
      setReplayResults((prev) => ({ ...prev, [cx.id]: res }))
    } catch (err) {
      console.error("Replay error:", err)
    } finally {
      setReplayingId(null)
    }
  }

  // Derive active impact summary and displayed counterexamples
  const impact = diffReport?.impactSummary ?? BLAST_RADIUS_RESULT
  const displayCounterexamples = counterexamples
  const isBlocked = impact.newlyAuthorizedCount > 0

  const totalScenarios = diffReport
    ? diffReport.impactSummary.totalScenariosCompared
    : (BLAST_RADIUS_RESULT.universeSize || 432)

  const coveragePct = diffReport
    ? diffReport.impactSummary.comparisonCoveragePct
    : 100

  return (
    <div className="space-y-4">
      {/* Hero Header & Version Transition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              Baseline: v12 (Production) ➔ Candidate: {candidateVersion === "v13" ? "v13 (Draft)" : "v13 (Fixed)"}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge
              status={isBlocked ? "BLOCKED" : "PASS"}
              size="xs"
              label={isBlocked ? "Gate: BLOCKED" : "Gate: PASS"}
            />
            <span className="text-muted-foreground/40">·</span>
            {analysisSource === "LIVE_BACKEND" ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono gap-1">
                <CheckCircle2 className="h-3 w-3" />
                LIVE BACKEND RESULT
              </Badge>
            ) : (
              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono">
                FIXTURE PREVIEW
              </Badge>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <GitCompare className="h-6 w-6 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
            Authorization Change & Blast Radius Analysis
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            Evaluating effective authorization deltas and deterministic counterexamples across declared security contracts.
          </p>
        </div>

        {/* Action Bar: Candidate Version Selector & Run Live Analysis */}
        <div className="flex items-center gap-2">
          {/* Candidate Version Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
            <button
              onClick={() => {
                setCandidateVersion("v13")
                setAnalysisSource("FIXTURE_PREVIEW")
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                candidateVersion === "v13"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Draft Bug)
            </button>
            <button
              onClick={() => {
                setCandidateVersion("v13_fixed")
                setAnalysisSource("FIXTURE_PREVIEW")
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                candidateVersion === "v13_fixed"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Fixed)
            </button>
          </div>

          <Button
            size="sm"
            onClick={handleRunLiveAnalysis}
            disabled={isAnalyzing}
            className="gap-1.5 text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-[0_0_16px_rgba(249,115,22,0.4)] transition-all hover:scale-105"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                <span>Running Cedar Analysis...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Run Live Analysis</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Analysis Error Alert */}
      {analysisError && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{analysisError}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunLiveAnalysis}
            className="h-6 text-[10px] border-red-500/40 hover:bg-red-500/20 text-red-300"
          >
            Retry Analysis
          </Button>
        </div>
      )}

      {/* Bounded Analysis Disclosure Notice (Glass Capsule) */}
      <div className="glass-card-premium p-3.5 rounded-2xl flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <Info className="h-4 w-4 text-orange-400 shrink-0" />
          <span>
            <strong className="text-foreground">Scope Disclosure:</strong> Blast radius and counterexample discovery are bounded to the declared scenario universe ({totalScenarios} evaluated combinations).
          </span>
        </div>
        {lastAnalyzedAt && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0 ml-2">
            <Clock className="h-3 w-3 text-orange-400" />
            <span>Last Run: {lastAnalyzedAt} ({analysisDurationMs}ms)</span>
          </div>
        )}
      </div>

      {/* Blast Radius Summary Bar (Luminous Frosted Glass Panel) */}
      <div
        className={`glass-panel-premium relative p-4 sm:p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl transition-all ${
          isBlocked ? "border-red-500/30" : "border-emerald-500/30"
        }`}
      >
        <div
          className={`absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent pointer-events-none ${
            isBlocked ? "via-red-500/40" : "via-emerald-500/40"
          } to-transparent`}
        />

        <div className="flex items-center gap-6 text-xs flex-wrap">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
              Transitions
            </span>
            <span
              className={`font-mono font-black text-base sm:text-lg ${
                impact.newlyAuthorizedCount > 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              +{impact.newlyAuthorizedCount} Newly Authorized
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/[0.12] hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
              Action Scope
            </span>
            <span className="font-mono font-black text-foreground text-base sm:text-lg">
              +{impact.deltaActions} Actions
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/[0.12] hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
              Exposed Resources
            </span>
            <span className="font-mono font-black text-foreground text-base sm:text-lg">
              +{impact.deltaResources} Resources
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/[0.12] hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
              Affected Principals
            </span>
            <span className="font-mono font-black text-foreground text-base sm:text-lg">
              +{impact.deltaPrincipals} Principals
            </span>
          </div>

          <div className="h-8 w-[1px] bg-white/[0.12] hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
              Coverage
            </span>
            <span className="font-mono font-black text-orange-400 text-base sm:text-lg">
              {coveragePct}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <StatusBadge
            status={isBlocked ? "BLOCKED" : "PASS"}
            label={isBlocked ? `${impact.newlyAuthorizedCount} Regressions Detected` : "Clean Conformance"}
            size="sm"
          />
        </div>
      </div>

      {/* Main Split Investigation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Code Clause Diff (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="glass-card-premium">
            <CardHeader className="p-4 border-b border-white/[0.08]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-orange-400" />
                  Policy Clause Diff (v12 vs {candidateVersion === "v13" ? "v13" : "v13-fixed"})
                </CardTitle>
                <span className="text-[10px] font-mono text-muted-foreground font-semibold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08]">
                  Line 18-24
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 font-mono text-xs space-y-2.5">
              <div className="p-2.5 rounded-xl bg-black/40 text-muted-foreground border border-white/[0.08] text-[11px]">
                // Version 12 (Production Baseline):
              </div>
              <div className="p-3 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-[11px] leading-relaxed shadow-[0_0_12px_rgba(239,68,68,0.15)]">
                - action in [Action::"view", Action::"edit"],
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 text-muted-foreground border border-white/[0.08] text-[11px] mt-2">
                {candidateVersion === "v13"
                  ? "// Version 13 (Candidate Draft - Wildcard Broadening):"
                  : "// Version 13 Fixed (Candidate Verified - Constrained Actions):"}
              </div>
              <div
                className={`p-3 rounded-xl border text-[11px] leading-relaxed shadow-[0_0_12px_rgba(24,184,104,0.15)] ${
                  candidateVersion === "v13"
                    ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                }`}
              >
                {candidateVersion === "v13"
                  ? "+ action, // ⚠ Broadened across view, edit, delete, export"
                  : "+ action in [Action::\"view\", Action::\"edit\"], // Restored least-privilege"}
              </div>

              <div className="pt-2 text-[11px] text-muted-foreground font-sans leading-relaxed border-t border-white/[0.08] mt-3">
                <strong className="text-foreground">Mechanism:</strong>{" "}
                {candidateVersion === "v13"
                  ? "Removing the explicit action constraint broadened the permit statement across all 4 declared actions in the schema, overriding implicit default-deny."
                  : "Corrected policy re-establishes explicit action constraints, satisfying all declared organizational security invariants."}
              </div>
            </CardContent>
          </Card>

          {/* Violated Contracts List (Glass Card) */}
          <Card className="glass-card-premium">
            <CardHeader className="p-4 pb-2 border-b border-white/[0.08]">
              <span className="text-[10px] font-bold uppercase text-muted-foreground font-mono flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                Security Invariant Verification
              </span>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              {isBlocked ? (
                <>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-red-500/20 flex items-center justify-between backdrop-blur-md">
                    <span className="font-mono font-semibold text-foreground">SC-04: Contractor payroll deletion</span>
                    <StatusBadge status="BLOCKED" size="xs" label="VIOLATED" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-red-500/20 flex items-center justify-between backdrop-blur-md">
                    <span className="font-mono font-semibold text-foreground">SC-05: Contractor financial export</span>
                    <StatusBadge status="BLOCKED" size="xs" label="VIOLATED" />
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/40 border border-red-500/20 flex items-center justify-between backdrop-blur-md">
                    <span className="font-mono font-semibold text-foreground">SC-03: Editor invoice deletion</span>
                    <StatusBadge status="BLOCKED" size="xs" label="VIOLATED" />
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>All 6 Security Contracts Satisfied. Zero Unintended Permissions.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Deterministic Counterexamples (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
              Deterministic Counterexamples ({displayCounterexamples.length} Ranked Findings)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Select finding to inspect forensic evidence
            </span>
          </div>

          {displayCounterexamples.length === 0 ? (
            <div className="glass-card-premium p-8 rounded-2xl text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">Zero Counterexamples Found</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No behavioral regressions were detected between baseline v12 and candidate. All authorization decisions conform to expected invariants.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayCounterexamples.map((cx) => {
                const replay = replayResults[cx.id]
                const isReplaying = replayingId === cx.id
                const isSelected = selectedCounterexample?.id === cx.id

                return (
                  <div
                    key={cx.id}
                    onClick={() => handleOpenEvidence(cx)}
                    className={`glass-card-premium relative p-4 rounded-2xl text-xs cursor-pointer transition-all duration-300 space-y-3 ${
                      isSelected
                        ? "border-orange-500 shadow-[0_0_24px_rgba(255,106,36,0.3)] bg-gradient-to-r from-orange-500/[0.12] via-[#121622]/80 to-[#121622]/80 -translate-y-1"
                        : "hover:border-white/[0.25]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <SeverityBadge severity={cx.severity as any} />
                        <span className="font-bold text-foreground font-mono">
                          {cx.title || cx.scenarioTitle || cx.id}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Live Cedar WASM Replay Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isReplaying}
                          onClick={(e) => handleReplayCounterexample(e, cx)}
                          className="text-[11px] gap-1.5 h-7 text-foreground border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${
                              isReplaying ? "animate-spin text-orange-400" : "text-orange-400"
                            }`}
                          />
                          <span>{isReplaying ? "Evaluating..." : "Replay in Cedar"}</span>
                        </Button>

                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEvidence(cx)
                          }}
                          className="text-[11px] gap-1 h-7 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_12px_rgba(255,106,36,0.3)]"
                        >
                          <FileSearch className="h-3 w-3" />
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Live Replay Confirmation Status */}
                    {replay && (
                      <div
                        className={`p-2.5 rounded-xl text-[11px] flex items-center justify-between font-mono backdrop-blur-md ${
                          replay.isReproduced
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(24,184,104,0.2)]"
                            : "bg-red-500/15 text-red-300 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {replay.isReproduced ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                          )}
                          <span>
                            {replay.isReproduced
                              ? `100% Deterministically Reproduced by Cedar WASM (${replay.replayedBaselineDecision} ➔ ${replay.replayedCandidateDecision})`
                              : `Mismatch: ${replay.mismatchReason}`}
                          </span>
                        </div>
                        <StatusBadge status={replay.isReproduced ? "VERIFIED" : "BLOCKED"} size="xs" />
                      </div>
                    )}

                    {/* Scenario Request & Flip Matrix (Glass Pills) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 font-mono text-[11px]">
                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
                        <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">
                          Principal
                        </span>
                        <span className="text-foreground truncate block font-bold mt-0.5">
                          {cx.principal}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
                        <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">
                          Action
                        </span>
                        <span className="text-orange-400 truncate block font-bold mt-0.5">
                          {cx.action}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
                        <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">
                          Resource
                        </span>
                        <span className="text-foreground truncate block font-bold mt-0.5">
                          {cx.resource}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">
                            Flip
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <DecisionBadge decision={cx.baselineDecision} size="sm" />
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <DecisionBadge decision={cx.candidateDecision} size="sm" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Violated Contract Label */}
                    {cx.violatedContractId && (
                      <div className="text-[11px] text-red-400 font-mono pt-0.5 flex items-center gap-1.5">
                        <span>Violates:</span>
                        <strong>{cx.violatedContractId}</strong>
                        <span className="text-muted-foreground">— "{cx.violatedContractTitle}"</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        counterexample={selectedCounterexample}
      />
    </div>
  )
}
