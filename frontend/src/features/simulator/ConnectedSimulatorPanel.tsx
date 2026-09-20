/**
 * ConnectedSimulatorPanel
 *
 * Freeform Cedar authorization simulator for Connected Workspaces.
 * All evaluation is performed by the local Cedar WASM engine via the existing
 * backend API endpoints. Results are clearly labeled LOCAL_CEDAR_WASM.
 *
 * This panel does NOT use any AcmePay fixture data.
 */

import React, { useState, useCallback } from "react"
import { Zap, Play, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspace } from "@/store/workspaceStore"
import {
  simulateSingleAuthorization,
  simulateBatchScenarios,
  comparePolicies,
  generateCounterexamples,
} from "@/lib/api"
import type { Counterexample, ScenarioSuite } from "@/types/authz"

type SimMode = "single" | "batch" | "compare" | "counterexamples"

const SOURCE_LABEL = "LOCAL_CEDAR_WASM"

export const ConnectedSimulatorPanel: React.FC = () => {
  const { activeWorkspace, connectedData } = useWorkspace()

  const [mode, setMode] = useState<SimMode>("single")
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [counterexamples, setCounterexamples] = useState<Counterexample[]>([])

  // Single mode inputs
  const [principal, setPrincipal] = useState("")
  const [action, setAction] = useState("")
  const [resource, setResource] = useState("")
  const [contextJson, setContextJson] = useState("{}")
  const [targetVersion, setTargetVersion] = useState<"baseline" | "candidate">("candidate")

  const baselinePolicyText = connectedData?.baselinePolicyText || ""
  const candidatePolicyText = connectedData?.candidatePolicyText || ""
  const schemaText = connectedData?.schemaText || ""
  const scenarios = connectedData?.scenarios || []

  const activePolicyText =
    targetVersion === "baseline" ? baselinePolicyText : candidatePolicyText
  const activeLabel =
    targetVersion === "baseline"
      ? (connectedData?.baselineLabel || "Baseline")
      : (connectedData?.candidateLabel || "Candidate")

  const parseEntities = (): Array<Record<string, unknown>> => {
    try {
      if (connectedData?.entitiesJson && connectedData.entitiesJson.trim()) {
        const parsed = JSON.parse(connectedData.entitiesJson)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch {
      // return empty array if invalid
    }
    return []
  }

  const buildSuite = (): ScenarioSuite => ({
    id: `suite-${activeWorkspace?.id || "workspace"}`,
    name: "Connected Workspace Scenarios",
    scenarios,
  })

  const handleRunSingle = useCallback(async () => {
    if (!principal.trim() || !action.trim() || !resource.trim()) {
      setError("Principal, Action, and Resource are all required.")
      return
    }
    let parsedContext: Record<string, unknown> = {}
    try {
      if (contextJson.trim()) parsedContext = JSON.parse(contextJson)
    } catch {
      setError("Context JSON is invalid.")
      return
    }

    setError(null)
    setIsRunning(true)
    setResult(null)

    try {
      const res = await simulateSingleAuthorization({
        principal: principal.trim(),
        action: action.trim(),
        resource: resource.trim(),
        context: parsedContext,
        policyText: activePolicyText,
        schemaText: schemaText || undefined,
        entities: parseEntities(),
      })
      setResult({ type: "single", data: res })
    } catch (err: any) {
      setError(err.message || "Simulation failed.")
    } finally {
      setIsRunning(false)
    }
  }, [principal, action, resource, contextJson, activePolicyText, schemaText])

  const handleRunBatch = useCallback(async () => {
    if (scenarios.length === 0) {
      setError("No scenarios declared. Add scenarios in Workspace Setup.")
      return
    }
    setError(null)
    setIsRunning(true)
    setResult(null)

    try {
      const res = await simulateBatchScenarios({
        policyText: activePolicyText,
        schemaText: schemaText || undefined,
        entities: parseEntities(),
        suite: buildSuite(),
      })
      setResult({ type: "batch", data: res })
    } catch (err: any) {
      setError(err.message || "Batch simulation failed.")
    } finally {
      setIsRunning(false)
    }
  }, [scenarios, activePolicyText, schemaText])

  const handleRunCompare = useCallback(async () => {
    if (scenarios.length === 0) {
      setError("No scenarios declared. Add scenarios in Workspace Setup.")
      return
    }
    setError(null)
    setIsRunning(true)
    setResult(null)

    try {
      const res = await comparePolicies({
        baselinePolicyText,
        candidatePolicyText,
        schemaText: schemaText || undefined,
        entities: parseEntities(),
        suite: buildSuite(),
        baselineLabel: connectedData?.baselineLabel || "Baseline",
        candidateLabel: connectedData?.candidateLabel || "Candidate",
      })
      setResult({ type: "compare", data: res })
    } catch (err: any) {
      setError(err.message || "Policy comparison failed.")
    } finally {
      setIsRunning(false)
    }
  }, [scenarios, baselinePolicyText, candidatePolicyText, schemaText, connectedData])

  const handleRunCounterexamples = useCallback(async () => {
    if (scenarios.length === 0) {
      setError("No scenarios declared. Add scenarios in Workspace Setup.")
      return
    }
    setError(null)
    setIsRunning(true)
    setCounterexamples([])

    try {
      const res = await generateCounterexamples({
        baselinePolicyText,
        candidatePolicyText,
        schemaText: schemaText || undefined,
        entities: parseEntities(),
        suite: buildSuite(),
        baselineLabel: connectedData?.baselineLabel || "Baseline",
        candidateLabel: connectedData?.candidateLabel || "Candidate",
      })
      setCounterexamples(res)
      setResult({ type: "counterexamples", count: res.length })
    } catch (err: any) {
      setError(err.message || "Counterexample generation failed.")
    } finally {
      setIsRunning(false)
    }
  }, [scenarios, baselinePolicyText, candidatePolicyText, schemaText, connectedData])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono text-[10px]">
              {SOURCE_LABEL}
            </Badge>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">{activeWorkspace?.name || "Connected"}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            Cedar Authorization Simulator
          </h1>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs">
          {(
            [
              { id: "single", label: "Single Request" },
              { id: "batch", label: `Batch (${scenarios.length})` },
              { id: "compare", label: "Compare Versions" },
              { id: "counterexamples", label: "Counterexamples" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id)
                setError(null)
                setResult(null)
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                mode === m.id
                  ? "bg-white/[0.1] text-white font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Forms */}
      {mode === "single" && (
        <Card className="glass-card-premium border-white/[0.08]">
          <CardHeader className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-mono font-bold text-foreground">
                Single Authorization Request
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Target Policy:</span>
                <button
                  onClick={() => setTargetVersion("baseline")}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                    targetVersion === "baseline"
                      ? "bg-white/[0.1] text-white font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {connectedData?.baselineLabel || "Baseline"}
                </button>
                <button
                  onClick={() => setTargetVersion("candidate")}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${
                    targetVersion === "candidate"
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {connectedData?.candidateLabel || "Candidate"}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1 font-mono">
                  Principal <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder='User::"alice"'
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="w-full text-xs font-mono bg-black/40 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1 font-mono">
                  Action <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder='Action::"view"'
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full text-xs font-mono bg-black/40 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1 font-mono">
                  Resource <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder='Document::"doc_123"'
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  className="w-full text-xs font-mono bg-black/40 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1 font-mono">
                Context JSON (optional)
              </label>
              <textarea
                rows={2}
                value={contextJson}
                onChange={(e) => setContextJson(e.target.value)}
                className="w-full text-xs font-mono bg-black/40 border border-white/[0.08] rounded-md p-2 text-foreground focus:outline-none focus:border-orange-500/50 resize-y"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={handleRunSingle}
              disabled={isRunning}
              size="sm"
              className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              <span>Evaluate ({activeLabel})</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "batch" && (
        <Card className="glass-card-premium border-white/[0.08] p-4 space-y-3">
          <h3 className="text-xs font-bold font-mono text-foreground">Batch Scenario Evaluation</h3>
          <p className="text-xs text-muted-foreground">
            Evaluates all {scenarios.length} scenarios against the {activeLabel} policy set.
          </p>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button
            onClick={handleRunBatch}
            disabled={isRunning || scenarios.length === 0}
            size="sm"
            className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>Run All ({scenarios.length})</span>
          </Button>
        </Card>
      )}

      {mode === "compare" && (
        <Card className="glass-card-premium border-white/[0.08] p-4 space-y-3">
          <h3 className="text-xs font-bold font-mono text-foreground">Compare Baseline vs Candidate</h3>
          <p className="text-xs text-muted-foreground">
            Runs all {scenarios.length} scenarios across both policy versions and identifies decision flips.
          </p>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button
            onClick={handleRunCompare}
            disabled={isRunning || scenarios.length === 0}
            size="sm"
            className="gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>Compare Versions</span>
          </Button>
        </Card>
      )}

      {mode === "counterexamples" && (
        <Card className="glass-card-premium border-white/[0.08] p-4 space-y-3">
          <h3 className="text-xs font-bold font-mono text-foreground">Find Regressive Counterexamples</h3>
          <p className="text-xs text-muted-foreground">
            Detects all scenarios where candidate policy allows access that was denied in baseline.
          </p>
          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <Button
            onClick={handleRunCounterexamples}
            disabled={isRunning || scenarios.length === 0}
            size="sm"
            className="gap-1.5 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold"
          >
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>Find Counterexamples</span>
          </Button>
        </Card>
      )}

      {/* Result Display */}
      {result && (
        <Card className="glass-card-premium border-white/[0.08] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-foreground">Evaluation Result</h3>
            <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono">
              {SOURCE_LABEL}
            </Badge>
          </div>

          {result.type === "single" && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Decision:</span>
                {result.data.decision === "ALLOW" ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> ALLOW
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono font-bold flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> DENY
                  </Badge>
                )}
                {result.data.executionMs && (
                  <span className="text-muted-foreground font-mono text-[10px]">
                    ({result.data.executionMs}ms)
                  </span>
                )}
              </div>
              {result.data.determiningPolicies && result.data.determiningPolicies.length > 0 && (
                <div>
                  <span className="text-muted-foreground block mb-1">Determining Policies:</span>
                  <div className="flex flex-wrap gap-1">
                    {result.data.determiningPolicies.map((p: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-black/40 border border-white/[0.08] font-mono text-[11px]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {result.type === "batch" && (
            <div className="text-xs space-y-1">
              <p>Total Evaluated: <span className="font-mono font-bold">{result.data.summary?.totalScenarios || scenarios.length}</span></p>
              <p>Allowed: <span className="font-mono text-emerald-400">{result.data.summary?.allowedCount || 0}</span></p>
              <p>Denied: <span className="font-mono text-red-400">{result.data.summary?.deniedCount || 0}</span></p>
            </div>
          )}

          {result.type === "compare" && (
            <div className="text-xs space-y-1">
              <p>Newly Authorized Flips: <span className="font-mono text-red-400 font-bold">{result.data.impactSummary?.newlyAuthorizedCount || 0}</span></p>
              <p>Newly Denied Flips: <span className="font-mono text-amber-400 font-bold">{result.data.impactSummary?.newlyDeniedCount || 0}</span></p>
              <p>Unchanged: <span className="font-mono text-muted-foreground font-bold">{result.data.impactSummary?.unchangedCount || 0}</span></p>
            </div>
          )}

          {result.type === "counterexamples" && (
            <div className="space-y-2">
              <p className="text-xs">Found <span className="font-mono font-bold text-red-400">{result.count}</span> counterexample(s).</p>
              {counterexamples.map((cx) => (
                <div key={cx.id} className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-red-300">{cx.id}</span>
                    <span className="text-muted-foreground">{cx.scenarioId}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{cx.principal} ➔ {cx.action} ➔ {cx.resource}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
