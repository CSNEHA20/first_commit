import React, { useState } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DecisionBadge } from "./DecisionBadge"
import { SeverityBadge } from "./SeverityBadge"
import { Counterexample } from "@/types/authz"
import { BEDROCK_EXPLANATION_DATA } from "@/fixtures/acmepay"

interface EvidenceDrawerProps {
  counterexample: Counterexample | null
  isOpen: boolean
  onClose: () => void
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  counterexample,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)

  if (!isOpen || !counterexample) return null

  const bedrockData =
    BEDROCK_EXPLANATION_DATA[counterexample.id] || {
      findingId: counterexample.id,
      summary: "Deterministic transition detected from baseline policy restriction.",
      rootCause: `Evaluating the candidate version under scenario '${counterexample.id}' resulted in an unexpected ALLOW decision matching policy ${counterexample.matchedPolicyId}.`,
      securityRisk: "Unintended permission expansion enables unauthorized principal operations without security contract enforcement.",
      remediationCedar: `// Recommended Fix: Re-constrain the action scope in Cedar:\npermit (\n    principal in Role::"${counterexample.principalRole}",\n    action == Action::"view",\n    resource in ResourceType::"${counterexample.resourceType}"\n);`,
    }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bedrockData.remediationCedar)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTriggerBedrock = () => {
    setIsExplaining(true)
    setTimeout(() => setIsExplaining(false), 800)
  }

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
                Why Did This Authorization Change?
              </h2>
              <p className="text-xs text-muted-foreground">
                Finding ID: <span className="font-mono">{counterexample.id}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={counterexample.severity} />
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
                Unintended Expansion
              </Badge>
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {counterexample.title}
            </h3>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex-1 p-2.5 rounded-lg bg-background border border-border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Baseline (v12)
                </span>
                <DecisionBadge decision={counterexample.baselineDecision} />
              </div>

              <div className="flex items-center justify-center text-rose-500">
                <ArrowRight className="h-5 w-5 animate-pulse" />
              </div>

              <div className="flex-1 p-2.5 rounded-lg bg-background border border-border text-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                  Proposed (v13)
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
                {counterexample.evidence.engine}
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
                  Role: Role::"{counterexample.principalRole}"
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
                  Type: {counterexample.resourceType}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Evaluation Time
                </span>
                <span className="font-mono text-emerald-500 font-bold">
                  {counterexample.evidence.executionDurationMs} ms
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
                  Matched Policy ID:{" "}
                  <code className="text-indigo-500 font-mono">
                    {counterexample.matchedPolicyId}
                  </code>
                </span>
                {counterexample.evidence.matchedPolicies[0]?.lineNumber && (
                  <Badge variant="outline" className="text-[10px]">
                    Line {counterexample.evidence.matchedPolicies[0].lineNumber}
                  </Badge>
                )}
              </div>
              <pre className="p-2.5 rounded bg-background text-[11px] font-mono text-muted-foreground border border-border overflow-x-auto">
                {counterexample.evidence.matchedPolicies[0]?.clause ||
                  `permit ( principal in Role::"${counterexample.principalRole}", action, resource );`}
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
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                2. Amazon Bedrock Grounded Explanation
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerBedrock}
                disabled={isExplaining}
                className="h-7 text-[11px] border-purple-500/30 text-purple-500 hover:bg-purple-500/10"
              >
                {isExplaining ? "Reasoning..." : "Re-explain with Claude 3.5"}
              </Button>
            </div>

            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardContent className="p-4 space-y-3 text-xs">
                <div>
                  <span className="font-bold text-purple-400 block mb-1">
                    Root Cause Analysis:
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    {bedrockData.rootCause}
                  </p>
                </div>

                <div>
                  <span className="font-bold text-rose-400 block mb-1">
                    Security & Operational Impact:
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    {bedrockData.securityRisk}
                  </p>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-emerald-400">
                      Suggested Cedar Remediation:
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyCode}
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
                  <pre className="p-3 rounded-lg bg-background border border-border font-mono text-[11px] text-emerald-400 overflow-x-auto">
                    {bedrockData.remediationCedar}
                  </pre>
                </div>
              </CardContent>
            </Card>
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
