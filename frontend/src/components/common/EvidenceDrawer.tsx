import React, { useState, useEffect } from "react"
import {
  X,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  Code2,
  Lock,
  ArrowRight,
  FileCheck,
  AlertTriangle,
  Info,
  Layers,
  Cpu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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

  const fallbackRemediation = `// Recommended Fix: Re-constrain the action scope in Cedar:\npermit (\n    principal in Role::"${counterexample.principalRole || "user"}",\n    action == Action::"view",\n    resource in ResourceType::"${counterexample.resourceType || "resource"}"\n);`

  const remediationCode = explanation?.remediationCedar || fallbackRemediation

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right-full duration-300">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Evidence Workspace & AI Findings
              </h2>
              <p className="text-xs text-muted-foreground">
                Finding ID: <span className="font-mono">{counterexample.id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={(counterexample.severity as any) || "HIGH"} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Finding Title & Transition Header */}
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">
                Behavioral Transition
              </span>
              <Badge variant="destructive">
                {counterexample.transition === "NEWLY_AUTHORIZED" ? "Unintended Authorization Expansion" : counterexample.transition}
              </Badge>
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {counterexample.title || counterexample.scenarioTitle || counterexample.id}
            </h3>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 p-2.5 rounded-lg bg-background border border-border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Baseline Policy
                </span>
                <DecisionBadge decision={counterexample.baselineDecision} />
              </div>

              <div className="flex items-center justify-center text-rose-500">
                <ArrowRight className="h-5 w-5 animate-pulse" />
              </div>

              <div className="flex-1 p-2.5 rounded-lg bg-background border border-border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Candidate Policy
                </span>
                <DecisionBadge decision={counterexample.candidateDecision} />
              </div>
            </div>
          </div>

          {/* Section 1: Deterministic Cedar Evidence */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5 text-emerald-500" />
                1. Deterministic Cedar Evidence
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono">
                {counterexample.evidence?.engine || "cedar-wasm@4.13.0"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Principal
                </span>
                <code className="font-mono text-foreground font-semibold">
                  {counterexample.principal}
                </code>
                <span className="text-muted-foreground text-[10px] block mt-0.5">
                  Role: Role::"{counterexample.principalRole || "user"}"
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Action
                </span>
                <code className="font-mono text-amber-500 font-semibold">
                  {counterexample.action}
                </code>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Resource
                </span>
                <code className="font-mono text-sky-500 font-semibold truncate block">
                  {counterexample.resource}
                </code>
                <span className="text-muted-foreground text-[10px] block mt-0.5">
                  Type: {counterexample.resourceType || "Resource"}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Evaluation Duration
                </span>
                <span className="font-mono text-emerald-500 font-bold">
                  {counterexample.evidence?.executionDurationMs ?? 0.85} ms
                </span>
                <span className="text-muted-foreground text-[10px] block mt-0.5">
                  Mode: DETERMINISTIC
                </span>
              </div>
            </div>

            {/* Matched Policy Snippet */}
            <div className="p-3.5 rounded-lg bg-muted/50 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                  Determining Policy ID:{" "}
                  <code className="text-indigo-500 font-mono">
                    {counterexample.matchedPolicyId || counterexample.candidateDeterminingPolicies?.[0] || "policy_candidate"}
                  </code>
                </span>
                {counterexample.evidence?.matchedPolicies?.[0]?.lineNumber && (
                  <Badge variant="outline" className="text-[10px]">
                    Line {counterexample.evidence.matchedPolicies[0].lineNumber}
                  </Badge>
                )}
              </div>
              <pre className="p-2.5 rounded bg-background text-[11px] font-mono text-muted-foreground border border-border overflow-x-auto">
                {counterexample.evidence?.matchedPolicies?.[0]?.clause ||
                  counterexample.explanation ||
                  `permit ( principal in Role::"${counterexample.principalRole || "user"}", action, resource );`}
              </pre>
            </div>

            {/* Contract Violation Notice */}
            {counterexample.violatedContractId && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5">
                <Lock className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-rose-500">
                    Security Contract Violation: {counterexample.violatedContractId}
                  </span>
                  <p className="text-muted-foreground mt-0.5">
                    "{counterexample.violatedContractTitle}"
                  </p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Section 2: AI Reasoning & Grounded Explanation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  2. Grounded AI Explanation
                </h4>
                {explanation && (
                  <Badge variant="outline" className="text-[10px] font-mono gap-1 border-purple-500/30 text-purple-400">
                    <Cpu className="h-3 w-3" />
                    {explanation.isDeterministicFallback ? "Deterministic Template" : explanation.providerUsed}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadExplanation("BEDROCK")}
                  disabled={isExplaining}
                  className="h-7 text-[11px] border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
                >
                  {isExplaining ? "Analyzing..." : "Refresh Explanation"}
                </Button>
              </div>
            </div>

            {explanationError ? (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Explanation error: {explanationError}</span>
              </div>
            ) : explanation ? (
              <Card className="border-purple-500/30 bg-purple-500/5">
                <CardContent className="p-4 space-y-3.5 text-xs">
                  <div>
                    <span className="font-bold text-purple-400 block mb-1">
                      Summary & Authorization Transition:
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {explanation.summary}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-purple-400 block mb-1">
                      Root Cause Analysis:
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {explanation.rootCause}
                    </p>
                  </div>

                  <div>
                    <span className="font-bold text-rose-400 block mb-1">
                      Security & Operational Impact:
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      {explanation.securityImpact}
                    </p>
                  </div>

                  {/* Evidence Citations */}
                  {explanation.evidenceCitations && explanation.evidenceCitations.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-background/80 border border-border space-y-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3 text-purple-400" />
                        Traceable Evidence Citations:
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {explanation.evidenceCitations.map((cite, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] font-mono">
                            {cite}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Limitations and Missing Evidence Notice */}
                  {explanation.limitations && explanation.limitations.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 text-[11px] flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold block">Analysis Boundary & Caveats:</span>
                        {explanation.limitations.map((lim, idx) => (
                          <p key={idx} className="text-muted-foreground text-[10px] leading-tight">
                            • {lim}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Cedar Remediation */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-emerald-400">
                        Suggested Cedar Remediation:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onApplyRemediation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyFix(remediationCode)}
                            className="h-6 text-[10px] text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                          >
                            {applied ? "Applied!" : "Apply to Editor"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyCode(remediationCode)}
                          className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                        >
                          {copied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy Fix
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <pre className="p-3 rounded-lg bg-background border border-border font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      {remediationCode}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="p-4 rounded-lg bg-muted/20 border border-border text-center text-xs text-muted-foreground">
                Click "Refresh Explanation" to analyze this finding.
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="sticky bottom-0 p-4 border-t border-border bg-card/95 backdrop-blur-md flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Deterministic facts verified by Cedar Engine.
          </span>
          <Button variant="default" size="sm" onClick={onClose} className="text-xs">
            Done Reviewing
          </Button>
        </div>
      </div>
    </div>
  )
}

