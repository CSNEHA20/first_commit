import React, { useState } from "react"
import {
  Zap,
  Play,
  Layers,
  ArrowRight,
  Code2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { AuthorizationDecision } from "@/types/authz"

const SAMPLE_PRINCIPALS = [
  { id: 'User::"contractor_alice"', role: "contractor", label: "contractor_alice (Contractor)" },
  { id: 'User::"editor_bob"', role: "editor", label: "editor_bob (Editor)" },
  { id: 'User::"admin_root"', role: "admin", label: "admin_root (Admin)" },
  { id: 'User::"finance_manager_sarah"', role: "finance_manager", label: "finance_manager_sarah (Finance)" },
  { id: 'User::"tenant_a_user"', role: "viewer", label: "tenant_a_user (Viewer - Tenant A)" },
]

const SAMPLE_ACTIONS = [
  { id: 'Action::"view"', label: "view (Read-only)" },
  { id: 'Action::"edit"', label: "edit (Update)" },
  { id: 'Action::"delete"', label: "delete (Destructive)" },
  { id: 'Action::"export"', label: "export (Bulk Extraction)" },
]

const SAMPLE_RESOURCES = [
  { id: 'PayrollReport::"payroll_2026_q1"', type: "PayrollReport", label: 'PayrollReport::"payroll_2026_q1" (Sensitive)' },
  { id: 'Invoice::"inv_9082"', type: "Invoice", label: 'Invoice::"inv_9082" (Billing)' },
  { id: 'SupportTicket::"ticket_102"', type: "SupportTicket", label: 'SupportTicket::"ticket_102" (Public Support)' },
  { id: 'CustomerRecord::"cust_401"', type: "CustomerRecord", label: 'CustomerRecord::"cust_401" (PII)' },
]

export const SimulatorScreen: React.FC = () => {
  const [selectedPrincipal, setSelectedPrincipal] = useState(SAMPLE_PRINCIPALS[0].id)
  const [selectedAction, setSelectedAction] = useState(SAMPLE_ACTIONS[2].id) // delete
  const [selectedResource, setSelectedResource] = useState(SAMPLE_RESOURCES[0].id) // payroll
  const [contextJson, setContextJson] = useState('{\n  "network": "EXTERNAL",\n  "isMfaVerified": false\n}')
  const [policyVersion, setPolicyVersion] = useState<"v12" | "v13">("v13")
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasEvaluated, setHasEvaluated] = useState(true)

  // Deterministic evaluation simulation logic matching AcmePay rules
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
    // Admin always ALLOW
    if (principal.includes("admin")) {
      return {
        decision: "ALLOW",
        matchedPolicy: "policy_admin_full_access",
        reason: "Matched explicit permit for Role::admin across all actions and resources.",
        executionMs: 0.72,
      }
    }

    // Version 13 Buggy Behavior:
    if (ver === "v13") {
      if (principal.includes("contractor")) {
        // Broadened action wildcard in v13 allows contractor actions
        return {
          decision: "ALLOW",
          matchedPolicy: "policy_contractor_all_actions",
          reason: "⚠ Matched unrestricted action clause in candidate policy v13 (Line 24).",
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

    // Version 12 Production Behavior:
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

    // Default Deny
    return {
      decision: "DENY",
      matchedPolicy: "default_deny",
      reason: "No explicit permit statement matched the authorization request. Implicit default deny applied.",
      executionMs: 0.65,
    }
  }

  const result = evaluateAccess(selectedPrincipal, selectedAction, selectedResource, policyVersion)

  const handleSimulate = () => {
    setIsSimulating(true)
    setTimeout(() => {
      setIsSimulating(false)
      setHasEvaluated(true)
    }, 200)
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Ad-hoc Scenario Simulator
          </h1>
          <p className="text-xs text-muted-foreground">
            Simulate authorization requests against Cedar policy versions with millisecond execution latency.
          </p>
        </div>

        {/* Policy Version Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Simulate Against:</span>
          <div className="flex items-center p-1 rounded-lg bg-muted border border-border">
            <button
              onClick={() => setPolicyVersion("v12")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                policyVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (PROD)
            </button>
            <button
              onClick={() => setPolicyVersion("v13")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                policyVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Candidate)
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Inputs (7 cols) & Output (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Request Form */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-500" />
                Authorization Request Vector
              </CardTitle>
              <CardDescription>
                Select or configure the Principal, Action, Resource, and Context tuple.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4 text-xs">
              {/* Principal Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">
                  Principal (Caller)
                </label>
                <select
                  value={selectedPrincipal}
                  onChange={(e) => setSelectedPrincipal(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SAMPLE_PRINCIPALS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">
                  Action
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SAMPLE_ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">
                  Resource Target
                </label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-background border border-input text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {SAMPLE_RESOURCES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Context JSON */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase">
                  Context (JSON Attributes)
                </label>
                <textarea
                  value={contextJson}
                  onChange={(e) => setContextJson(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-md bg-background border border-input text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <Button
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs gap-1.5 h-9 shadow-md shadow-indigo-500/20"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {isSimulating ? "Evaluating with Cedar..." : "Evaluate Request ⚡"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Output Result Card */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Simulation Outcome</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {policyVersion}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4 text-xs">
              {hasEvaluated ? (
                <>
                  {/* Decision Hero Pill */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                        Cedar Decision
                      </span>
                      <DecisionBadge decision={result.decision} size="lg" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                        Execution Latency
                      </span>
                      <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        {result.executionMs} ms
                      </span>
                    </div>
                  </div>

                  {/* Matched Policy Diagnostics */}
                  <div className="p-3.5 rounded-lg bg-background border border-border space-y-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Determining Policy
                    </span>
                    <div className="flex items-center gap-1.5 font-mono text-xs text-foreground font-semibold">
                      <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                      <code>{result.matchedPolicy}</code>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {result.reason}
                    </p>
                  </div>

                  {/* Version Comparison Card */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Version Comparison Delta
                    </span>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="text-center flex-1">
                        <span className="text-[10px] text-muted-foreground block">v12 (PROD)</span>
                        <DecisionBadge
                          decision={
                            evaluateAccess(selectedPrincipal, selectedAction, selectedResource, "v12").decision
                          }
                          size="sm"
                        />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
                      <div className="text-center flex-1">
                        <span className="text-[10px] text-muted-foreground block">v13 (Draft)</span>
                        <DecisionBadge
                          decision={
                            evaluateAccess(selectedPrincipal, selectedAction, selectedResource, "v13").decision
                          }
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  Click "Evaluate Request" to run the scenario through the Cedar engine.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
