import React from "react"
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  GitCompare,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ActiveTab } from "@/components/layout/AppSidebar"

interface OverviewScreenProps {
  onNavigate: (tab: ActiveTab) => void
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Banner / Hero Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/10 border border-border shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
              Authorization Verification Workspace
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              Project: AcmePay-Core-Authz
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Prove your authorization changes before production.
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            PolicyLab turns a one-line Cedar policy change into a comprehensive behavioral diff, discovers deterministic counterexamples, tests security contracts, and safely gates deployment to Amazon Verified Permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            onClick={() => onNavigate("simulator")}
            className="text-xs gap-1.5"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Launch Simulator
          </Button>
          <Button
            onClick={() => onNavigate("changes")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-md shadow-indigo-600/20 font-semibold"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Inspect v12 → v13 Diff
          </Button>
        </div>
      </div>

      {/* Production Health KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Production Policy Status
            </span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-xl font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="h-5 w-5" />
                v12 Valid
              </CardTitle>
              <Badge variant="allow">PROD</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            SHA-256 hash verified; zero syntax or schema warnings.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Regression Harness
            </span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-xl font-mono text-foreground">
                18 / 18
              </CardTitle>
              <Badge variant="allow">100% Pass</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            All production scenarios evaluate to expected decisions.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Security Invariants
            </span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-xl font-mono text-foreground">
                6 / 6
              </CardTitle>
              <Badge variant="allow">Satisfied</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            Contractor isolation, admin rights, and tenant boundaries enforced.
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="p-4 pb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              AVP Deployment
            </span>
            <div className="flex items-center justify-between mt-1">
              <CardTitle className="text-xl font-mono text-emerald-600 dark:text-emerald-400">
                Verified
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                ps-acmepay-prod
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-muted-foreground">
            Synchronized with Amazon Verified Permissions Policy Store.
          </CardContent>
        </Card>
      </div>

      {/* Proposed Change Alert Card (Hero Trigger) */}
      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardHeader className="p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground flex items-center gap-2">
                  Pending Policy Review: Version v13 (Draft)
                  <Badge variant="blocked">1 Contract Violated</Badge>
                </CardTitle>
                <CardDescription>
                  Proposed by Alex (Developer) — 2 hours ago
                </CardDescription>
              </div>
            </div>

            <Button
              onClick={() => onNavigate("changes")}
              variant="deny"
              size="sm"
              className="gap-1.5 text-xs self-start sm:self-auto"
            >
              Analyze Blast Radius
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Authorization Blast Radius
              </span>
              <p className="font-mono text-rose-500 font-bold text-sm mt-0.5">
                +3 Actions | +184 Resources
              </p>
              <span className="text-[11px] text-muted-foreground">
                Affects 27 editor and contractor principals
              </span>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Critical Counterexample
              </span>
              <p className="font-mono text-foreground font-semibold text-xs mt-0.5 truncate">
                Contractor ➔ DELETE ➔ PayrollReport
              </p>
              <span className="text-[11px] text-rose-500 font-semibold">
                DENY ➔ ALLOW (Unintended Expansion)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                Deployment Gate Status
              </span>
              <p className="font-mono text-rose-500 font-bold text-xs mt-0.5">
                ⛔ BLOCKED
              </p>
              <span className="text-[11px] text-muted-foreground">
                AVP synchronization halted by security policy
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate("policies")}
          className="p-5 rounded-xl border border-border bg-card hover:border-indigo-500/50 hover:bg-muted/30 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Layers className="h-4 w-4" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
          <h3 className="font-bold text-sm text-foreground">
            Cedar Policy Editor
          </h3>
          <p className="text-xs text-muted-foreground">
            Inspect the active Cedar policy set, format code, and review line-by-line syntax diagnostics.
          </p>
        </div>

        <div
          onClick={() => onNavigate("tests")}
          className="p-5 rounded-xl border border-border bg-card hover:border-indigo-500/50 hover:bg-muted/30 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Zap className="h-4 w-4" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
          <h3 className="font-bold text-sm text-foreground">
            Regression Test Suite
          </h3>
          <p className="text-xs text-muted-foreground">
            Execute all 18 security contract scenarios against baseline and candidate versions with instant pass/fail metrics.
          </p>
        </div>

        <div
          onClick={() => onNavigate("audit")}
          className="p-5 rounded-xl border border-border bg-card hover:border-indigo-500/50 hover:bg-muted/30 cursor-pointer transition-all space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Sparkles className="h-4 w-4" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
          <h3 className="font-bold text-sm text-foreground">
            Strands Policy Audit
          </h3>
          <p className="text-xs text-muted-foreground">
            Run the automated AI audit pipeline synthesizing validation, diffing, counterexamples, and Bedrock explanations.
          </p>
        </div>
      </div>
    </div>
  )
}
