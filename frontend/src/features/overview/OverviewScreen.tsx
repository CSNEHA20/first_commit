import React, { useState } from "react"
import {
  ShieldAlert,
  ArrowRight,
  GitCompare,
  FileCode2,
  Zap,
  ShieldCheck,
  FileSearch,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

  return (
    <div className="space-y-5">
      {/* Workstation Header & Baseline */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>Production Baseline:</span>
            <code className="font-mono text-foreground font-semibold px-1.5 py-0.5 rounded bg-muted border border-border">
              v12 (Verified)
            </code>
            <span className="text-muted-foreground/50">·</span>
            <span>Policy Store:</span>
            <code className="font-mono text-foreground font-semibold px-1.5 py-0.5 rounded bg-muted border border-border">
              ps-acmepay-prod
            </code>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Policy Investigation & Verification
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministic authorization analysis across declared security contracts and scenario universes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("simulator")}
            className="gap-1.5 text-xs"
          >
            <Zap className="h-3.5 w-3.5" />
            Simulator
          </Button>
          <Button
            size="sm"
            onClick={() => onNavigate("changes")}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Inspect v12 → v13 Diff
          </Button>
        </div>
      </div>

      {/* Hero Review Finding Banner (Investigation Starting Point) */}
      <Card className="border-status-blocked/40 bg-status-blocked/[0.03]">
        <CardHeader className="p-4 pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-blocked shrink-0" />
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Current Review: Version v13 (Draft)
                </CardTitle>
                <Badge variant="blocked" className="text-[10px] font-mono">
                  Gate: BLOCKED
                </Badge>
              </div>
            </div>

            <Button
              size="sm"
              variant="deny"
              onClick={() => onNavigate("changes")}
              className="gap-1 text-xs self-start sm:self-auto h-7"
            >
              <span>Analyze Behavioral Diff</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          <CardDescription className="text-xs text-foreground/80 mt-1">
            An action constraint was broadened in candidate policy <code className="font-mono text-foreground font-semibold">v13</code> (Line 24), causing unintended authorization expansion.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Inline Evidence Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Expanded Action Scope
              </span>
              <p className="font-mono font-bold text-status-deny text-lg mt-0.5">
                +{BLAST_RADIUS_RESULT.deltaActions} Actions
              </p>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                delete, export & edit broadened
              </span>
            </div>

            <div className="p-3 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Exposed Resources
              </span>
              <p className="font-mono font-bold text-status-deny text-lg mt-0.5">
                +{BLAST_RADIUS_RESULT.deltaResources} Resources
              </p>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Invoices & Payroll Reports
              </span>
            </div>

            <div className="p-3 rounded-md bg-card border border-border">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Affected Principals
              </span>
              <p className="font-mono font-bold text-status-deny text-lg mt-0.5">
                +{BLAST_RADIUS_RESULT.deltaPrincipals} Principals
              </p>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Contractors & Editor roles
              </span>
            </div>
          </div>

          {/* Critical Finding Spotlight */}
          <div className="p-3 rounded-md bg-card border border-border space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SeverityBadge severity="CRITICAL" />
                <span className="font-semibold text-xs text-foreground">
                  Critical Finding: Contractor unauthorized deletion privilege
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInspect(primaryCounterexample)}
                  className="h-6 text-[11px] gap-1 text-foreground"
                >
                  <FileSearch className="h-3 w-3 text-muted-foreground" />
                  Inspect Evidence
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[10px] text-muted-foreground block font-sans font-medium">Principal</span>
                <span className="text-foreground truncate block font-semibold">{primaryCounterexample.principal}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[10px] text-muted-foreground block font-sans font-medium">Action</span>
                <span className="text-status-warning truncate block font-semibold">{primaryCounterexample.action}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[10px] text-muted-foreground block font-sans font-medium">Resource</span>
                <span className="text-foreground truncate block font-semibold">{primaryCounterexample.resource}</span>
              </div>
              <div className="p-2 rounded bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-muted-foreground block font-sans font-medium">Transition</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <DecisionBadge decision={primaryCounterexample.baselineDecision} size="sm" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <DecisionBadge decision={primaryCounterexample.candidateDecision} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-status-deny font-mono pt-1">
              Violated Security Invariant: SC-04 ("Contractors cannot delete payroll reports")
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Structured Review Path */}
      <div className="p-3.5 rounded-lg border border-border bg-card space-y-2">
        <div className="text-xs font-semibold text-foreground">
          Investigation & Verification Pathway
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <button
            onClick={() => onNavigate("policies")}
            className="p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/60 text-left transition-colors group"
          >
            <span className="text-[10px] text-muted-foreground font-mono block">Step 01</span>
            <span className="font-semibold text-foreground text-xs group-hover:underline">Policy Source</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Inspect Cedar rules</p>
          </button>

          <button
            onClick={() => onNavigate("changes")}
            className="p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/60 text-left transition-colors group"
          >
            <span className="text-[10px] text-muted-foreground font-mono block">Step 02</span>
            <span className="font-semibold text-foreground text-xs group-hover:underline">Behavioral Diff</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Delta matrix</p>
          </button>

          <button
            onClick={() => onNavigate("changes")}
            className="p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/60 text-left transition-colors group"
          >
            <span className="text-[10px] text-muted-foreground font-mono block">Step 03</span>
            <span className="font-semibold text-foreground text-xs group-hover:underline">Counterexample</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Deterministic proofs</p>
          </button>

          <button
            onClick={() => onNavigate("tests")}
            className="p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/60 text-left transition-colors group"
          >
            <span className="text-[10px] text-muted-foreground font-mono block">Step 04</span>
            <span className="font-semibold text-foreground text-xs group-hover:underline">Security Contracts</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">6 invariant checks</p>
          </button>

          <button
            onClick={() => onNavigate("tests")}
            className="p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/60 text-left transition-colors group"
          >
            <span className="text-[10px] text-muted-foreground font-mono block">Step 05</span>
            <span className="font-semibold text-foreground text-xs group-hover:underline">Regression Suite</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">18 scenarios test</p>
          </button>

          <button
            onClick={() => onNavigate("deployments")}
            className="p-2.5 rounded-md border border-border bg-muted/20 hover:bg-muted/60 text-left transition-colors group"
          >
            <span className="text-[10px] text-muted-foreground font-mono block">Step 06</span>
            <span className="font-semibold text-foreground text-xs group-hover:underline">Deploy Gate</span>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">AVP sync & approval</p>
          </button>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          onClick={() => onNavigate("policies")}
          className="p-3.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition-colors space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
              Cedar Policy Editor
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Author and validate Cedar policy AST syntax against the schema.
          </p>
        </div>

        <div
          onClick={() => onNavigate("tests")}
          className="p-3.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition-colors space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Security Contracts
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Enforce organizational security invariants as automated test suites.
          </p>
        </div>

        <div
          onClick={() => onNavigate("audit")}
          className="p-3.5 rounded-lg border border-border bg-card hover:bg-muted/40 cursor-pointer transition-colors space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
              Strands Audit Engine
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Automated multi-tool audit pipeline evaluating Cedar AST and Bedrock synthesis.
          </p>
        </div>
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
