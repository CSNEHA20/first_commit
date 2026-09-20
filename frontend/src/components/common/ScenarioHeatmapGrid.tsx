import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { ScenarioDetailModal } from "@/components/common/ScenarioDetailModal"

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
  subtitle = "Evaluated request tuples across declared schema bounds",
  className,
  onSelectCell,
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleCellClick = (cell: HeatmapCell) => {
    setSelectedCell(cell)
    setIsModalOpen(true)
    onSelectCell?.(cell)
  }

  const violationCount = scenarios.filter((s) => s.status === "violation").length

  return (
    <>
      <div
        className={cn(
          "glass-card-premium relative p-5 rounded-2xl flex flex-col justify-between select-none overflow-hidden",
          className
        )}
      >
        {/* Specular Top Horizon Highlight Line */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.28] to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <span className="text-xs font-bold text-foreground tracking-tight flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_#FF6A24]" />
              {title}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-[9px] font-mono shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-sm bg-emerald-500 shadow-[0_0_6px_#18B868]" />
              <span className="text-emerald-600 dark:text-emerald-300">Pass</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
              <span className="h-2 w-2 rounded-sm bg-amber-500 shadow-[0_0_6px_#F5B544]" />
              <span className="text-amber-600 dark:text-amber-300">Warn</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30">
              <span className="h-2 w-2 rounded-sm bg-red-500 shadow-[0_0_8px_#EF4444]" />
              <span className="text-red-500 font-bold">Violation</span>
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
                  onClick={() => handleCellClick(cell)}
                  onMouseEnter={() => setHoveredCell(cell)}
                  onMouseLeave={() => setHoveredCell(null)}
                  className={cn(
                    "h-4 w-full rounded-sm transition-all duration-200 relative cursor-pointer",
                    cell.status === "pass" && "bg-emerald-500/25 hover:bg-emerald-400 hover:shadow-[0_0_12px_#18B868]",
                    cell.status === "warning" && "bg-amber-500/40 hover:bg-amber-400 hover:shadow-[0_0_12px_#F5B544]",
                    cell.status === "violation" && "bg-red-500 hover:bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-pulse",
                    isHovered && "ring-2 ring-orange-500 scale-125 z-20"
                  )}
                  title={`Click to inspect ${cell.id}: ${cell.label}`}
                  aria-label={cell.label}
                />
              )
            })}
          </div>
        </div>

        {/* Stabilized Fixed-Height Inspector / Detail Footer */}
        <div className="mt-2 min-h-[50px] p-2.5 rounded-xl bg-card border border-border flex items-center justify-between text-xs font-mono">
          {hoveredCell ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 truncate">
                <code className="text-[10px] text-orange-500 font-bold px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
                  {hoveredCell.id}
                </code>
                <span className="font-bold text-foreground text-[11px] truncate">
                  {hoveredCell.label}
                </span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">
                  ({hoveredCell.action} on {hoveredCell.resource})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-[9px] font-bold px-1.5 py-0.5 rounded border",
                    hoveredCell.status === "violation" && "bg-red-500/15 text-red-500 border-red-500/30",
                    hoveredCell.status === "warning" && "bg-amber-500/15 text-amber-500 border-amber-500/30",
                    hoveredCell.status === "pass" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  )}
                >
                  {hoveredCell.status.toUpperCase()}
                </span>
                <span className="text-[10px] text-orange-500 hidden sm:inline font-sans">
                  Click to inspect
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full text-[11px] text-muted-foreground font-sans">
              <span>{scenarios.length} scenarios sampled. Click any cell to view full request tuple.</span>
              <span className="font-mono text-[10px] text-red-500 font-bold">
                {violationCount > 0 ? `${violationCount} Violations Flagged` : "All Scenarios Verified"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Forensic Scenario Detail Modal */}
      <ScenarioDetailModal
        cell={selectedCell}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
