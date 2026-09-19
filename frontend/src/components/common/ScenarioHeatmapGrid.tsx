import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"

export interface HeatmapCell {
  id: string
  label: string
  principal: string
  action: string
  resource: string
  baselineDecision: "ALLOW" | "DENY"
  candidateDecision: "ALLOW" | "DENY"
  status: "pass" | "warning" | "violation"
  violatedContract?: string
}

interface ScenarioHeatmapGridProps {
  scenarios?: HeatmapCell[]
  title?: string
  subtitle?: string
  className?: string
  onSelectCell?: (cell: HeatmapCell) => void
}

const DEFAULT_CELLS: HeatmapCell[] = Array.from({ length: 42 }).map((_, idx) => {
  // Let indices 6, 14, 28 be critical counterexample flips (violations)
  if (idx === 6) {
    return {
      id: "SCN-07",
      label: "Contractor Delete Payroll",
      principal: 'User::"contractor_alice"',
      action: 'Action::"delete"',
      resource: 'PayrollReport::"q1_payroll"',
      baselineDecision: "DENY",
      candidateDecision: "ALLOW",
      status: "violation",
      violatedContract: "SC-04 Contractor payroll deletion",
    }
  }
  if (idx === 14) {
    return {
      id: "SCN-15",
      label: "Contractor Export Invoices",
      principal: 'User::"contractor_alice"',
      action: 'Action::"export"',
      resource: 'Invoice::"inv_9082"',
      baselineDecision: "DENY",
      candidateDecision: "ALLOW",
      status: "violation",
      violatedContract: "SC-05 Financial export restriction",
    }
  }
  if (idx === 28) {
    return {
      id: "SCN-29",
      label: "Editor Delete Invoices",
      principal: 'User::"editor_bob"',
      action: 'Action::"delete"',
      resource: 'Invoice::"inv_4401"',
      baselineDecision: "DENY",
      candidateDecision: "ALLOW",
      status: "violation",
      violatedContract: "SC-03 Editor invoice deletion",
    }
  }
  // Amber warnings
  if (idx === 3 || idx === 19 || idx === 35) {
    return {
      id: `SCN-${idx + 1}`,
      label: "Action scope broadening",
      principal: 'User::"editor_bob"',
      action: 'Action::"edit"',
      resource: 'CustomerRecord::"cust_01"',
      baselineDecision: "DENY",
      candidateDecision: "ALLOW",
      status: "warning",
    }
  }
  // All others are passing
  return {
    id: `SCN-${idx + 1}`,
    label: "Standard verified authorization",
    principal: idx % 2 === 0 ? 'User::"admin_root"' : 'User::"finance_sarah"',
    action: idx % 3 === 0 ? 'Action::"view"' : 'Action::"edit"',
    resource: idx % 2 === 0 ? 'SupportTicket::"t_101"' : 'Invoice::"inv_01"',
    baselineDecision: "ALLOW",
    candidateDecision: "ALLOW",
    status: "pass",
  }
})

export const ScenarioHeatmapGrid: React.FC<ScenarioHeatmapGridProps> = ({
  scenarios = DEFAULT_CELLS,
  title = "Bounded Scenario Universe Matrix",
  subtitle = "Evaluated request tuples across declared AcmePay schema bounds",
  className,
  onSelectCell,
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border border-white/[0.08] bg-[#0D1015]/85 backdrop-blur-md flex flex-col justify-between select-none min-h-[220px]",
        className
      )}
    >
      {/* Top Specular Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#FF6A24]" />
            {title}
          </span>
          <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[9px] font-mono shrink-0">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/80" />
            <span className="text-muted-foreground">Pass</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-amber-500/80" />
            <span className="text-muted-foreground">Warn</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-red-500 shadow-[0_0_6px_#EF4444]" />
            <span className="text-red-400 font-semibold">Violation</span>
          </div>
        </div>
      </div>

      {/* Interactive 2D Grid Cells */}
      <div className="relative py-2">
        <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
          {scenarios.map((cell) => {
            const isHovered = hoveredCell?.id === cell.id
            return (
              <button
                key={cell.id}
                onClick={() => onSelectCell?.(cell)}
                onMouseEnter={() => setHoveredCell(cell)}
                onMouseLeave={() => setHoveredCell(null)}
                className={cn(
                  "h-4 w-full rounded-sm transition-all duration-150 relative",
                  cell.status === "pass" && "bg-emerald-500/25 hover:bg-emerald-400 hover:shadow-[0_0_8px_#18B868]",
                  cell.status === "warning" && "bg-amber-500/40 hover:bg-amber-400 hover:shadow-[0_0_8px_#F5B544]",
                  cell.status === "violation" && "bg-red-500 hover:bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse",
                  isHovered && "ring-2 ring-white scale-110 z-10"
                )}
                aria-label={cell.label}
              />
            )
          })}
        </div>

        {/* Floating Frosted Glass Code / Detail Tooltip */}
        {hoveredCell && (
          <div className="mt-2 p-2.5 rounded-lg bg-[#181C24]/95 border border-white/[0.14] backdrop-blur-xl shadow-2xl text-xs space-y-1.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono">
                <code className="text-orange-400 font-bold text-[10px]">[{hoveredCell.id}]</code>
                <span className="text-foreground font-semibold text-[11px] truncate">
                  {hoveredCell.label}
                </span>
              </div>
              <span
                className={cn(
                  "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border",
                  hoveredCell.status === "violation" && "bg-red-500/20 text-red-400 border-red-500/30",
                  hoveredCell.status === "warning" && "bg-amber-500/20 text-amber-400 border-amber-500/30",
                  hoveredCell.status === "pass" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                )}
              >
                {hoveredCell.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px] font-mono bg-black/40 p-1.5 rounded border border-white/[0.05]">
              <div className="truncate">
                <span className="text-muted-foreground font-sans">Principal: </span>
                <span className="text-foreground">{hoveredCell.principal}</span>
              </div>
              <div className="truncate">
                <span className="text-muted-foreground font-sans">Action: </span>
                <span className="text-orange-400">{hoveredCell.action}</span>
              </div>
              <div className="truncate">
                <span className="text-muted-foreground font-sans">Resource: </span>
                <span className="text-foreground">{hoveredCell.resource}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground font-sans">Decision: </span>
                <span className="text-muted-foreground">{hoveredCell.baselineDecision}</span>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                <span className={hoveredCell.status === "violation" ? "text-red-400 font-bold" : "text-emerald-400"}>
                  {hoveredCell.candidateDecision}
                </span>
              </div>
            </div>

            {hoveredCell.violatedContract && (
              <div className="text-[10px] font-mono text-red-400 flex items-center gap-1">
                <span>Violated Invariant:</span>
                <strong>{hoveredCell.violatedContract}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info Row */}
      {!hoveredCell && (
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-white/[0.06] mt-2">
          <span>42 Total Scenarios Sampled</span>
          <span className="text-red-400 font-semibold">3 Invariant Violations Flagged</span>
        </div>
      )}
    </div>
  )
}
