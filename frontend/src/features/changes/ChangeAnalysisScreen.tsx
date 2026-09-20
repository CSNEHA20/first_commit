import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  GitCompare,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Share2,
  Database,
  Info,
} from "lucide-react"
import { Card } from "@/components/ui/card"
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
  SECURITY_CONTRACTS,
} from "@/fixtures/acmepay"
import { Counterexample, Scenario, ScenarioSuite } from "@/types/authz"
import {
  comparePolicies,
  generateCounterexamples,
  replayCounterexample,
  PolicyDiffReport,
} from "@/lib/api"
import { buildBlastRadiusGraph } from "./blastRadiusGraphModel"
import { AuthorizationBlastRadiusGraph } from "./AuthorizationBlastRadiusGraph"
import { PolicyDiffPanel } from "./PolicyDiffPanel"
import { RiskImpactSummaryPanel } from "./RiskImpactSummaryPanel"
import { useWorkspace } from "@/store/workspaceStore"

type ChangeAnalysisTab = "impact_graph" | "counterexamples" | "summary"

export const ChangeAnalysisScreen: React.FC = () => {
  const { isDemoMode, activeWorkspace, connectedData, dispatch } = useWorkspace()

  const [activeSubTab, setActiveSubTab] = useState<ChangeAnalysisTab>("impact_graph")
  const [candidateVersion, setCandidateVersion] = useState<"v13" | "v13_fixed">("v13")
  const [selectedCounterexample, setSelectedCounterexample] =
    useState<Counterexample | null>(isDemoMode ? TOP_COUNTEREXAMPLES[0] : null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Live Analysis States
  const [diffReport, setDiffReport] = useState<PolicyDiffReport | null>(null)
  const [counterexamples, setCounterexamples] = useState<Counterexample[]>(isDemoMode ? TOP_COUNTEREXAMPLES : [])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisSource, setAnalysisSource] = useState<"LIVE_BACKEND" | "FIXTURE_PREVIEW" | "LOCAL_CEDAR_WASM">(
    isDemoMode ? "FIXTURE_PREVIEW" : "LOCAL_CEDAR_WASM"
  )
  const [replayingId, setReplayingId] = useState<string | null>(null)

  // Strictly isolate analysis state when workspace switches or mode changes
  useEffect(() => {
    setDiffReport(null)
    setCounterexamples(isDemoMode ? TOP_COUNTEREXAMPLES : [])
    setSelectedCounterexample(isDemoMode ? TOP_COUNTEREXAMPLES[0] : null)
    setAnalysisError(null)
    setAnalysisSource(isDemoMode ? "FIXTURE_PREVIEW" : "LOCAL_CEDAR_WASM")
  }, [activeWorkspace?.id, isDemoMode])

  // Resolve active policies and scenarios
  const effectiveBaselineText = isDemoMode
    ? POLICY_V12_TEXT
    : (connectedData?.baselinePolicyText || "")
  const effectiveCandidateText = isDemoMode
    ? (candidateVersion === "v13" ? POLICY_V13_TEXT : POLICY_V13_FIXED_TEXT)
    : (connectedData?.candidatePolicyText || "")
  const effectiveBaselineLabel = isDemoMode
    ? "v12 (Production Baseline)"
    : (connectedData?.baselineLabel || "Baseline")
  const effectiveCandidateLabel = isDemoMode
    ? (candidateVersion === "v13" ? "v13 (Candidate Draft)" : "v13 (Fixed / Verified)")
    : (connectedData?.candidateLabel || "Candidate")
  const effectiveSchemaText = isDemoMode
    ? ACMEPAY_SCHEMA
    : (connectedData?.schemaText || "")

  const effectiveEntities: Array<Record<string, unknown>> = useMemo(() => {
    if (isDemoMode) return ACMEPAY_ENTITIES
    try {
      if (connectedData?.entitiesJson && connectedData.entitiesJson.trim()) {
        const parsed = JSON.parse(connectedData.entitiesJson)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch {
      // return empty array if parse error
    }
    return []
  }, [isDemoMode, connectedData?.entitiesJson])

  const effectiveScenarios: Scenario[] = useMemo(() => {
    if (isDemoMode) return ACMEPAY_SCENARIO_SUITE.scenarios
    return connectedData?.scenarios || []
  }, [isDemoMode, connectedData?.scenarios])

  const effectiveContracts = useMemo(() => {
    if (isDemoMode) return SECURITY_CONTRACTS
    return connectedData?.contracts || []
  }, [isDemoMode, connectedData?.contracts])

  const effectiveSuite: ScenarioSuite = useMemo(() => {
    if (isDemoMode) return ACMEPAY_SCENARIO_SUITE
    return {
      id: `suite-${activeWorkspace?.id || "workspace"}`,
      name: "Connected Workspace Scenarios",
      scenarios: effectiveScenarios,
    }
  }, [isDemoMode, activeWorkspace?.id, effectiveScenarios])

  // Derive active counterexamples based on candidate version
  const displayCounterexamples = useMemo(() => {
    if (isDemoMode && candidateVersion === "v13_fixed") {
      return []
    }
    return counterexamples
  }, [isDemoMode, candidateVersion, counterexamples])

  // Derive active impact summary and displayed counterexamples
  const impact = useMemo(() => {
    if (diffReport?.impactSummary) {
      return diffReport.impactSummary
    }
    if (isDemoMode && candidateVersion === "v13_fixed") {
      return {
        ...BLAST_RADIUS_RESULT,
        newlyAuthorizedCount: 0,
        deltaActions: 0,
        deltaResources: 0,
        deltaPrincipals: 0,
        unchangedCount: 432,
      }
    }
    if (isDemoMode) {
      return BLAST_RADIUS_RESULT
    }
    return {
      ...BLAST_RADIUS_RESULT,
      universeSize: effectiveScenarios.length,
      newlyAuthorizedCount: displayCounterexamples.length,
      deltaPrincipals: 0,
      deltaActions: 0,
      deltaResources: 0,
      unchangedCount: Math.max(0, effectiveScenarios.length - displayCounterexamples.length),
    }
  }, [diffReport, isDemoMode, candidateVersion, effectiveScenarios.length, displayCounterexamples.length])

  const isBlocked = impact.newlyAuthorizedCount > 0

  // Deterministically compute Blast Radius Graph data model
  const graphData = useMemo(() => {
    return buildBlastRadiusGraph({
      candidateVersion: isDemoMode ? candidateVersion : (isBlocked ? "v13" : "v13_fixed"),
      candidateLabel: effectiveCandidateLabel,
      diffReport,
      counterexamples: displayCounterexamples,
      fallbackImpact: impact,
      fallbackContracts: effectiveContracts,
    })
  }, [isDemoMode, candidateVersion, isBlocked, effectiveCandidateLabel, diffReport, displayCounterexamples, impact, effectiveContracts])

  const handleRunLiveAnalysis = useCallback(async () => {
    if (!effectiveBaselineText.trim() && !effectiveCandidateText.trim()) {
      setAnalysisError("Both baseline and candidate policies are empty. Please provide policy texts to compare.")
      return
    }

    if (!isDemoMode && effectiveScenarios.length === 0) {
      setAnalysisError("Scenario universe is empty. PolicyLab requires declared authorization scenarios to evaluate the differential impact across requests.")
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const [diffRes, cxRes] = await Promise.all([
        comparePolicies({
          baselinePolicyText: effectiveBaselineText,
          candidatePolicyText: effectiveCandidateText,
          schemaText: effectiveSchemaText || undefined,
          entities: effectiveEntities,
          suite: effectiveSuite,
          baselineLabel: effectiveBaselineLabel,
          candidateLabel: effectiveCandidateLabel,
        }),
        generateCounterexamples({
          baselinePolicyText: effectiveBaselineText,
          candidatePolicyText: effectiveCandidateText,
          schemaText: effectiveSchemaText || undefined,
          entities: effectiveEntities,
          suite: effectiveSuite,
          baselineLabel: effectiveBaselineLabel,
          candidateLabel: effectiveCandidateLabel,
        }),
      ])

      setDiffReport(diffRes)
      setCounterexamples(cxRes)
      setAnalysisSource(isDemoMode ? "LIVE_BACKEND" : "LOCAL_CEDAR_WASM")

      if (!isDemoMode && activeWorkspace) {
        dispatch({
          type: "MARK_ANALYSIS_FRESH",
          id: activeWorkspace.id,
          source: "LOCAL_CEDAR_WASM",
        })
      }

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
  }, [
    isDemoMode,
    activeWorkspace,
    effectiveBaselineText,
    effectiveCandidateText,
    effectiveSchemaText,
    effectiveEntities,
    effectiveSuite,
    effectiveScenarios.length,
    effectiveBaselineLabel,
    effectiveCandidateLabel,
    dispatch,
  ])

  const handleOpenEvidence = (cx: Counterexample) => {
    setSelectedCounterexample(cx)
    setIsDrawerOpen(true)
  }

  const handleReplayCounterexample = async (e: React.MouseEvent, cx: Counterexample) => {
    e.stopPropagation()
    setReplayingId(cx.id)
    try {
      await replayCounterexample({
        counterexample: cx,
        baselinePolicyText: effectiveBaselineText,
        candidatePolicyText: effectiveCandidateText,
        entities: effectiveEntities,
      })
    } catch (err) {
      console.error("Replay error:", err)
    } finally {
      setReplayingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stale Analysis Alert */}
      {!isDemoMode && connectedData?.analysisStale && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Policy edits detected. The differential results below do not reflect current candidate policy text. Click &quot;Re-Run Analysis&quot; to re-evaluate with Cedar WASM.</span>
          </div>
          <Button
            size="sm"
            onClick={handleRunLiveAnalysis}
            disabled={isAnalyzing}
            className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold shrink-0"
          >
            Re-Run Analysis
          </Button>
        </div>
      )}

      {/* Hero Header & Version Transition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono">
              Baseline: {effectiveBaselineLabel} ➔ Candidate: {effectiveCandidateLabel}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge
              status={isBlocked ? "BLOCKED" : "PASS"}
              size="sm"
              label={isBlocked ? "Gate: BLOCKED (Divergence Detected)" : "Gate: PASS"}
            />
            <span className="text-muted-foreground/40">·</span>
            {!isDemoMode ? (
              <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono gap-1">
                <Database className="h-3 w-3" />
                LOCAL_CEDAR_WASM
              </Badge>
            ) : analysisSource === "LIVE_BACKEND" ? (
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
            <GitCompare className="h-6 w-6 text-orange-400" />
            Policy Differential & Blast Radius Analysis
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDemoMode && (
            <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
              <button
                onClick={() => {
                  setCandidateVersion("v13")
                  setDiffReport(null)
                  setCounterexamples(TOP_COUNTEREXAMPLES)
                  setAnalysisSource("FIXTURE_PREVIEW")
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  candidateVersion === "v13"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                v13 (Regressive Draft)
              </button>
              <button
                onClick={() => {
                  setCandidateVersion("v13_fixed")
                  setDiffReport(null)
                  setCounterexamples([])
                  setAnalysisSource("FIXTURE_PREVIEW")
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  candidateVersion === "v13_fixed"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                v13 (Fixed / Verified)
              </button>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleRunLiveAnalysis}
            disabled={isAnalyzing}
            className="gap-1.5 text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all hover:scale-105 shadow-md shadow-orange-500/20"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
            <span>{isAnalyzing ? "Analyzing AST..." : "Run Analysis"}</span>
          </Button>
        </div>
      </div>

      {/* Analysis Error Notification */}
      {analysisError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block text-red-200">Analysis Error</span>
            <p className="leading-relaxed">{analysisError}</p>
          </div>
        </div>
      )}

      {/* Empty scenarios guide for connected workspaces */}
      {!isDemoMode && effectiveScenarios.length === 0 && (
        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2 text-xs text-blue-200">
          <div className="flex items-center gap-2 font-semibold text-sm text-blue-100">
            <Info className="h-4 w-4 text-blue-400" />
            <span>Declared Scenarios Required for Full Differential Analysis</span>
          </div>
          <p className="leading-relaxed text-muted-foreground">
            PolicyLab evaluates Cedar AST policy differentials over a declared scenario universe (principals, actions, resources, and contexts).
            Import scenarios via the Setup Wizard or test individual authorizations interactively in the Cedar Simulator.
          </p>
        </div>
      )}

      {/* Summary KPI Panel */}
      <RiskImpactSummaryPanel
        stats={graphData.stats}
        isBlocked={isBlocked}
      />

      {/* Subtabs for Deep Navigation */}
      <div className="flex items-center gap-1 border-b border-white/[0.08] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("impact_graph")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            activeSubTab === "impact_graph"
              ? "bg-white/[0.08] text-foreground font-semibold border border-white/[0.06]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Share2 className="h-3.5 w-3.5 text-orange-400" />
          <span>Interactive Blast Radius Graph</span>
        </button>

        <button
          onClick={() => setActiveSubTab("counterexamples")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            activeSubTab === "counterexamples"
              ? "bg-white/[0.08] text-foreground font-semibold border border-white/[0.06]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
          <span>Top Counterexamples ({displayCounterexamples.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("summary")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            activeSubTab === "summary"
              ? "bg-white/[0.08] text-foreground font-semibold border border-white/[0.06]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileSearch className="h-3.5 w-3.5 text-sky-400" />
          <span>Policy AST Diff</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeSubTab === "impact_graph" && (
        <AuthorizationBlastRadiusGraph
          graphData={graphData}
          onSelectCounterexample={(cxId: string) => {
            const found = displayCounterexamples.find((c) => c.id === cxId)
            if (found) handleOpenEvidence(found)
          }}
        />
      )}

      {activeSubTab === "counterexamples" && (
        <div className="space-y-3">
          {displayCounterexamples.length === 0 ? (
            <Card className="glass-card-premium rounded-2xl p-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-semibold text-foreground">Zero Regressions or Counterexamples</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                No authorization drift or newly-permitted access violations were found across the declared scenario universe.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {displayCounterexamples.map((cx) => (
                <Card
                  key={cx.id}
                  onClick={() => handleOpenEvidence(cx)}
                  className="glass-card-premium rounded-xl p-3.5 border border-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={(cx.severity as any) || "HIGH"} />
                      <span className="font-mono text-xs font-bold text-foreground">{cx.id}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-foreground font-medium">{cx.scenarioId || cx.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleReplayCounterexample(e, cx)}
                        disabled={replayingId === cx.id}
                        className="h-6 text-[10px] px-2 border-white/[0.08] hover:bg-white/[0.05]"
                      >
                        {replayingId === cx.id ? "Replaying..." : "Replay in Cedar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEvidence(cx)
                        }}
                        className="h-6 text-[10px] px-2 text-orange-400 hover:text-orange-300"
                      >
                        Evidence Drawer ➔
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-black/40 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Principal:</span>
                      <span className="text-foreground truncate block">{cx.principal}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Action:</span>
                      <span className="text-foreground truncate block">{cx.action}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Resource:</span>
                      <span className="text-foreground truncate block">{cx.resource}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Baseline:</span>
                      <DecisionBadge decision={cx.baselineDecision} size="sm" />
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Candidate:</span>
                      <DecisionBadge decision={cx.candidateDecision} size="sm" />
                    </div>

                    <span className="text-[10px] text-rose-400 font-medium">
                      {cx.explanation}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === "summary" && (
        <PolicyDiffPanel
          candidateVersion={isDemoMode ? candidateVersion : "v13"}
        />
      )}

      {/* Grounded Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        counterexample={selectedCounterexample}
      />
    </div>
  )
}
