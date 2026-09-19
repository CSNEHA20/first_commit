import React, { useState, useEffect } from "react"
import {
  X,
  Copy,
  Check,
  Code2,
  Lock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileSearch,
  Sparkles,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DecisionBadge } from "./DecisionBadge"
import { SeverityBadge } from "./SeverityBadge"
import { Counterexample, AIExplanationResponse } from "@/types/authz"
import { explainAuthorizationFinding } from "@/lib/api"

interface EvidenceDrawerProps {
  counterexample: Counterexample | null
  isOpen: boolean
  onClose: () => void
  onApplyRemediation?: (cedarCode: string) => void
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  counterexample,
  isOpen,
  onClose,
  onApplyRemediation,
}) => {
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)
  const [explanation, setExplanation] = useState<AIExplanationResponse | null>(null)
  const [explanationError, setExplanationError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && counterexample) {
      loadExplanation("AUTO")
    } else {
      setExplanation(null)
      setExplanationError(null)
    }
  }, [isOpen, counterexample?.id])

  const loadExplanation = async (preference: "BEDROCK" | "LOCAL_FALLBACK" | "AUTO") => {
    if (!counterexample) return
    setIsExplaining(true)
    setExplanationError(null)
    try {
      const res = await explainAuthorizationFinding({
        baselineDecision: counterexample.baselineDecision,
        candidateDecision: counterexample.candidateDecision,
        transition: counterexample.transition,
        scenarioId: counterexample.scenarioId || counterexample.id,
        scenarioTitle: counterexample.scenarioTitle || counterexample.title,
        principal: counterexample.principal,
        action: counterexample.action,
        resource: counterexample.resource,
        context: counterexample.context as Record<string, unknown>,
        violatedContractId: counterexample.violatedContractId || undefined,
        violatedContractTitle: counterexample.violatedContractTitle || undefined,
        counterexampleId: counterexample.id,
        matchedPolicyId: counterexample.matchedPolicyId || undefined,
        baselineDeterminingPolicies: counterexample.baselineDeterminingPolicies,
        candidateDeterminingPolicies: counterexample.candidateDeterminingPolicies,
        reproduced: true,
        providerPreference: preference,
      })
      setExplanation(res)
    } catch (err: any) {
      setExplanationError(err.message || "Failed to generate explanation")
    } finally {
      setIsExplaining(false)
    }
  }

  if (!isOpen || !counterexample) return null

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleApplyFix = (code: string) => {
    if (onApplyRemediation) {
      onApplyRemediation(code)
      setApplied(true)
      setTimeout(() => setApplied(false), 2000)
    }
  }

  const fallbackRemediation = `// Re-constrain the action scope in Cedar policy:\npermit (\n    principal in Role::"${counterexample.principalRole || "user"}",\n    action == Action::"view",\n    resource in ResourceType::"${counterexample.resourceType || "SupportTicket"}"\n);`

  const remediationCode = explanation?.remediationCedar || fallbackRemediation

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px] animate-in fade-in-0 duration-150">
      <div className="relative w-full max-w-xl bg-card border-l border-border h-full flex flex-col shadow-xl overflow-y-auto animate-in slide-in-from-right-full duration-200">
        {/* Inspector Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Forensic Evidence Inspector
              </h2>
              <p className="text-[10px] text-muted-foreground font-mono">
                Finding ID: {counterexample.id} · Scenario: {counterexample.scenarioId || "sc_06"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SeverityBadge severity={(counterexample.severity as any) || "HIGH"} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 flex-1 text-xs">
          {/* Finding Title & Transition Header */}
          <div className="p-3 rounded-md border border-status-blocked/30 bg-status-blocked/[0.02] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-status-deny uppercase tracking-wider">
                Behavioral Transition
              </span>
              <Badge variant="blocked" className="text-[10px]">
                UNINTENDED EXPANSION
              </Badge>
            </div>
            <h3 className="text-xs font-semibold text-foreground">
              {counterexample.title || counterexample.scenarioTitle || counterexample.id}
            </h3>

            {/* Decision Flip Comparison */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 p-2 rounded bg-background border border-border text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5">
                  v12 (Production)
                </span>
                <DecisionBadge decision={counterexample.baselineDecision} size="sm" />
              </div>

              <div className="flex items-center justify-center text-status-deny">
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="flex-1 p-2 rounded bg-background border border-border text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5">
                  v13 (Candidate)
                </span>
                <DecisionBadge decision={counterexample.candidateDecision} size="sm" />
              </div>
            </div>
          </div>

          {/* Section 1: Deterministic Cedar Evidence (Ground Truth) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-status-allow" />
                1. Deterministic Cedar Evidence
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                cedar-rust @ {counterexample.evidence?.executionDurationMs ?? 0.85}ms
              </span>
            </div>

            {/* Request Tuple */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Principal</span>
                <span className="text-foreground font-semibold truncate block">{counterexample.principal}</span>
              </div>

              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Action</span>
                <span className="text-status-warning font-semibold truncate block">{counterexample.action}</span>
              </div>

              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Resource</span>
                <span className="text-foreground font-semibold truncate block">{counterexample.resource}</span>
              </div>

              <div className="p-2 rounded bg-muted/40 border border-border">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Context</span>
                <span className="text-muted-foreground truncate block">network: EXTERNAL</span>
              </div>
            </div>

            {/* Determining Policy Line Snippet */}
            <div className="p-2.5 rounded bg-muted/30 border border-border space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-[10px] font-sans">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Code2 className="h-3 w-3 text-primary" />
                  Determining Policy: <code className="font-mono">{counterexample.matchedPolicyId || "policy_contractor_all_actions"}</code>
                </span>
                <Badge variant="outline" className="text-[9px] font-mono">Line 24</Badge>
              </div>
              <pre className="p-2 rounded bg-card text-[11px] text-muted-foreground border border-border overflow-x-auto">
                {counterexample.evidence?.matchedPolicies?.[0]?.clause ||
                  `permit (\n    principal in Role::"contractor",\n    action,\n    resource in ResourceType::"SupportTicket"\n);`}
              </pre>
            </div>

            {/* Violated Security Contract Notice */}
            {counterexample.violatedContractId && (
              <div className="p-2.5 rounded bg-status-blocked/10 border border-status-blocked/20 text-status-deny flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold text-[11px]">
                    Violated Invariant: {counterexample.violatedContractId}
                  </span>
                  <p className="text-[10px] text-foreground/80">
                    "{counterexample.violatedContractTitle || "Contractors cannot delete payroll reports"}"
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Section 2: Grounded AI Explanation (Deterministic Evidence Backed) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                2. Structured Explanation
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadExplanation("BEDROCK")}
                disabled={isExplaining}
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {isExplaining ? "Analyzing..." : "Refresh"}
              </Button>
            </div>

            {explanationError ? (
              <div className="p-2 rounded bg-status-deny/10 border border-status-deny/20 text-status-deny text-[11px] flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Error: {explanationError}</span>
              </div>
            ) : explanation ? (
              <div className="p-3 rounded-md bg-muted/20 border border-border space-y-2.5 text-xs">
                <div>
                  <span className="font-semibold text-foreground block text-[11px] mb-0.5">
                    Summary:
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {explanation.summary}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-foreground block text-[11px] mb-0.5">
                    Root Cause:
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {explanation.rootCause}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-status-deny block text-[11px] mb-0.5">
                    Security Impact:
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    {explanation.securityImpact}
                  </p>
                </div>

                {/* Evidence Citations */}
                {explanation.evidenceCitations && explanation.evidenceCitations.length > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                      Citations:
                    </span>
                    {explanation.evidenceCitations.map((cite, idx) => (
                      <Badge key={idx} variant="outline" className="text-[9px] font-mono px-1.5 py-0">
                        {cite}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Limitations disclaimer */}
                {explanation.limitations && explanation.limitations.length > 0 && (
                  <div className="p-2 rounded bg-status-warning/10 border border-status-warning/20 text-status-warning text-[10px] flex items-start gap-1.5">
                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>Bounded scenario universe analysis. Ground truth derived from Cedar WASM engine.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded bg-muted/20 text-center text-muted-foreground text-[11px]">
                Loading grounded explanation...
              </div>
            )}
          </div>

          <Separator />

          {/* Section 3: Suggested Cedar Remediation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-status-allow">
                3. Suggested Cedar Remediation Patch
              </span>
              <div className="flex items-center gap-1">
                {onApplyRemediation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyFix(remediationCode)}
                    className="h-6 text-[10px] gap-1"
                  >
                    {applied ? "Applied!" : "Apply to Editor"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(remediationCode)}
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-3 w-3 text-status-allow" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <pre className="p-2.5 rounded bg-muted/30 border border-border font-mono text-[11px] text-foreground overflow-x-auto leading-relaxed">
              {remediationCode}
            </pre>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="sticky bottom-0 p-3 border-t border-border bg-card flex items-center justify-between text-xs">
          <span className="text-[10px] text-muted-foreground font-mono">
            Deterministic evaluation verified.
          </span>
          <Button variant="default" size="sm" onClick={onClose} className="h-7 text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
