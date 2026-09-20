import React, { useState, useEffect, useCallback } from "react"
import {
  Zap,
  Play,
  ArrowRight,
  Code2,
  Bookmark,
  HelpCircle,
  Clock,
  Cpu,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DecisionBadge } from "@/components/common/DecisionBadge"
import { StatusBadge } from "@/components/common/StatusBadge"
import { AuthorizationDecision, CanonicalEvidence } from "@/types/authz"
import { simulateSingleAuthorization } from "@/lib/api"
import {
  ACMEPAY_ENTITIES,
  ACMEPAY_SCHEMA,
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
} from "@/fixtures/acmepay"

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

import { useWorkspace } from "@/store/workspaceStore"
import { ConnectedSimulatorPanel } from "./ConnectedSimulatorPanel"

export const SimulatorScreen: React.FC = () => {
  const { isDemoMode } = useWorkspace()

  if (!isDemoMode) {
    return <ConnectedSimulatorPanel />
  }

  const [selectedPrincipal, setSelectedPrincipal] = useState(SAMPLE_PRINCIPALS[0].id)
  const [selectedAction, setSelectedAction] = useState(SAMPLE_ACTIONS[2].id)
  const [selectedResource, setSelectedResource] = useState(SAMPLE_RESOURCES[0].id)
  const [contextJson, setContextJson] = useState('{\n  "network": "EXTERNAL",\n  "isMfaVerified": false\n}')
  const [policyVersion, setPolicyVersion] = useState<"v12" | "v13">("v13")
  const [isSimulating, setIsSimulating] = useState(false)
  const [hasEvaluated, setHasEvaluated] = useState(true)

  const [targetEvidence, setTargetEvidence] = useState<CanonicalEvidence | null>(null)
  const [baselineEvidence, setBaselineEvidence] = useState<CanonicalEvidence | null>(null)
  const [candidateEvidence, setCandidateEvidence] = useState<CanonicalEvidence | null>(null)
  const [isLiveCedar, setIsLiveCedar] = useState(false)

  const evaluateAccessLocal = (
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

  const runSimulation = useCallback(
    async (
      principal: string,
      action: string,
      resource: string,
      ver: "v12" | "v13",
      contextStr: string
    ) => {
      setIsSimulating(true)
      let parsedCtx: Record<string, unknown> = {}
      try {
        parsedCtx = JSON.parse(contextStr)
      } catch {
        parsedCtx = {}
      }

      try {
        const [targetRes, baseRes, candRes] = await Promise.all([
          simulateSingleAuthorization({
            principal,
            action,
            resource,
            context: parsedCtx,
            policyText: ver === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT,
            schemaText: ACMEPAY_SCHEMA,
            entities: ACMEPAY_ENTITIES,
          }),
          simulateSingleAuthorization({
            principal,
            action,
            resource,
            context: parsedCtx,
            policyText: POLICY_V12_TEXT,
            schemaText: ACMEPAY_SCHEMA,
            entities: ACMEPAY_ENTITIES,
          }),
          simulateSingleAuthorization({
            principal,
            action,
            resource,
            context: parsedCtx,
            policyText: POLICY_V13_TEXT,
            schemaText: ACMEPAY_SCHEMA,
            entities: ACMEPAY_ENTITIES,
          }),
        ])

        setTargetEvidence(targetRes)
        setBaselineEvidence(baseRes)
        setCandidateEvidence(candRes)
        setIsLiveCedar(true)
        setHasEvaluated(true)
      } catch (err) {
        console.warn("Backend simulation failed, using deterministic local engine fallback:", err)
        setIsLiveCedar(false)
        setHasEvaluated(true)
      } finally {
        setIsSimulating(false)
      }
    },
    []
  )

  useEffect(() => {
    runSimulation(selectedPrincipal, selectedAction, selectedResource, policyVersion, contextJson)
  }, [runSimulation, selectedPrincipal, selectedAction, selectedResource, policyVersion, contextJson])

  const localResult = evaluateAccessLocal(selectedPrincipal, selectedAction, selectedResource, policyVersion)
  const localBaseline = evaluateAccessLocal(selectedPrincipal, selectedAction, selectedResource, "v12")
  const localCandidate = evaluateAccessLocal(selectedPrincipal, selectedAction, selectedResource, "v13")

  const activeDecision: AuthorizationDecision = targetEvidence?.decision ?? localResult.decision
  const activeExecutionMs: number = targetEvidence
    ? Math.round(targetEvidence.executionDurationMs * 100) / 100
    : localResult.executionMs
  const activeMatchedPolicy: string = targetEvidence?.determiningPolicies?.length
    ? targetEvidence.determiningPolicies.join(", ")
    : targetEvidence?.matchedPolicies?.[0]?.policyId || localResult.matchedPolicy
  const activeReason: string = targetEvidence
    ? activeDecision === "ALLOW"
      ? `Explicit permit satisfied via Cedar WASM engine (${activeMatchedPolicy}).`
      : "No explicit permit statement matched the authorization request. Implicit default deny applied."
    : localResult.reason

  const baselineDecision: AuthorizationDecision = baselineEvidence?.decision ?? localBaseline.decision
  const candidateDecision: AuthorizationDecision = candidateEvidence?.decision ?? localCandidate.decision
  const isDecisionFlip = baselineDecision !== candidateDecision

  const handleSimulate = () => {
    runSimulation(selectedPrincipal, selectedAction, selectedResource, policyVersion, contextJson)
  }

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setSelectedPrincipal(tpl.principal)
    setSelectedAction(tpl.action)
    setSelectedResource(tpl.resource)
    runSimulation(tpl.principal, tpl.action, tpl.resource, policyVersion, contextJson)
  }

  return (
    <div className="space-y-4">
      {/* Simulator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.1] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono">Cedar Request Debugger</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">Interactive WASM Authorization Engine</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-orange-400 shadow-[0_0_12px_rgba(255,106,36,0.6)]" />
            Ad-hoc Scenario Simulator
          </h1>
        </div>

        {/* Policy Version Switcher */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground font-mono">Target:</span>
          <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/[0.12] backdrop-blur-md">
            <button
              onClick={() => setPolicyVersion("v12")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                policyVersion === "v12"
                  ? "bg-white/[0.12] text-white shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              v12 (Production)
            </button>
            <button
              onClick={() => setPolicyVersion("v13")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                policyVersion === "v13"
                  ? "bg-[#FF6A24] text-white shadow-[0_0_12px_rgba(255,106,36,0.4)]"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              v13 (Candidate)
            </button>
          </div>
        </div>
      </div>

      {/* Quick Scenario Templates Bar (Glass Capsule Bar) */}
      <div className="glass-card-premium p-3 rounded-2xl flex items-center gap-2 overflow-x-auto text-xs shadow-lg">
        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 shrink-0 font-mono pl-1">
          <Bookmark className="h-3.5 w-3.5 text-orange-400" />
          Templates:
        </span>
        {QUICK_TEMPLATES.map((tpl, idx) => (
          <button
            key={idx}
            onClick={() => applyTemplate(tpl)}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] hover:border-orange-500/40 text-foreground text-[11px] font-medium border border-white/[0.08] whitespace-nowrap transition-all duration-200 shrink-0 backdrop-blur-md hover:-translate-y-0.5"
          >
            {tpl.name}
          </button>
        ))}
      </div>

      {/* Grid: Request Vector & Outcome Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Request Configuration (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="glass-card-premium">
            <CardHeader className="p-4 border-b border-white/[0.08]">
              <CardTitle className="text-xs font-bold">
                Authorization Request Vector
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Configure the Principal, Action, Resource, and Context tuple.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5 text-xs">
              {/* Principal Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  Principal
                </label>
                <select
                  value={selectedPrincipal}
                  onChange={(e) => setSelectedPrincipal(e.target.value)}
                  className="glass-input w-full h-9 px-3 rounded-xl text-xs font-mono text-foreground focus:outline-none"
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
                <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  Action
                </label>
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="glass-input w-full h-9 px-3 rounded-xl text-xs font-mono text-foreground focus:outline-none"
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
                <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  Resource
                </label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="glass-input w-full h-9 px-3 rounded-xl text-xs font-mono text-foreground focus:outline-none"
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
                <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                  Context (JSON Attributes)
                </label>
                <textarea
                  value={contextJson}
                  onChange={(e) => setContextJson(e.target.value)}
                  rows={2}
                  className="glass-input w-full p-2.5 rounded-xl text-xs font-mono text-foreground focus:outline-none"
                />
              </div>

              <Button
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full glass-button-orange text-white font-bold text-xs gap-2 h-9 mt-1 rounded-xl"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                {isSimulating ? "Evaluating in Cedar WASM..." : "Evaluate Request Vector"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Output Result & Delta Comparison (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="glass-card-premium">
            <CardHeader className="p-4 border-b border-white/[0.08]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xs font-bold">Evaluation Outcome</CardTitle>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30">
                    <Cpu className="h-2.5 w-2.5" />
                    {isLiveCedar ? "Cedar WASM Live" : "Deterministic Engine"}
                  </span>
                </div>
                <StatusBadge status={activeDecision} size="xs" />
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3.5 text-xs">
              {hasEvaluated ? (
                <>
                  {/* Decision Hero Banner */}
                  <div className={`p-4 rounded-2xl border backdrop-blur-xl flex items-center justify-between shadow-lg ${
                    activeDecision === "ALLOW"
                      ? "border-emerald-500/40 bg-emerald-500/[0.08] shadow-[0_0_20px_rgba(24,184,104,0.15)]"
                      : "border-red-500/40 bg-red-500/[0.08] shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                  }`}>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1 font-mono">
                        Target Decision ({policyVersion})
                      </span>
                      <DecisionBadge decision={activeDecision} size="lg" />
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1 font-mono flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3 text-orange-400" /> Latency
                      </span>
                      <span className="font-mono font-black text-sm text-foreground">
                        {activeExecutionMs} ms
                      </span>
                    </div>
                  </div>

                  {/* Matched Policy Trace (Frosted Glass Panel) */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.1] backdrop-blur-md space-y-1.5 text-xs shadow-inner">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                      Determining Policy Statement
                    </span>
                    <div className="flex items-center gap-2 font-mono text-xs text-foreground font-bold">
                      <Code2 className="h-3.5 w-3.5 text-orange-400" />
                      <code className="text-orange-400">{activeMatchedPolicy}</code>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5 font-sans">
                      {activeReason}
                    </p>
                  </div>

                  {/* Side-by-Side Baseline vs Candidate Comparison */}
                  <div className="p-3 rounded-xl bg-black/30 border border-white/[0.1] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                        Version Comparison Delta
                      </span>
                      {isDecisionFlip && (
                        <span className="text-[9px] font-mono font-bold text-red-400 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse">
                          DECISION FLIP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="text-center flex-1 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                        <span className="text-[10px] text-muted-foreground block mb-1 font-mono">v12 (Production)</span>
                        <DecisionBadge decision={baselineDecision} size="sm" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground mx-2 shrink-0" />
                      <div className="text-center flex-1 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                        <span className="text-[10px] text-muted-foreground block mb-1 font-mono">v13 (Candidate)</span>
                        <DecisionBadge decision={candidateDecision} size="sm" />
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
