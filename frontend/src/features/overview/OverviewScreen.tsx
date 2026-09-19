import React, { useState } from "react"
import {
  ShieldAlert,
  ArrowRight,
  GitCompare,
  FileCode2,
  Zap,
  FileSearch,
  Wrench,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { SeverityBadge } from "@/components/common/SeverityBadge"
import { EvidenceDrawer } from "@/components/common/EvidenceDrawer"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-1">
            <span>Baseline: <strong className="text-foreground">v12 (Production)</strong></span>
            <span className="text-muted-foreground/40">➔</span>
            <span>Candidate: <strong className="text-status-deny">v13 (Draft)</strong></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Store: <code className="text-foreground">ps-acmepay-prod</code></span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-status-deny" />
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
            className="gap-1.5 text-xs h-7"
          >
            <Zap className="h-3 w-3 text-status-warning" />
            <span>Simulator</span>
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            <GitCompare className="h-3 w-3" />
            <span>Inspect Behavioral Diff</span>
          </Button>
        </div>
      </div>

      {/* Review Spotlight Banner */}
      <Card className="border-status-blocked/30 bg-status-blocked/[0.02]">
        <CardHeader className="p-3.5 pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-blocked shrink-0" />
              <div className="flex items-center gap-2">
                <CardTitle className="text-xs font-semibold text-foreground">
                  Active Review: Version v13 (Draft)
                </CardTitle>
                <StatusBadge status="BLOCKED" size="xs" />
              </div>
            </div>

            <Button
              size="sm"
              variant="deny"
              onClick={() => onNavigate("changes")}
              className="gap-1 text-xs self-start sm:self-auto h-6"
            >
              <span>Inspect Findings</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <CardDescription className="text-xs text-foreground/80 mt-1">
            Action constraint broadening detected in candidate policy <code className="font-mono text-foreground font-semibold">v13</code> (Line 24), causing unintended authorization expansion.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-3.5 space-y-3">
          {/* Security Impact Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block font-sans">
                Newly Authorized
              </span>
              <p className="font-bold text-status-deny text-base mt-0.5">
                +{BLAST_RADIUS_RESULT.newlyAuthorizedCount} Transitions
              </p>
              <span className="text-[10px] text-muted-foreground block font-sans mt-0.5">
                DENY ➔ ALLOW flips
              </span>
            </div>

            <div className="p-2.5 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block font-sans">
                Action Scope Delta
              </span>
              <p className="font-bold text-status-deny text-base mt-0.5">
                +{BLAST_RADIUS_RESULT.deltaActions} Actions
              </p>
              <span className="text-[10px] text-muted-foreground block font-sans mt-0.5">
                delete, export, edit
              </span>
            </div>

            <div className="p-2.5 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block font-sans">
                Exposed Resources
              </span>
              <p className="font-bold text-foreground text-base mt-0.5">
                +{BLAST_RADIUS_RESULT.deltaResources} Resources
              </p>
              <span className="text-[10px] text-muted-foreground block font-sans mt-0.5">
                Invoices & Payroll
              </span>
            </div>

            <div className="p-2.5 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground block font-sans">
                Affected Principals
              </span>
              <p className="font-bold text-foreground text-base mt-0.5">
                +{BLAST_RADIUS_RESULT.deltaPrincipals} Principals
              </p>
              <span className="text-[10px] text-muted-foreground block font-sans mt-0.5">
                Contractors, Editors
              </span>
            </div>
          </div>

          {/* Critical Finding Spotlight */}
          <div className="p-3 rounded-md bg-card border border-border space-y-2">
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
                className="h-6 text-[11px] gap-1 text-foreground"
              >
                <FileSearch className="h-3 w-3 text-muted-foreground" />
                <span>Inspect Evidence</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-0.5 font-mono text-xs">
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Principal</span>
                <span className="text-foreground truncate block font-semibold">{primaryCounterexample.principal}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Action</span>
                <span className="text-status-warning truncate block font-semibold">{primaryCounterexample.action}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Resource</span>
                <span className="text-foreground truncate block font-semibold">{primaryCounterexample.resource}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between">
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

            <div className="text-[11px] text-status-deny font-mono pt-0.5">
              Violated Security Invariant: <strong>SC-04</strong> ("Contractors cannot delete payroll reports")
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive 8-Stage Investigation Flow Pipeline */}
      <div className="p-3.5 rounded-lg border border-border bg-card space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Verification Pipeline & Investigation Stages
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any stage to inspect details
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 text-xs">
          {investigationStages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onNavigate(stage.tab)}
              className={`p-2 rounded border text-left transition-colors flex flex-col justify-between h-16 ${
                stage.isError
                  ? "border-status-blocked/40 bg-status-blocked/[0.04] hover:bg-status-blocked/[0.08]"
                  : stage.isWarning
                  ? "border-status-warning/40 bg-status-warning/[0.04] hover:bg-status-warning/[0.08]"
                  : "border-border bg-muted/20 hover:bg-muted/50"
              }`}
            >
              <span className="font-semibold text-foreground text-[11px] truncate block leading-tight">
                {stage.label}
              </span>

              <span
                className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded self-start ${
                  stage.isError
                    ? "text-status-deny bg-status-deny/10"
                    : stage.isWarning
                    ? "text-status-warning bg-status-warning/10"
                    : "text-status-allow bg-status-allow/10"
                }`}
              >
                {stage.status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contextual Next Action Recommendation */}
      <div className="p-3 rounded-md border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded bg-primary/10 text-primary shrink-0">
            <Wrench className="h-4 w-4" />
          </div>
          <div>
            <span className="font-semibold text-foreground">
              Recommended Next Action: Correct Action Wildcard in Policy Editor
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Re-insert explicit action equality check (<code className="font-mono text-foreground font-semibold">action == Action::"view"</code>) on line 24 to satisfy Invariant SC-04.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => onNavigate("policies")}
          className="text-xs gap-1.5 h-7 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
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
