import React from 'react'
import {
  Shield,
  ArrowRight,
  Copy,
  Check,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DecisionBadge } from '@/components/common/DecisionBadge'
import { HeatmapCell } from '@/components/common/ScenarioHeatmapGrid'

interface ScenarioDetailModalProps {
  cell: HeatmapCell | null
  isOpen: boolean
  onClose: () => void
}

export const ScenarioDetailModal: React.FC<ScenarioDetailModalProps> = ({
  cell,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false)

  if (!isOpen || !cell) return null

  const handleCopy = () => {
    const payload = {
      scenarioId: cell.id,
      label: cell.label,
      principal: cell.principal,
      action: cell.action,
      resource: cell.resource,
      baselineDecision: cell.baselineDecision,
      candidateDecision: cell.candidateDecision,
      status: cell.status,
      violatedContract: cell.violatedContract,
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isViolation = cell.status === 'violation'
  const isWarning = cell.status === 'warning'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel-premium w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-md ${
                isViolation
                  ? 'bg-red-500 text-white'
                  : isWarning
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {isViolation ? <AlertTriangle className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono font-bold text-orange-500 px-1.5 py-0.2 rounded bg-orange-500/10 border border-orange-500/20">
                  {cell.id}
                </code>
                <h3 className="text-sm font-bold text-foreground truncate max-w-[280px]">
                  {cell.label}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Evaluated Scenario Tuple in Cedar WASM Runtime
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm font-mono p-1 rounded-md hover:bg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Decision Comparison Card */}
          <div className="p-4 rounded-xl bg-card border border-border space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase font-mono tracking-wider">
              Authorization Decision Drift
            </span>
            <div className="flex items-center justify-between pt-1">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block">Baseline (v12)</span>
                <DecisionBadge decision={cell.baselineDecision} size="sm" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground block">Candidate (v13)</span>
                <DecisionBadge decision={cell.candidateDecision} size="sm" />
              </div>
              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-muted-foreground block">Status</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isViolation
                      ? 'bg-red-500/15 text-red-500 border-red-500/30'
                      : isWarning
                      ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {cell.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Violated Contract Banner */}
          {cell.violatedContract && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong className="text-xs font-bold block">Security Invariant Violation</strong>
                <span className="text-[11px] leading-tight">{cell.violatedContract}</span>
              </div>
            </div>
          )}

          {/* Request Tuple Grid */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2 font-mono text-xs">
            <span className="text-[10px] font-sans font-bold uppercase text-muted-foreground tracking-wider block">
              Cedar Request Tuple
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-2 rounded-lg bg-card border border-border">
                <span className="text-[9px] text-muted-foreground font-sans block">Principal</span>
                <span className="text-foreground font-bold truncate block mt-0.5">
                  {cell.principal}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border">
                <span className="text-[9px] text-muted-foreground font-sans block">Action</span>
                <span className="text-orange-500 font-bold truncate block mt-0.5">
                  {cell.action}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-card border border-border">
                <span className="text-[9px] text-muted-foreground font-sans block">Resource</span>
                <span className="text-foreground font-bold truncate block mt-0.5">
                  {cell.resource}
                </span>
              </div>
            </div>
          </div>

          {/* JSON Evidence Payload Snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground font-mono">
                Evidence Payload (JSON)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
            <pre className="p-3 rounded-xl bg-black/80 text-orange-400 font-mono text-[11px] overflow-x-auto border border-white/10 shadow-inner">
{JSON.stringify(
  {
    scenarioId: cell.id,
    principal: cell.principal,
    action: cell.action,
    resource: cell.resource,
    baselineDecision: cell.baselineDecision,
    candidateDecision: cell.candidateDecision,
    stateTransition:
      cell.baselineDecision === 'DENY' && cell.candidateDecision === 'ALLOW'
        ? 'NEWLY_AUTHORIZED (EXPANSION)'
        : cell.baselineDecision === 'ALLOW' && cell.candidateDecision === 'DENY'
        ? 'NEWLY_FORBIDDEN (REGRESSION)'
        : 'UNCHANGED',
    violation: cell.violatedContract || null,
  },
  null,
  2
)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between">
          <span className="text-muted-foreground text-[11px] font-mono">
            Deterministic WASM Verified
          </span>
          <Button
            size="sm"
            onClick={onClose}
            className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold"
          >
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  )
}
