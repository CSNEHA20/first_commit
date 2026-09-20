import React from "react"
import {
  Users,
  Database,
  Sliders,
  Server,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BlastRadiusGraphStats } from "./blastRadiusGraphModel"

interface RiskImpactSummaryPanelProps {
  stats: BlastRadiusGraphStats
  isBlocked: boolean
}

export const RiskImpactSummaryPanel: React.FC<RiskImpactSummaryPanelProps> = ({
  stats,
  isBlocked,
}) => {
  return (
    <Card className="glass-panel-premium border-white/[0.08] shadow-2xl flex flex-col h-full overflow-hidden">
      <CardHeader className="p-4 border-b border-white/[0.08] bg-black/40 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold text-foreground font-mono flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            Risk & Impact Summary
          </CardTitle>
          <Badge
            className={`text-[10px] font-mono font-bold ${
              isBlocked
                ? "bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(24,184,104,0.2)]"
            }`}
          >
            {isBlocked ? "HIGH RISK" : "CLEAN"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between text-xs font-sans">
        {/* Risk Score Hero Card */}
        <div className="p-3.5 rounded-xl bg-black/50 border border-white/[0.08] flex items-center justify-between backdrop-blur-md">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono block">
              Risk Score
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`font-mono font-black text-2xl ${
                  stats.riskScore >= 80
                    ? "text-red-400"
                    : stats.riskScore > 0
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {stats.riskScore}
              </span>
              <span className="text-xs font-mono text-muted-foreground/60">/ 100</span>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded ${
                isBlocked
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {isBlocked ? "HIGH RISK" : "VERIFIED SAFE"}
            </span>
            <span className="text-[10px] text-muted-foreground block font-mono mt-1">
              {stats.totalScenariosEvaluated} Scenarios Evaluated
            </span>
          </div>
        </div>

        {/* Breakdown Items List */}
        <div className="space-y-2.5 flex-1">
          {/* Affected Principals */}
          <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Affected Principals</span>
                <span className="font-mono font-bold text-foreground text-xs">{stats.affectedPrincipalsCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{stats.affectedPrincipalsBreakdown}</p>
            </div>
          </div>

          {/* Affected Resources */}
          <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Affected Resources</span>
                <span className="font-mono font-bold text-foreground text-xs">{stats.affectedResourcesCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{stats.affectedResourcesBreakdown}</p>
            </div>
          </div>

          {/* Affected Actions */}
          <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Sliders className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Affected Actions</span>
                <span className="font-mono font-bold text-foreground text-xs">{stats.affectedActionsCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{stats.affectedActionsBreakdown}</p>
            </div>
          </div>

          {/* Services Impacted */}
          <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Server className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Services Impacted</span>
                <span className="font-mono font-bold text-foreground text-xs">{stats.servicesImpactedCount}</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{stats.servicesImpactedBreakdown}</p>
            </div>
          </div>

          {/* Contract Violations */}
          <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div
              className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                isBlocked
                  ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Contract Violations</span>
                <span
                  className={`font-mono font-bold text-xs ${
                    isBlocked ? "text-purple-400" : "text-emerald-400"
                  }`}
                >
                  {stats.contractViolationsCount}
                </span>
              </div>
              <p className="text-[11px] text-purple-300 truncate font-mono">{stats.contractViolationsBreakdown}</p>
            </div>
          </div>

          {/* Potential Financial Impact */}
          <div className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Potential Financial Impact</span>
              </div>
              <p
                className={`text-[11px] font-semibold truncate ${
                  isBlocked ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {stats.potentialFinancialImpact}
              </p>
            </div>
          </div>
        </div>

        {/* Recommendation Box at Bottom */}
        <div
          className={`p-3 rounded-xl border text-xs space-y-1 ${
            isBlocked
              ? "bg-red-500/10 border-red-500/25 text-red-200"
              : "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
            {isBlocked ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>Recommendation</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {stats.recommendation}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
