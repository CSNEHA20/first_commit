import React, { useState } from "react"
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

interface OverviewScreenProps {
  onNavigate: (tab: ActiveTab) => void
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onNavigate }) => {
  const [selectedEvidence, setSelectedEvidence] = useState<Counterexample | null>(null)
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false)

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

  return (
    <div className="space-y-4">
      {/* Investigation Command Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1">
            <span>Baseline: <strong className="text-foreground">v12 (Production)</strong></span>
            <span className="text-muted-foreground/40">➔</span>
            <span>Candidate: <strong className="text-red-400">v13 (Draft)</strong></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Store: <code className="text-foreground">ps-acmepay-prod</code></span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            Security Investigation Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministic authorization verification across declared security contracts and bounded scenario universes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("simulator")}
            className="gap-1.5 text-xs h-7 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-foreground"
          >
            <Zap className="h-3 w-3 text-amber-400" />
            <span>Simulator</span>
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs h-7 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold shadow-[0_0_15px_rgba(255,106,36,0.3)]"
          >
            <GitCompare className="h-3 w-3" />
            <span>Inspect Behavioral Diff</span>
          </Button>
        </div>
      </div>

      {/* Review Spotlight Hero Banner */}
      <div className="relative p-4 rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/[0.08] via-[#0D1015]/90 to-[#0D1015]/90 backdrop-blur-md overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#EF4444] animate-pulse shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                Active Review: Candidate v13 (Draft)
              </span>
              <StatusBadge status="BLOCKED" size="xs" label="Gate: BLOCKED" />
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => onNavigate("changes")}
            className="gap-1 text-xs self-start sm:self-auto h-6 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-medium"
          >
            <span>Inspect Findings</span>
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        <p className="text-xs text-foreground/80 mt-1.5 font-sans leading-relaxed">
          Action constraint broadening detected in candidate policy <code className="font-mono text-orange-400 font-semibold">v13</code> (Line 24), causing unintended authorization expansion (+{BLAST_RADIUS_RESULT.newlyAuthorizedCount} unauthorized transitions).
        </p>
      </div>

      {/* 4 High-Density Glass Stat Cards with Micro-Charts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GlassStatCard
          label="Newly Authorized"
          value={`+${BLAST_RADIUS_RESULT.newlyAuthorizedCount} Flips`}
          subValue="DENY ➔ ALLOW expansions"
          deltaText="CRITICAL"
          deltaType="negative"
          statusColor="red"
          chartType="sparkline"
          chartData={[0, 0, 1, 1, 2, 3, 3, 2]}
        />
        <GlassStatCard
          label="Action Scope Delta"
          value={`+${BLAST_RADIUS_RESULT.deltaActions} Actions`}
          subValue="delete, export, edit"
          deltaText="+75% Breadth"
          deltaType="warning"
          statusColor="orange"
          chartType="bars"
          chartData={[1, 1, 2, 3, 4]}
        />
        <GlassStatCard
          label="Exposed Resources"
          value={`+${BLAST_RADIUS_RESULT.deltaResources} Types`}
          subValue="Invoices & Payroll Reports"
          deltaText="HIGH"
          deltaType="warning"
          statusColor="amber"
          chartType="sparkline"
          chartData={[10, 25, 45, 80, 120, 184]}
        />
        <GlassStatCard
          label="Affected Principals"
          value={`+${BLAST_RADIUS_RESULT.deltaPrincipals} Roles`}
          subValue="Contractors & Editors"
          deltaText="2 Roles"
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
          <ThreatSurfaceRadar />
        </div>

        {/* Right: Readiness Gauge & Scenario Heatmap Grid (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <ReadinessArcGauge
            score={50}
            title="Security Invariant Health"
            statusLabel="GATE BLOCKED"
            statusType="blocked"
            passedCount={3}
            totalCount={6}
          />
          <ScenarioHeatmapGrid />
        </div>
      </div>

      {/* Critical Finding Spotlight */}
      <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#0D1015]/85 backdrop-blur-md space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SeverityBadge severity="CRITICAL" />
            <span className="font-semibold text-xs text-foreground">
              Primary Counterexample: Contractor unauthorized deletion privilege
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleInspect(primaryCounterexample)}
            className="h-6 text-[11px] gap-1 text-foreground border-white/[0.1] hover:bg-white/[0.05]"
          >
            <FileSearch className="h-3 w-3 text-orange-400" />
            <span>Inspect Evidence</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-0.5 font-mono text-xs">
          <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
            <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Principal</span>
            <span className="text-foreground truncate block font-semibold">{primaryCounterexample.principal}</span>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
            <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Action</span>
            <span className="text-orange-400 truncate block font-semibold">{primaryCounterexample.action}</span>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
            <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Resource</span>
            <span className="text-foreground truncate block font-semibold">{primaryCounterexample.resource}</span>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06] flex items-center justify-between">
            <div>
              <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Transition</span>
              <div className="flex items-center gap-1 mt-0.5">
                <DecisionBadge decision={primaryCounterexample.baselineDecision} size="sm" />
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                <DecisionBadge decision={primaryCounterexample.candidateDecision} size="sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-red-400 font-mono pt-0.5 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
          <span>Violated Security Invariant: <strong>SC-04</strong> ("Contractors cannot delete payroll reports")</span>
        </div>
      </div>

      {/* Interactive 8-Stage Investigation Flow Pipeline */}
      <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#0D1015]/85 backdrop-blur-md space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            Verification Pipeline & Investigation Stages
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any stage to navigate
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 text-xs">
          {investigationStages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onNavigate(stage.tab)}
              className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between h-16 ${
                stage.isError
                  ? "border-red-500/40 bg-red-500/[0.06] hover:bg-red-500/[0.12]"
                  : stage.isWarning
                  ? "border-amber-500/40 bg-amber-500/[0.06] hover:bg-amber-500/[0.12]"
                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06]"
              }`}
            >
              <span className="font-semibold text-foreground text-[11px] truncate block leading-tight">
                {stage.label}
              </span>

              <span
                className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded self-start ${
                  stage.isError
                    ? "text-red-400 bg-red-500/10"
                    : stage.isWarning
                    ? "text-amber-400 bg-amber-500/10"
                    : "text-emerald-400 bg-emerald-500/10"
                }`}
              >
                {stage.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contextual Next Action Recommendation */}
      <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground">
              Recommended Next Action: Correct Action Wildcard in Policy Editor
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Re-insert explicit action equality check (<code className="font-mono text-orange-400 font-semibold">action == Action::"view"</code>) on line 24 to satisfy Invariant SC-04.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => onNavigate("policies")}
          className="text-xs gap-1.5 h-7 shrink-0 bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-medium"
        >
          <FileCode2 className="h-3 w-3" />
          <span>Open Editor</span>
          <ArrowRight className="h-3 w-3" />
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
