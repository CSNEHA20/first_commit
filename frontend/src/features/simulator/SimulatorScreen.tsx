import React, { useState } from "react"
import {
  Zap,
  Play,
  ArrowRight,
  Code2,
  Bookmark,
  HelpCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { StatusBadge } from "@/components/common/StatusBadge"
import { AuthorizationDecision } from "@/types/authz"

const SAMPLE_PRINCIPALS = [
  { id: 'User::"contractor_alice"', role: "contractor", label: 'User::"contractor_alice" (Contractor)' },
  { id: 'User::"editor_bob"', role: "editor", label: 'User::"editor_bob" (Editor)' },
  { id: 'User::"admin_root"', role: "admin", label: 'User::"admin_root" (Admin)' },
  { id: 'User::"finance_manager_sarah"', role: "finance_manager", label: 'User::"finance_manager_sarah" (Finance)' },
  { id: 'User::"tenant_a_user"', role: "viewer", label: 'User::"tenant_a_user" (Viewer)' },
]

const SAMPLE_ACTIONS = [
  { id: 'Action::"view"', label: 'Action::"view"' },
  { id: 'Action::"edit"', label: 'Action::"edit"' },
  { id: 'Action::"delete"', label: 'Action::"delete" (Destructive)' },
  { id: 'Action::"export"', label: 'Action::"export" (Bulk Extraction)' },
]

const SAMPLE_RESOURCES = [
  { id: 'PayrollReport::"payroll_2026_q1"', type: "PayrollReport", label: 'PayrollReport::"payroll_2026_q1" (Confidential)' },
  { id: 'Invoice::"inv_9082"', type: "Invoice", label: 'Invoice::"inv_9082" (Billing Record)' },
  { id: 'SupportTicket::"ticket_102"', type: "SupportTicket", label: 'SupportTicket::"ticket_102" (Support Item)' },
  { id: 'CustomerRecord::"cust_401"', type: "CustomerRecord", label: 'CustomerRecord::"cust_401" (PII Record)' },
]

const QUICK_TEMPLATES = [
  {
    name: "Contractor Delete Payroll (Buggy Flip)",
    principal: 'User::"contractor_alice"',
    action: 'Action::"delete"',
    resource: 'PayrollReport::"payroll_2026_q1"',
  },
  {
    name: "Editor Delete Invoice",
    principal: 'User::"editor_bob"',
    action: 'Action::"delete"',
    resource: 'Invoice::"inv_9082"',
  },
  {
    name: "Admin View All",
    principal: 'User::"admin_root"',
    action: 'Action::"view"',
    resource: 'PayrollReport::"payroll_2026_q1"',
  },
  {
    name: "Contractor View Ticket",
    principal: 'User::"contractor_alice"',
    action: 'Action::"view"',
    resource: 'SupportTicket::"ticket_102"',
  },
]

export const SimulatorScreen: React.FC = () => {
  const [selectedPrincipal, setSelectedPrincipal] = useState(SAMPLE_PRINCIPALS[0].id)
  const [selectedAction, setSelectedAction] = useState(SAMPLE_ACTIONS[2].id) // delete
  const [selectedResource, setSelectedResource] = useState(SAMPLE_RESOURCES[0].id) // payroll
  const [contextJson, setContextJson] = useState('{\n  "network": "EXTERNAL",\n  "isMfaVerified": false\n}')
  const [policyVersion, setPolicyVersion] = useState<"v12" | "v13">("v13")
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasEvaluated, setHasEvaluated] = useState(true)

  const evaluateAccess = (
    principal: string,
    action: string,
    resource: string,
    ver: "v12" | "v13"
  ): {
    decision: AuthorizationDecision
    matchedPolicy: string
    reason: string
    executionMs: number
  } => {
    if (principal.includes("admin")) {
      return {
        decision: "ALLOW",
        matchedPolicy: "policy_admin_full_access",
        reason: "Matched explicit permit for Role::admin across all actions and resources.",
        executionMs: 0.72,
      }
    }

    if (ver === "v13") {
      if (principal.includes("contractor")) {
        return {
          decision: "ALLOW",
          matchedPolicy: "policy_contractor_all_actions",
          reason: "Matched unrestricted action clause in candidate policy v13 (Line 24).",
          executionMs: 0.94,
        }
      }
      if (principal.includes("editor") && resource.includes("Invoice")) {
        return {
          decision: "ALLOW",
          matchedPolicy: "policy_editor_all_actions",
          reason: "Matched broadened permit for Role::editor on all Invoice actions.",
          executionMs: 0.88,
        }
      }
    }

    if (ver === "v12") {
      if (principal.includes("contractor") && action.includes("view") && resource.includes("SupportTicket")) {
        return {
          decision: "ALLOW",
          matchedPolicy: "policy_contractor_view_tickets",
          reason: "Matched permit for Role::contractor on Action::view for SupportTickets.",
          executionMs: 0.81,
        }
      }
      if (principal.includes("editor") && (action.includes("view") || action.includes("edit")) && resource.includes("Invoice")) {
        return {
          decision: "ALLOW",
          matchedPolicy: "policy_editor_invoice_management",
          reason: "Matched permit for Role::editor on view/edit for Invoices.",
          executionMs: 0.85,
        }
      }
      if (principal.includes("finance") && !action.includes("delete")) {
        return {
          decision: "ALLOW",
          matchedPolicy: "policy_finance_manager",
          reason: "Matched permit for Role::finance_manager.",
          executionMs: 0.9,
        }
      }
    }

    return {
      decision: "DENY",
      matchedPolicy: "default_deny",
      reason: "No explicit permit statement matched the authorization request. Implicit default deny applied.",
      executionMs: 0.65,
    }
  }

  const result = evaluateAccess(selectedPrincipal, selectedAction, selectedResource, policyVersion)
  const baselineResult = evaluateAccess(selectedPrincipal, selectedAction, selectedResource, "v12")
  const candidateResult = evaluateAccess(selectedPrincipal, selectedAction, selectedResource, "v13")
  const isDecisionFlip = baselineResult.decision !== candidateResult.decision

  const handleSimulate = () => {
    setIsSimulating(true)
    setTimeout(() => {
      setIsSimulating(false)
      setHasEvaluated(true)
    }, 150)
  }

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setSelectedPrincipal(tpl.principal)
    setSelectedAction(tpl.action)
    setSelectedResource(tpl.resource)
    setHasEvaluated(true)
  }

  return (
    <div className="space-y-4">
      {/* Simulator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">Cedar Request Debugger</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">Interactive WASM Authorization Engine</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-400 shadow-[0_0_10px_rgba(255,106,36,0.5)]" />
            Ad-hoc Scenario Simulator
          </h1>
        </div>

        {/* Policy Version Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Target Version:</span>
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
            <button
              onClick={() => setPolicyVersion("v12")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                policyVersion === "v12"
                  ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => setPolicyVersion("v13")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                policyVersion === "v13"
                  ? "bg-[#FF6A24] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Candidate)
            </button>
          </div>
        </div>
      </div>

      {/* Quick Scenario Templates Bar */}
      <div className="p-2.5 rounded-xl border border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md flex items-center gap-2 overflow-x-auto text-xs">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5 shrink-0 font-mono">
          <Bookmark className="h-3 w-3 text-orange-400" />
          Quick Templates:
        </span>
        {QUICK_TEMPLATES.map((tpl, idx) => (
          <button
            key={idx}
            onClick={() => applyTemplate(tpl)}
            className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-white/[0.08] text-foreground text-[11px] font-medium border border-white/[0.06] whitespace-nowrap transition-colors shrink-0"
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {/* Grid: Request Vector (7 cols) & Outcome Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Request Configuration */}
        <div className="lg:col-span-7 space-y-3">
          <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
            <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
              <CardTitle className="text-xs font-semibold">
                Authorization Request Vector
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Configure the Principal, Action, Resource, and Context tuple.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-3.5 pt-2 space-y-3 text-xs">
              {/* Principal Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                  Principal
                </label>
                <select
                  value={selectedPrincipal}
                  onChange={(e) => setSelectedPrincipal(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {SAMPLE_PRINCIPALS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#0D1015] text-foreground">
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                  Action
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {SAMPLE_ACTIONS.map((a) => (
                    <option key={a.id} value={a.id} className="bg-[#0D1015] text-foreground">
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                  Resource
                </label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {SAMPLE_RESOURCES.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#0D1015] text-foreground">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Context JSON */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase font-mono">
                  Context (JSON Attributes)
                </label>
                <textarea
                  value={contextJson}
                  onChange={(e) => setContextJson(e.target.value)}
                  rows={2}
                  className="w-full p-2 rounded-lg bg-black/50 border border-white/[0.1] text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <Button
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full bg-[#FF6A24] text-white hover:bg-[#FF8A42] font-semibold text-xs gap-1.5 h-8 mt-1 shadow-[0_0_15px_rgba(255,106,36,0.3)]"
              >
                <Play className="h-3 w-3 fill-current" />
                {isSimulating ? "Evaluating in Cedar WASM..." : "Evaluate Request Vector"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Output Result & Delta Comparison */}
        <div className="lg:col-span-5 space-y-3">
          <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
            <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold">Evaluation Outcome</CardTitle>
                <StatusBadge status={result.decision} size="xs" />
              </div>
            </CardHeader>

            <CardContent className="p-3.5 pt-2 space-y-3 text-xs">
              {hasEvaluated ? (
                <>
                  {/* Decision Hero Banner */}
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    result.decision === "ALLOW"
                      ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                      : "border-red-500/30 bg-red-500/[0.05]"
                  }`}>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono">
                        Target Decision ({policyVersion})
                      </span>
                      <DecisionBadge decision={result.decision} size="lg" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3 text-orange-400" /> Latency
                      </span>
                      <span className="font-mono font-bold text-xs text-foreground">
                        {result.executionMs} ms
                      </span>
                    </div>
                  </div>

                  {/* Matched Policy Trace */}
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1 text-xs">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
                      Determining Policy Statement
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-xs text-foreground font-semibold">
                      <Code2 className="h-3.5 w-3.5 text-orange-400" />
                      <code>{result.matchedPolicy}</code>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">
                      {result.reason}
                    </p>
                  </div>

                  {/* Side-by-Side Baseline vs Candidate Comparison */}
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block font-mono">
                        Version Comparison Delta
                      </span>
                      {isDecisionFlip && (
                        <span className="text-[9px] font-mono font-bold text-red-400 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 animate-pulse">
                          DECISION FLIP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <div className="text-center flex-1 p-2 rounded bg-black/20 border border-white/[0.04]">
                        <span className="text-[10px] text-muted-foreground block mb-1 font-mono">v12 (Production)</span>
                        <DecisionBadge decision={baselineResult.decision} size="sm" />
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-2 shrink-0" />
                      <div className="text-center flex-1 p-2 rounded bg-black/20 border border-white/[0.04]">
                        <span className="text-[10px] text-muted-foreground block mb-1 font-mono">v13 (Candidate)</span>
                        <DecisionBadge decision={candidateResult.decision} size="sm" />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-xs space-y-1">
                  <HelpCircle className="h-5 w-5 mx-auto text-muted-foreground/50" />
                  <p>Configure a request vector and click Evaluate to execute Cedar authorization.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
