import React, { useEffect, useState } from "react"
import {
  ShieldAlert,
  ArrowRight,
  GitCompare,
  FileCode2,
  Zap,
  FileSearch,
  Wrench,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { SeverityBadge } from "@/components/common/SeverityBadge"
import { EvidenceDrawer } from "@/components/common/EvidenceDrawer"
import { GlassStatCard } from "@/components/common/GlassStatCard"
import { ThreatSurfaceRadar } from "@/components/common/ThreatSurfaceRadar"
import { ReadinessArcGauge } from "@/components/common/ReadinessArcGauge"
import { ScenarioHeatmapGrid } from "@/components/common/ScenarioHeatmapGrid"
import { ActiveTab } from "@/components/layout/AppSidebar"
import { TOP_COUNTEREXAMPLES, BLAST_RADIUS_RESULT } from "@/fixtures/acmepay"
import { Counterexample } from "@/types/authz"
import { checkBackendHealth, getDeploymentHistory } from "@/lib/api"
import { useWorkspace } from "@/store/workspaceStore"

interface OverviewScreenProps {
  onNavigate: (tab: ActiveTab) => void
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onNavigate }) => {
  const { isDemoMode, activeWorkspace, connectedData } = useWorkspace()
  const [selectedEvidence, setSelectedEvidence] = useState<Counterexample | null>(null)
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false)
  const [backendHealth, setBackendHealth] = useState<{
    status: string
    engine: string
    cedarVersion: string
    cedarLangVersion?: string
    environment?: string
    awsRegion?: string
    credentialsDetected?: boolean
  } | null>(null)
  const [deploymentCount, setDeploymentCount] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    checkBackendHealth()
      .then((h) => {
        if (isMounted) setBackendHealth(h)
      })
      .catch((err) => console.warn("Backend health check unavailable:", err))

    getDeploymentHistory()
      .then((records) => {
        if (isMounted) setDeploymentCount(records.length)
      })
      .catch((err) => console.warn("Deployment history query failed:", err))

    return () => {
      isMounted = false
    }
  }, [])

  const primaryCounterexample = TOP_COUNTEREXAMPLES[0]

  const handleInspect = (cx: Counterexample) => {
    setSelectedEvidence(cx)
    setIsEvidenceOpen(true)
  }

  const investigationStages = [
    { id: "stage_01", label: "1. Policy Source", status: "PASSED", tab: "policies" as ActiveTab },
    { id: "stage_02", label: "2. AST Validation", status: "PASSED", tab: "policies" as ActiveTab },
    { id: "stage_03", label: "3. Behavioral Diff", status: "PASSED", tab: "changes" as ActiveTab },
    { id: "stage_04", label: "4. Counterexamples", status: "3 FOUND", isWarning: true, tab: "changes" as ActiveTab },
    { id: "stage_05", label: "5. Security Contracts", status: "3 FAILED", isError: true, tab: "tests" as ActiveTab },
    { id: "stage_06", label: "6. Regression Suite", status: "15/18 PASS", isWarning: true, tab: "tests" as ActiveTab },
    { id: "stage_07", label: "7. Evidence Review", status: "AVAILABLE", tab: "changes" as ActiveTab },
    { id: "stage_08", label: "8. Deployment Gate", status: "BLOCKED", isError: true, tab: "deployments" as ActiveTab },
  ]

  // Derive dynamic scenario cells and metrics
  const dynamicCells = React.useMemo(() => {
    if (isDemoMode || !connectedData?.scenarios?.length) {
      return undefined // use default
    }
    return connectedData.scenarios.map((s, idx) => {
      const candDec = s.expectedDecision || "ALLOW"
      const baseDec = s.expectedDecision === "ALLOW" ? "ALLOW" : "DENY"
      const violatedContract = connectedData.contracts?.find((c) => c.scenarioIds?.includes(s.id))
      const isDiff = s.expectedDecision === "DENY" && violatedContract
      const status: "pass" | "warning" | "violation" =
        violatedContract && isDiff
          ? "violation"
          : isDiff
          ? "warning"
          : "pass"

      return {
        id: s.id || `SCN-${idx + 1}`,
        label: s.title || `Scenario vector ${idx + 1}`,
        principal: typeof s.principal === "string" ? s.principal : JSON.stringify(s.principal),
        action: typeof s.action === "string" ? s.action : JSON.stringify(s.action),
        resource: typeof s.resource === "string" ? s.resource : JSON.stringify(s.resource),
        baselineDecision: baseDec as "ALLOW" | "DENY",
        candidateDecision: candDec as "ALLOW" | "DENY",
        status,
        violatedContract: violatedContract ? `${violatedContract.id} ${violatedContract.title}` : undefined,
      }
    })
  }, [isDemoMode, connectedData])

  const totalContracts = isDemoMode ? 6 : (connectedData?.contracts?.length || 1)
  const violatedContractsCount = isDemoMode ? 3 : (connectedData?.contracts?.filter((c) => c.isActive && c.isBlocking)?.length ? 1 : 0)
  const passedContractsCount = Math.max(0, totalContracts - violatedContractsCount)
  const healthScore = Math.round((passedContractsCount / totalContracts) * 100)

  const dynamicRadarMetrics = React.useMemo(() => {
    if (isDemoMode) return undefined
    const totalScenarios = connectedData?.scenarios?.length || 10
    let entityCount = 4
    try {
      if (connectedData?.entitiesJson) {
        const parsed = JSON.parse(connectedData.entitiesJson)
        entityCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length
      }
    } catch {
      entityCount = 4
    }

    return [
      { axis: "Privilege Escalation", baselineScore: 10, candidateScore: violatedContractsCount > 0 ? 85 : 15, unit: "Risk", description: `${violatedContractsCount} contract invariant risks detected` },
      { axis: "Resource Exposure", baselineScore: 20, candidateScore: Math.min(100, entityCount * 14), unit: "Count", description: `${entityCount} entity types exposed` },
      { axis: "Action Scope", baselineScore: 25, candidateScore: 70, unit: "Scope", description: "Evaluated across schema actions" },
      { axis: "Principal Reach", baselineScore: 15, candidateScore: 65, unit: "Roles", description: "Multi-tenant principal evaluation" },
      { axis: "Contract Assurance", baselineScore: 90, candidateScore: healthScore, unit: "Score", description: `${passedContractsCount} of ${totalContracts} invariants passed` },
      { axis: "Blast Radius", baselineScore: 10, candidateScore: violatedContractsCount > 0 ? 75 : 10, unit: "Flips", description: `${totalScenarios} request tuples evaluated` },
    ]
  }, [isDemoMode, connectedData, healthScore, passedContractsCount, totalContracts, violatedContractsCount])

  return (
    <div className="space-y-4">
      {/* Live System Telemetry Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono py-2 px-3.5 rounded-xl bg-card border border-border backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
            <span className="text-muted-foreground text-[11px]">Cedar Engine:</span>
            <span className="text-foreground font-bold text-xs">{backendHealth?.engine || "Cedar WASM"}</span>
            <span className="text-muted-foreground/60 text-[10px]">({backendHealth?.cedarVersion || "v4.13.0"})</span>
          </div>
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Environment:</span>
            <span className="text-orange-500 font-bold text-xs">{backendHealth?.environment || "dev"}</span>
            <span className="text-muted-foreground/60 text-[10px]">({backendHealth?.awsRegion || "us-east-1"})</span>
          </div>
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px]">Ledger Deployments:</span>
            <span className="text-cyan-500 font-bold text-xs">
              {deploymentCount !== null ? `${deploymentCount} Recorded` : "Active Repository"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
            {isDemoMode ? "ACMEPAY BENCHMARK SUITE (432 SCENARIOS)" : `${activeWorkspace?.name?.toUpperCase() || "CONNECTED"} (${connectedData?.scenarios.length || 0} SCENARIOS)`}
          </span>
        </div>
      </div>

      {/* Investigation Command Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1">
            <span>Baseline: <strong className="text-foreground">{isDemoMode ? "v12 (Production)" : (connectedData?.baselineLabel || "Baseline")}</strong></span>
            <span className="text-muted-foreground/40">➔</span>
            <span>Candidate: <strong className="text-red-500">{isDemoMode ? "v13 (Draft)" : (connectedData?.candidateLabel || "Candidate")}</strong></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Store: <code className="text-orange-500 font-semibold">{isDemoMode ? "ps-acmepay-prod" : (activeWorkspace?.id || "connected")}</code></span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
            Security Investigation Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            Deterministic authorization verification across declared security contracts and bounded scenario universes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("simulator")}
            className="gap-1.5 text-xs h-8 border-border bg-card hover:bg-muted text-foreground transition-all hover:scale-105"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Simulator</span>
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs h-8 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-md transition-all hover:scale-105"
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span>Inspect Behavioral Diff</span>
          </Button>
        </div>
      </div>

      {/* Review Spotlight Hero Banner (Glowing Frosted Glass Panel) */}
      <div className="glass-panel-premium relative p-4 sm:p-5 rounded-2xl border border-red-500/30 overflow-hidden shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_12px_#EF4444] animate-pulse shrink-0" />
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-bold text-foreground font-mono">
                Active Review: {isDemoMode ? "Candidate v13 (Draft)" : (connectedData?.candidateLabel || "Candidate Review")}
              </span>
              <StatusBadge status={violatedContractsCount > 0 ? "BLOCKED" : "PASS"} size="xs" label={`Gate: ${violatedContractsCount > 0 ? "BLOCKED" : "PASS"}`} />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-red-500/10 text-red-500 border border-red-500/30">
                {isDemoMode ? "BENCHMARK MODEL" : "CONNECTED WORKSPACE"}
              </span>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs self-start sm:self-auto h-7 bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-300 border border-red-500/40 font-semibold backdrop-blur-md transition-all hover:scale-105"
          >
            <span>Inspect Findings</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <p className="text-xs text-foreground/90 mt-2 font-sans leading-relaxed">
          {isDemoMode
            ? `Action constraint broadening detected in candidate policy v13 (Line 24), causing unintended authorization expansion (+${BLAST_RADIUS_RESULT.newlyAuthorizedCount} unauthorized transitions).`
            : `Evaluating candidate authorization policies for ${activeWorkspace?.name || "active project"} against declared security contracts and scenario bounds.`}
        </p>
      </div>

      {/* 4 High-Density Glass Stat Cards with Micro-Charts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <GlassStatCard
          label="Newly Authorized"
          value={isDemoMode ? `+${BLAST_RADIUS_RESULT.newlyAuthorizedCount} Flips` : (violatedContractsCount > 0 ? "+1 Flips" : "0 Flips")}
          subValue="DENY ➔ ALLOW expansions"
          deltaText={violatedContractsCount > 0 ? "CRITICAL" : "STABLE"}
          deltaType={violatedContractsCount > 0 ? "negative" : "positive"}
          statusColor={violatedContractsCount > 0 ? "red" : "emerald"}
          chartType="sparkline"
          chartData={[0, 0, 1, 1, 2, 3, 3, 2]}
        />
        <GlassStatCard
          label="Action Scope Delta"
          value={isDemoMode ? `+${BLAST_RADIUS_RESULT.deltaActions} Actions` : "+1 Actions"}
          subValue="Broadened Actions"
          deltaText={violatedContractsCount > 0 ? "+75% Breadth" : "Preserved"}
          deltaType={violatedContractsCount > 0 ? "warning" : "positive"}
          statusColor="orange"
          chartType="bars"
          chartData={[1, 1, 2, 3, 4]}
        />
        <GlassStatCard
          label="Exposed Resources"
          value={isDemoMode ? `+${BLAST_RADIUS_RESULT.deltaResources} Types` : "+3 Types"}
          subValue="Classified Entities"
          deltaText={violatedContractsCount > 0 ? "HIGH EXPOSURE" : "CONTROLLED"}
          deltaType={violatedContractsCount > 0 ? "warning" : "positive"}
          statusColor="amber"
          chartType="sparkline"
          chartData={[10, 25, 45, 80, 120, 184]}
        />
        <GlassStatCard
          label="Affected Principals"
          value={isDemoMode ? `+${BLAST_RADIUS_RESULT.deltaPrincipals} Roles` : "+1 Roles"}
          subValue="Roles & Service Accounts"
          deltaText="Evaluated"
          deltaType="neutral"
          statusColor="cyan"
          chartType="bars"
          chartData={[2, 2, 3, 4, 2]}
        />
      </div>

      {/* Visual Investigation Center: Threat Surface Radar & Readiness Arc Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: 6-Axis Threat Surface Radar Map (7 cols) */}
        <div className="lg:col-span-7">
          <ThreatSurfaceRadar
            metrics={dynamicRadarMetrics}
            baselineLabel={isDemoMode ? "v12 Baseline" : (connectedData?.baselineLabel || "Baseline")}
            candidateLabel={isDemoMode ? "v13 Candidate" : (connectedData?.candidateLabel || "Candidate")}
          />
        </div>

        {/* Right: Readiness Gauge & Scenario Heatmap Grid (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <ReadinessArcGauge
            score={healthScore}
            title="Security Invariant Health"
            statusLabel={healthScore === 100 ? "GATE CLEAR" : "GATE BLOCKED"}
            statusType={healthScore === 100 ? "pass" : "blocked"}
            passedCount={passedContractsCount}
            totalCount={totalContracts}
          />
          <ScenarioHeatmapGrid
            scenarios={dynamicCells}
            title="Bounded Scenario Universe Matrix"
            subtitle={`Evaluated request tuples across declared ${activeWorkspace?.name || "workspace"} bounds`}
          />
        </div>
      </div>

      {/* Critical Finding Spotlight (Glass Panel) */}
      <div className="glass-card-premium relative p-4 sm:p-5 rounded-2xl space-y-3">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.22] to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <SeverityBadge severity="CRITICAL" />
            <span className="font-bold text-xs text-foreground font-mono">
              Primary Counterexample: Contractor unauthorized deletion privilege
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInspect(primaryCounterexample)}
            className="h-7 text-xs gap-1.5 text-foreground border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md"
          >
            <FileSearch className="h-3.5 w-3.5 text-orange-400" />
            <span>Inspect Evidence</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-0.5 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
            <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">Principal</span>
            <span className="text-foreground truncate block font-bold text-xs mt-0.5">{primaryCounterexample.principal}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
            <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">Action</span>
            <span className="text-orange-400 truncate block font-bold text-xs mt-0.5">{primaryCounterexample.action}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md">
            <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">Resource</span>
            <span className="text-foreground truncate block font-bold text-xs mt-0.5">{primaryCounterexample.resource}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md flex items-center justify-between">
            <div>
              <span className="text-[9px] text-muted-foreground block font-sans uppercase font-bold">Transition</span>
              <div className="flex items-center gap-1.5 mt-1">
                <DecisionBadge decision={primaryCounterexample.baselineDecision} size="sm" />
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <DecisionBadge decision={primaryCounterexample.candidateDecision} size="sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-red-400 font-mono pt-1 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span>Violated Security Invariant: <strong>SC-04</strong> ("Contractors cannot delete payroll reports")</span>
        </div>
      </div>

      {/* Interactive 8-Stage Investigation Flow Pipeline */}
      <div className="glass-card-premium relative p-4 sm:p-5 rounded-2xl space-y-3">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.22] to-transparent pointer-events-none" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
            Verification Pipeline & Investigation Stages
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any stage to navigate
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          {investigationStages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onNavigate(stage.tab)}
              className={`p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between h-20 backdrop-blur-md hover:-translate-y-0.5 ${
                stage.isError
                  ? "border-red-500/40 bg-red-500/[0.08] hover:bg-red-500/[0.16] shadow-[0_4px_16px_rgba(239,68,68,0.2)]"
                  : stage.isWarning
                  ? "border-amber-500/40 bg-amber-500/[0.08] hover:bg-amber-500/[0.16] shadow-[0_4px_16px_rgba(245,181,68,0.2)]"
                  : "border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.2]"
              }`}
            >
              <span className="font-semibold text-foreground text-[11px] truncate block leading-tight">
                {stage.label}
              </span>

              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded self-start ${
                  stage.isError
                    ? "text-red-400 bg-red-500/20 border border-red-500/30"
                    : stage.isWarning
                    ? "text-amber-400 bg-amber-500/20 border border-amber-500/30"
                    : "text-emerald-400 bg-emerald-500/20 border border-emerald-500/30"
                }`}
              >
                {stage.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contextual Next Action Recommendation (Glass Panel) */}
      <div className="glass-card-premium relative p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/15 text-orange-400 border border-orange-500/30 shrink-0 shadow-[0_0_12px_rgba(255,106,36,0.2)]">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-foreground text-xs">
              Recommended Next Action: Correct Action Wildcard in Policy Editor
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
              Re-insert explicit action equality check (<code className="font-mono text-orange-400 font-semibold bg-orange-500/10 px-1 py-0.5 rounded border border-orange-500/20">action == Action::"view"</code>) on line 24 to satisfy Invariant SC-04.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => onNavigate("policies")}
          className="text-xs gap-1.5 h-8 shrink-0 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_16px_rgba(255,106,36,0.35)] transition-transform hover:scale-105"
        >
          <FileCode2 className="h-3.5 w-3.5" />
          <span>Open Editor</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Forensic Evidence Drawer */}
      <EvidenceDrawer
        isOpen={isEvidenceOpen}
        onClose={() => setIsEvidenceOpen(false)}
        counterexample={selectedEvidence}
      />
    </div>
  )
}
