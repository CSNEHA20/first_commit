import React, { useState } from "react"
import {
  GitCompare,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  FileCheck2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  const [activeDiffTab, setActiveDiffTab] = useState<"behavioral" | "textual">("behavioral")
  
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Screen Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono">
              v12 (Production Baseline) ➔ v13 (Proposed Candidate)
            </Badge>
            <Badge variant="destructive" className="font-semibold text-xs">
              1 Critical Regression
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-indigo-500" />
            Authorization Change Analysis
          </h1>
          <p className="text-xs text-muted-foreground">
            Evaluating effective authorization behavior deltas and deterministic counterexamples across the declared scenario universe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">
            Bounded Universe: {BLAST_RADIUS_RESULT.universeSize} Scenarios
          </Badge>
        </div>
      </div>

      {/* HERO CARD: Authorization Blast Radius */}
      <Card className="border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-card to-background shadow-lg">
        <CardHeader className="p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 shadow-inner">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  Authorization Blast Radius
                  <span className="text-xs font-normal text-rose-500 font-mono px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                    High Risk Delta
                  </span>
                </CardTitle>
                <CardDescription>
                  Quantified impact of modifying the action clause in candidate version v13
                </CardDescription>
              </div>
            </div>

            <Badge variant="blocked" className="self-start sm:self-auto text-xs px-3 py-1">
              ⛔ DEPLOYMENT BLOCKED
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-3 space-y-5">
          {/* Big Number Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-background/80 border border-border text-center shadow-sm">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Action Surface Delta
              </span>
              <p className="text-3xl font-extrabold font-mono text-rose-500 mt-1">
                +{BLAST_RADIUS_RESULT.deltaActions}
              </p>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                delete, export, and edit broadened
              </span>
            </div>

            <div className="p-4 rounded-xl bg-background/80 border border-border text-center shadow-sm">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Resources Exposed
              </span>
              <p className="text-3xl font-extrabold font-mono text-rose-500 mt-1">
                +{BLAST_RADIUS_RESULT.deltaResources}
              </p>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Invoices, PayrollReports & Records
              </span>
            </div>

            <div className="p-4 rounded-xl bg-background/80 border border-border text-center shadow-sm">
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                Principals Affected
              </span>
              <p className="text-3xl font-extrabold font-mono text-rose-500 mt-1">
                +{BLAST_RADIUS_RESULT.deltaPrincipals}
              </p>
              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                Editors, Contractors & Support
              </span>
            </div>
          </div>

          {/* Newly Authorized Banner List */}
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs space-y-1.5">
            <span className="font-bold text-rose-500 uppercase tracking-wider text-[11px] block">
              Newly Authorized Operations ({BLAST_RADIUS_RESULT.newlyAuthorizedCount} Transitions: DENY ➔ ALLOW)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-foreground font-medium">
              <div className="p-2 rounded bg-background/60 border border-border">
                • Contractor ➔ DELETE ➔ Invoice
              </div>
              <div className="p-2 rounded bg-background/60 border border-border text-rose-500 font-bold">
                • Contractor ➔ EXPORT ➔ Payroll
              </div>
              <div className="p-2 rounded bg-background/60 border border-border text-rose-500 font-bold">
                • Editor ➔ DELETE ➔ Invoice
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs: Behavioral vs Textual Diff */}
      <Tabs value={activeDiffTab} onValueChange={(v) => setActiveDiffTab(v as any)}>
        <div className="flex items-center justify-between border-b border-border pb-3">
          <TabsList className="bg-muted">
            <TabsTrigger value="behavioral" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Behavioral & Counterexample Matrix
            </TabsTrigger>
            <TabsTrigger value="textual" className="text-xs gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5" />
              Textual Code Diff
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>Click any finding to inspect Cedar evidence & Bedrock explanation</span>
          </div>
        </div>

        {/* Tab 1: Behavioral Diff & Counterexamples */}
        <TabsContent value="behavioral" className="mt-4 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Top Deterministic Counterexamples (Ranked by Risk)
              </h2>
              <span className="text-xs text-muted-foreground">
                Showing {TOP_COUNTEREXAMPLES.length} high-severity findings
              </span>
            </div>

            <div className="space-y-3">
              {TOP_COUNTEREXAMPLES.map((cx) => {
                const replay = replayResults[cx.id]
                const isReplaying = replayingId === cx.id

                return (
                  <div
                    key={cx.id}
                    onClick={() => handleOpenEvidence(cx)}
                    className="p-4 rounded-xl border border-border bg-card hover:border-rose-500/50 hover:bg-muted/30 cursor-pointer transition-all space-y-3 group shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <SeverityBadge severity={cx.severity as any} />
                        <h3 className="text-sm font-bold text-foreground group-hover:text-rose-500 transition-colors">
                          {cx.title || cx.scenarioTitle || cx.id}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Live Replay Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isReplaying}
                          onClick={(e) => handleReplayCounterexample(e, cx)}
                          className="text-xs gap-1.5 h-7 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <RefreshCw className={`h-3 w-3 ${isReplaying ? "animate-spin" : ""}`} />
                          {isReplaying ? "Verifying..." : "Replay in Cedar"}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEvidence(cx)
                          }}
                          className="text-xs gap-1.5 h-7 text-indigo-500 border-indigo-500/30 hover:bg-indigo-500/10"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                          Inspect Evidence
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Replay Status Alert if replayed */}
                    {replay && (
                      <div
                        className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                          replay.isReproduced
                            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 border border-rose-500/20 text-rose-500"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {replay.isReproduced ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="font-mono text-[11px]">
                            {replay.isReproduced
                              ? `✓ 100% Deterministically Reproduced by Cedar WASM (${replay.replayedBaselineDecision} ➔ ${replay.replayedCandidateDecision})`
                              : `Replay Mismatch: ${replay.mismatchReason}`}
                          </span>
                        </div>
                        <Badge variant={replay.isReproduced ? "allow" : "destructive"} className="text-[10px]">
                          {replay.isReproduced ? "REPRODUCED" : "MISMATCH"}
                        </Badge>
                      </div>
                    )}

                    {/* Scenario Details Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Principal
                        </span>
                        <code className="font-mono text-foreground font-semibold truncate block">
                          {cx.principal}
                        </code>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Action
                        </span>
                        <code className="font-mono text-amber-500 font-semibold truncate block">
                          {cx.action}
                        </code>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                        <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Resource
                        </span>
                        <code className="font-mono text-sky-500 font-semibold truncate block">
                          {cx.resource}
                        </code>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                            Decision Flip
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <DecisionBadge decision={cx.baselineDecision} size="sm" />
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <DecisionBadge decision={cx.candidateDecision} size="sm" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Violated Contract Banner */}
                    {cx.violatedContractId && (
                      <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-500 font-medium flex items-center justify-between">
                        <span>
                          Violated Invariant: <strong>{cx.violatedContractId}</strong> — "{cx.violatedContractTitle}"
                        </span>
                        <Badge variant="blocked" className="text-[9px]">
                          Violated
                        </Badge>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Textual Diff */}
        <TabsContent value="textual" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Textual Cedar Policy Diff (v12 vs v13)</CardTitle>
              <CardDescription>
                Side-by-side AST line comparison highlighting modified clauses.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 font-mono text-xs overflow-x-auto space-y-1">
              <div className="text-muted-foreground">// Policy clause comparison:</div>
              <div className="p-2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                - action in [Action::"view", Action::"edit"],
              </div>
              <div className="p-2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                + action, // Broadened to include delete and export accidentally!
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Slide-over Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        counterexample={selectedCounterexample}
      />
    </div>
  )
}
