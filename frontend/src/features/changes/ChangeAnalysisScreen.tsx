import React, { useState } from "react"
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { SeverityBadge } from "@/components/common/SeverityBadge"
import { EvidenceDrawer } from "@/components/common/EvidenceDrawer"
import {
  BLAST_RADIUS_RESULT,
  TOP_COUNTEREXAMPLES,
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  ACMEPAY_ENTITIES,
} from "@/fixtures/acmepay"
import { Counterexample, CounterexampleReplayResult } from "@/types/authz"
import { replayCounterexample } from "@/lib/api"

export const ChangeAnalysisScreen: React.FC = () => {
  const [selectedCounterexample, setSelectedCounterexample] =
    useState<Counterexample | null>(TOP_COUNTEREXAMPLES[0])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  
  // Replay state
  const [replayingId, setReplayingId] = useState<string | null>(null)
  const [replayResults, setReplayResults] = useState<Record<string, CounterexampleReplayResult>>({})

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
        candidatePolicyText: POLICY_V13_TEXT,
        entities: ACMEPAY_ENTITIES,
      })
      setReplayResults((prev) => ({ ...prev, [cx.id]: res }))
    } catch (err) {
      console.error("Replay error:", err)
    } finally {
      setReplayingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Hero Header & Version Transition */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">
              Baseline: v12 (Production) ➔ Candidate: v13 (Draft)
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge status="BLOCKED" size="xs" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-status-deny" />
            Authorization Change & Blast Radius Analysis
          </h1>
          <p className="text-xs text-muted-foreground">
            Evaluating effective authorization deltas and deterministic counterexamples across declared security contracts.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="px-2 py-1 rounded bg-muted/40 border border-border">
            Bounded Universe: {BLAST_RADIUS_RESULT.universeSize} Scenarios
          </span>
        </div>
      </div>

      {/* Bounded Analysis Disclosure Notice */}
      <div className="p-2.5 rounded-md bg-muted/30 border border-border flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>
          <strong>Scope Disclosure:</strong> Blast radius and counterexample discovery are bounded to the declared scenario universe (432 combinations across 5 principal roles, 4 actions, and 4 resource archetypes).
        </span>
      </div>

      {/* Blast Radius Summary Bar */}
      <div className="p-3.5 rounded-lg border border-status-blocked/30 bg-status-blocked/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Transitions
            </span>
            <span className="font-mono font-bold text-status-deny text-sm">
              +{BLAST_RADIUS_RESULT.newlyAuthorizedCount} Newly Authorized
            </span>
          </div>

          <div className="h-6 w-[1px] bg-border hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Action Scope
            </span>
            <span className="font-mono font-bold text-foreground text-sm">
              +{BLAST_RADIUS_RESULT.deltaActions} Actions
            </span>
          </div>

          <div className="h-6 w-[1px] bg-border hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Exposed Resources
            </span>
            <span className="font-mono font-bold text-foreground text-sm">
              +{BLAST_RADIUS_RESULT.deltaResources} Resources
            </span>
          </div>

          <div className="h-6 w-[1px] bg-border hidden sm:block" />

          <div>
            <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
              Affected Principals
            </span>
            <span className="font-mono font-bold text-foreground text-sm">
              +{BLAST_RADIUS_RESULT.deltaPrincipals} Principals
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <StatusBadge status="BLOCKED" label="3 Invariants Violated" size="sm" />
        </div>
      </div>

      {/* Main Split Investigation Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Code Clause Diff (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <Card className="border-border bg-card">
            <CardHeader className="p-3.5 pb-2 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Policy Clause Diff (v12 vs v13)
                </CardTitle>
                <span className="text-[10px] font-mono text-muted-foreground">Line 24</span>
              </div>
            </CardHeader>

            <CardContent className="p-3 font-mono text-xs space-y-2">
              <div className="p-2 rounded bg-muted/40 text-muted-foreground border border-border text-[11px]">
                // Version 12 (Production Baseline):
              </div>
              <div className="p-2.5 rounded bg-status-deny/10 text-status-deny border border-status-deny/20 text-[11px] leading-relaxed">
                - action == Action::"view",
              </div>

              <div className="p-2 rounded bg-muted/40 text-muted-foreground border border-border text-[11px] mt-2">
                // Version 13 (Candidate Draft - Wildcard Broadening):
              </div>
              <div className="p-2.5 rounded bg-status-allow/10 text-status-allow border border-status-allow/20 text-[11px] leading-relaxed">
                + action, // Broadened across view, edit, delete, export
              </div>

              <div className="pt-2 text-[11px] text-muted-foreground font-sans leading-relaxed border-t border-border mt-3">
                <strong>Mechanism:</strong> Removing the explicit action constraint broadened the permit statement across all 4 declared actions in the schema, overriding the implicit default-deny for contractors.
              </div>
            </CardContent>
          </Card>

          {/* Violated Contracts List */}
          <Card className="border-border bg-card">
            <CardHeader className="p-3.5 pb-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground font-mono">
                Violated Security Invariants
              </span>
            </CardHeader>
            <CardContent className="p-3.5 pt-1 space-y-1.5 text-xs">
              <div className="p-2 rounded bg-muted/30 border border-border flex items-center justify-between">
                <span className="font-mono font-medium text-foreground">SC-04: Contractor payroll deletion</span>
                <StatusBadge status="BLOCKED" size="xs" label="FAIL" />
              </div>
              <div className="p-2 rounded bg-muted/30 border border-border flex items-center justify-between">
                <span className="font-mono font-medium text-foreground">SC-05: Contractor financial export</span>
                <StatusBadge status="BLOCKED" size="xs" label="FAIL" />
              </div>
              <div className="p-2 rounded bg-muted/30 border border-border flex items-center justify-between">
                <span className="font-mono font-medium text-foreground">SC-03: Editor invoice deletion</span>
                <StatusBadge status="BLOCKED" size="xs" label="FAIL" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Top Deterministic Counterexamples (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Deterministic Counterexamples ({TOP_COUNTEREXAMPLES.length} Ranked Findings)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Select finding to inspect evidence
            </span>
          </div>

          <div className="space-y-2.5">
            {TOP_COUNTEREXAMPLES.map((cx) => {
              const replay = replayResults[cx.id]
              const isReplaying = replayingId === cx.id
              const isSelected = selectedCounterexample?.id === cx.id

              return (
                <div
                  key={cx.id}
                  onClick={() => handleOpenEvidence(cx)}
                  className={`p-3.5 rounded-lg border text-xs cursor-pointer transition-all space-y-2.5 ${
                    isSelected
                      ? "border-primary bg-accent/40 shadow-sm"
                      : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={cx.severity as any} />
                      <span className="font-semibold text-foreground">
                        {cx.title || cx.scenarioTitle || cx.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Live Cedar WASM Replay Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isReplaying}
                        onClick={(e) => handleReplayCounterexample(e, cx)}
                        className="text-[11px] gap-1 h-6 text-foreground"
                      >
                        <RefreshCw className={`h-3 w-3 ${isReplaying ? "animate-spin" : ""}`} />
                        <span>{isReplaying ? "Evaluating..." : "Replay in Cedar"}</span>
                      </Button>

                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEvidence(cx)
                        }}
                        className="text-[11px] gap-1 h-6"
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
                      className={`p-2 rounded text-[11px] flex items-center justify-between font-mono ${
                        replay.isReproduced
                          ? "bg-status-allow/10 text-status-allow border border-status-allow/20"
                          : "bg-status-deny/10 text-status-deny border border-status-deny/20"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {replay.isReproduced ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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

                  {/* Scenario Request & Flip Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 font-mono text-[11px]">
                    <div className="p-2 rounded bg-muted/40 border border-border">
                      <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">
                        Principal
                      </span>
                      <span className="text-foreground truncate block font-semibold">{cx.principal}</span>
                    </div>

                    <div className="p-2 rounded bg-muted/40 border border-border">
                      <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">
                        Action
                      </span>
                      <span className="text-status-warning truncate block font-semibold">{cx.action}</span>
                    </div>

                    <div className="p-2 rounded bg-muted/40 border border-border">
                      <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">
                        Resource
                      </span>
                      <span className="text-foreground truncate block font-semibold">{cx.resource}</span>
                    </div>

                    <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">
                          Flip
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <DecisionBadge decision={cx.baselineDecision} size="sm" />
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                          <DecisionBadge decision={cx.candidateDecision} size="sm" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Violated Contract Label */}
                  {cx.violatedContractId && (
                    <div className="text-[11px] text-status-deny font-mono pt-0.5">
                      Violates: <strong>{cx.violatedContractId}</strong> — "{cx.violatedContractTitle}"
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
