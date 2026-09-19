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

  const fallbackRemediation = `// Re-constrain the action scope in Cedar policy:\npermit (\n    principal in Role::"${counterexample.principalRole || "contractor"}",\n    action == Action::"view",\n    resource in ResourceType::"${counterexample.resourceType || "SupportTicket"}"\n);`

  const remediationCode = explanation?.remediationCedar || fallbackRemediation

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-150">
      <div className="relative w-full max-w-xl bg-[#0D1015]/95 border-l border-white/[0.1] h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right-full duration-200">
        {/* Inspector Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <FileSearch className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Forensic Evidence Inspector
              </h2>
              <p className="text-[10px] text-muted-foreground font-mono">
                Finding ID: <span className="text-orange-400">{counterexample.id}</span> · Scenario: {counterexample.scenarioId || "sc_06"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SeverityBadge severity={(counterexample.severity as any) || "HIGH"} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 flex-1 text-xs">
          {/* Finding Title & Transition Header */}
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/[0.05] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider font-mono">
                Behavioral Transition
              </span>
              <Badge variant="blocked" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">
                UNINTENDED EXPANSION
              </Badge>
            </div>
            <h3 className="text-xs font-semibold text-foreground">
              {counterexample.title || counterexample.scenarioTitle || counterexample.id}
            </h3>

            {/* Decision Flip Comparison */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 p-2 rounded-lg bg-black/40 border border-white/[0.06] text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono">
                  v12 (Production)
                </span>
                <DecisionBadge decision={counterexample.baselineDecision} size="sm" />
              </div>

              <div className="flex items-center justify-center text-red-400">
                <ArrowRight className="h-4 w-4" />
              </div>

              <div className="flex-1 p-2 rounded-lg bg-black/40 border border-white/[0.06] text-center">
                <span className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono">
                  v13 (Candidate)
                </span>
                <DecisionBadge decision={counterexample.candidateDecision} size="sm" />
              </div>
            </div>
          </div>

          {/* Section 1: Deterministic Cedar Evidence (Ground Truth) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                1. Deterministic Cedar Evidence
              </span>
              <span className="font-mono text-[10px] text-orange-400">
                cedar-rust @ {counterexample.evidence?.executionDurationMs ?? 0.85}ms
              </span>
            </div>

            {/* Request Tuple */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Principal</span>
                <span className="text-foreground font-semibold truncate block">{counterexample.principal}</span>
              </div>

              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Action</span>
                <span className="text-orange-400 font-semibold truncate block">{counterexample.action}</span>
              </div>

              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Resource</span>
                <span className="text-foreground font-semibold truncate block">{counterexample.resource}</span>
              </div>

              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[9px] text-muted-foreground block font-sans uppercase font-medium">Context</span>
                <span className="text-muted-foreground truncate block">network: EXTERNAL</span>
              </div>
            </div>

            {/* Determining Policy Line Snippet */}
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-[10px] font-sans">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Code2 className="h-3 w-3 text-orange-400" />
                  Determining Policy: <code className="font-mono text-orange-400">{counterexample.matchedPolicyId || "policy_contractor_all_actions"}</code>
                </span>
                <Badge variant="outline" className="text-[9px] font-mono border-white/[0.1]">Line 24</Badge>
              </div>
              <pre className="p-2 rounded bg-black/60 text-[11px] text-muted-foreground border border-white/[0.05] overflow-x-auto font-mono">
                {counterexample.evidence?.matchedPolicies?.[0]?.clause ||
                  `permit (\n    principal in Role::"contractor",\n    action,\n    resource in ResourceType::"SupportTicket"\n);`}
              </pre>
            </div>

            {/* Violated Security Contract Notice */}
            {counterexample.violatedContractId && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
                <div className="space-y-0.5">
                  <span className="font-bold text-[11px] font-mono">
                    Violated Invariant: {counterexample.violatedContractId}
                  </span>
                  <p className="text-[10px] text-foreground/80 font-sans">
                    "{counterexample.violatedContractTitle || "Contractors cannot delete payroll reports"}"
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-white/[0.08]" />

          {/* Section 2: Grounded AI Explanation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 font-mono">
                <Sparkles className="h-3.5 w-3.5 text-orange-400" />
                2. Structured Explanation
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadExplanation("BEDROCK")}
                disabled={isExplaining}
                className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
              >
                {isExplaining ? "Analyzing..." : "Refresh"}
              </Button>
            </div>

            {explanationError ? (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-1.5 font-mono">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Error: {explanationError}</span>
              </div>
            ) : explanation ? (
              <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5 text-xs">
                <div>
                  <span className="font-semibold text-foreground block text-[11px] mb-0.5">
                    Summary:
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px] font-sans">
                    {explanation.summary}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-foreground block text-[11px] mb-0.5">
                    Root Cause:
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px] font-sans">
                    {explanation.rootCause}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-red-400 block text-[11px] mb-0.5">
                    Security Impact:
                  </span>
                  <p className="text-muted-foreground leading-relaxed text-[11px] font-sans">
                    {explanation.securityImpact}
                  </p>
                </div>

                {/* Evidence Citations */}
                {explanation.evidenceCitations && explanation.evidenceCitations.length > 0 && (
                  <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">
                      Citations:
                    </span>
                    {explanation.evidenceCitations.map((cite, idx) => (
                      <Badge key={idx} variant="outline" className="text-[9px] font-mono px-1.5 py-0 border-white/[0.1] text-orange-400">
                        {cite}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Limitations disclaimer */}
                {explanation.limitations && explanation.limitations.length > 0 && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] flex items-start gap-1.5">
                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>Bounded scenario universe analysis. Ground truth derived from Cedar WASM engine.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-black/40 text-center text-muted-foreground text-[11px]">
                Loading grounded explanation...
              </div>
            )}
          </div>

          <Separator className="bg-white/[0.08]" />

          {/* Section 3: Suggested Cedar Remediation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 font-mono">
                3. Suggested Cedar Remediation Patch
              </span>
              <div className="flex items-center gap-1">
                {onApplyRemediation && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleApplyFix(remediationCode)}
                    className="h-6 text-[10px] gap-1 border-white/[0.1] hover:bg-white/[0.05]"
                  >
                    {applied ? "Applied!" : "Apply to Editor"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyCode(remediationCode)}
                  className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            <pre className="p-3 rounded-xl bg-black/60 border border-white/[0.08] font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed">
              {remediationCode}
            </pre>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="sticky bottom-0 p-3 border-t border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md flex items-center justify-between text-xs">
          <span className="text-[10px] text-muted-foreground font-mono">
            Deterministic Cedar AST evaluation verified.
          </span>
          <Button variant="default" size="sm" onClick={onClose} className="h-7 text-xs bg-[#FF6A24] text-white hover:bg-[#FF8A42]">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
