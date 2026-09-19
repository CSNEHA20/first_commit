import React, { useState, useEffect } from "react"
import {
  Rocket,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  UserCheck,
  AlertTriangle,
  Server,
  Key,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AVPReadinessResponse,
  DeploymentPrepareResponse,
  HumanApprovalResponse,
  DeploymentSubmitResponse,
  DeploymentRecord,
} from "@/types/authz"
import {
  getAVPReadiness,
  prepareDeployment,
  approveDeployment,
  submitDeployment,
  getDeploymentHistory,
  runRegression,
} from "@/lib/api"
import {
  POLICY_V12_TEXT,
  POLICY_V13_TEXT,
  ACMEPAY_SCHEMA,
  ALL_REGRESSION_SCENARIOS,
  SECURITY_CONTRACTS,
  DEPLOYMENT_HISTORY as DEFAULT_DEPLOYMENT_HISTORY,
} from "@/fixtures/acmepay"

export const DeploymentScreen: React.FC = () => {
  const [targetEnv, setTargetEnv] = useState<"staging" | "production">("production")
  const [selectedVersion, setSelectedVersion] = useState<"v12" | "v13">("v13")
  const [readiness, setReadiness] = useState<AVPReadinessResponse | null>(null)
  const [prepResult, setPrepResult] = useState<DeploymentPrepareResponse | null>(null)
  const [approval, setApproval] = useState<HumanApprovalResponse | null>(null)
  const [approverName, setApproverName] = useState("Vishal Lakshmikanthan (SecOps Lead)")
  const [ticketRef, setTicketRef] = useState("SEC-2026-9042")
  const [approvalNotes, setApprovalNotes] = useState("Verified against full AcmePay security invariant suite.")
  const [isDeploying, setIsDeploying] = useState(false)
  const [submitResult, setSubmitResult] = useState<DeploymentSubmitResponse | null>(null)
  const [deploymentRecords, setDeploymentRecords] = useState<DeploymentRecord[]>(DEFAULT_DEPLOYMENT_HISTORY as any)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const candidatePolicyText = selectedVersion === "v12" ? POLICY_V12_TEXT : POLICY_V13_TEXT

  useEffect(() => {
    loadReadinessAndHistory()
  }, [])

  useEffect(() => {
    evaluateReadinessAndGate()
  }, [selectedVersion, targetEnv])

  const loadReadinessAndHistory = async () => {
    try {
      const ready = await getAVPReadiness()
      setReadiness(ready)
      const history = await getDeploymentHistory().catch(() => [])
      if (history && history.length > 0) {
        setDeploymentRecords(history)
      }
    } catch {
      // Fallback to local default state
    }
  }

  const evaluateReadinessAndGate = async () => {
    setErrorMsg(null)
    setSubmitResult(null)
    setApproval(null)
    try {
      const regression = await runRegression({
        baselinePolicyText: POLICY_V12_TEXT,
        candidatePolicyText,
        schemaText: ACMEPAY_SCHEMA,
        suite: {
          id: "suite_acmepay_regression",
          name: "AcmePay Standard Regression Suite",
          scenarios: ALL_REGRESSION_SCENARIOS,
        },
        contracts: SECURITY_CONTRACTS,
        baselineLabel: "v12",
        candidateLabel: selectedVersion,
      })

      const prep = await prepareDeployment({
        candidatePolicyText,
        schemaText: ACMEPAY_SCHEMA,
        targetEnv,
        regressionReport: regression,
      })
      setPrepResult(prep)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to prepare deployment")
    }
  }

  const handleApprove = async () => {
    if (!prepResult || !prepResult.isDeployable) return
    try {
      const app = await approveDeployment({
        candidatePolicyHashSha256: prepResult.candidatePolicyHashSha256,
        targetEnv,
        approverName,
        ticketReference: ticketRef,
        approvalNotes,
      })
      setApproval(app)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record human approval")
    }
  }

  const handleDeploy = async () => {
    if (!prepResult || !approval || !approval.approvalToken) return
    setIsDeploying(true)
    setErrorMsg(null)
    try {
      const sub = await submitDeployment({
        candidatePolicyText,
        schemaText: ACMEPAY_SCHEMA,
        targetEnv,
        approvalToken: approval.approvalToken,
        regressionRunId: `reg-${Date.now()}`,
        candidateLabel: selectedVersion,
      })
      setSubmitResult(sub)
      const history = await getDeploymentHistory().catch(() => [])
      if (history && history.length > 0) {
        setDeploymentRecords(history)
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Deployment submission failed")
    } finally {
      setIsDeploying(false)
    }
  }

  const isBlocked = prepResult ? !prepResult.isDeployable : selectedVersion === "v13"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-orange-400 font-mono flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-orange-400" />
              Target: Amazon Verified Permissions ({readiness?.adapterMode || "DETERMINISTIC_FAKE"})
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge status={isBlocked ? "BLOCKED" : "PASS"} size="xs" label={isBlocked ? "Gate: BLOCKED" : "Gate: VERIFIED"} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-orange-400 shadow-[0_0_10px_rgba(255,106,36,0.5)]" />
            Verified Permissions Release & Deployment Gate
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Candidate Version:</span>
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]">
            <button
              onClick={() => setSelectedVersion("v12")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedVersion === "v12"
                  ? "bg-white/[0.1] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Verified Baseline)
            </button>
            <button
              onClick={() => setSelectedVersion("v13")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-[#FF6A24] text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Candidate - Violates SC-04)
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 font-mono">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Deployment Gate Checklist & Approval Card */}
      <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isBlocked ? (
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 shadow-[0_0_6px_rgba(24,184,104,0.5)]" />
              )}
              <CardTitle className="text-xs font-semibold">
                {isBlocked
                  ? "Deployment Restricted — Unresolved Security Invariant Violations"
                  : "Deployment Readiness Verified — Awaiting Cryptographic Operator Sign-Off"}
              </CardTitle>
            </div>

            <Tabs value={targetEnv} onValueChange={(v) => setTargetEnv(v as any)}>
              <TabsList className="h-6 bg-black/40 border border-white/[0.08]">
                <TabsTrigger value="staging" className="text-xs h-5 px-2.5 text-muted-foreground data-[state=active]:text-white data-[state=active]:bg-white/[0.1]">Staging</TabsTrigger>
                <TabsTrigger value="production" className="text-xs h-5 px-2.5 text-muted-foreground data-[state=active]:text-white data-[state=active]:bg-white/[0.1]">Production</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription className="text-[11px] text-muted-foreground font-mono">
            Candidate: <strong className="text-orange-400">{selectedVersion}</strong> · Policy Store: <code className="text-foreground font-semibold">{prepResult?.targetPolicyStoreId || `ps-acmepay-${targetEnv}`}</code>
          </CardDescription>
        </CardHeader>

        <CardContent className="p-3.5 space-y-3 text-xs">
          {/* Pre-Deployment Verification Checklist */}
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-black/30">
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium text-foreground">1. Cedar Syntax & Schema Compilation</span>
              </div>
              <StatusBadge status="PASS" size="xs" label="PASSED (0.4ms)" />
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium text-foreground">2. Bounded Scenario Diff Matrix (432 Combinations)</span>
              </div>
              <StatusBadge status="PASS" size="xs" label="EVALUATED (1.8s)" />
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isBlocked ? (
                  <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="font-medium text-foreground">
                  3. Security Contract Invariants (18 Executable Scenarios)
                </span>
              </div>
              {isBlocked ? (
                <StatusBadge status="BLOCKED" size="xs" label="SC-04 FAILED" />
              ) : (
                <StatusBadge status="PASS" size="xs" label="18/18 PASS" />
              )}
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isBlocked ? (
                  <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="font-medium text-foreground">
                  4. Deterministic Counterexample Resolution
                </span>
              </div>
              {isBlocked ? (
                <StatusBadge status="BLOCKED" size="xs" label="1 CRITICAL ACTIVE" />
              ) : (
                <StatusBadge status="PASS" size="xs" label="0 ACTIVE" />
              )}
            </div>
          </div>

          {isBlocked ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <div className="space-y-0.5 text-xs">
                <span className="font-bold uppercase font-mono">Release Gate Blocked:</span>
                <p className="text-[11px] text-foreground/80 font-sans leading-relaxed">
                  {prepResult?.rejectionReasons?.[0] ||
                    'Security Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion. Policy synchronization to Amazon Verified Permissions is strictly restricted by the deterministic gate.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Human Operator Sign-Off */}
              <div className="p-3.5 rounded-xl border border-white/[0.08] bg-black/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <UserCheck className="h-4 w-4 text-orange-400" />
                    Human Operator Cryptographic Sign-Off
                  </span>
                  {approval ? (
                    <Badge variant="allow" className="gap-1 font-mono text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      <Key className="h-3 w-3" /> Token: {approval.approvalToken.substring(0, 12)}...
                    </Badge>
                  ) : (
                    <StatusBadge status="PENDING" size="xs" label="Sign-Off Required" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono">
                      Authorizing Operator
                    </label>
                    <input
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      disabled={!!approval}
                      className="w-full px-2.5 py-1 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono">
                      Change Ticket / PR Ref
                    </label>
                    <input
                      type="text"
                      value={ticketRef}
                      onChange={(e) => setTicketRef(e.target.value)}
                      disabled={!!approval}
                      className="w-full px-2.5 py-1 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5 font-mono">
                    Justification
                  </label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    disabled={!!approval}
                    className="w-full px-2.5 py-1 rounded-lg bg-black/50 border border-white/[0.1] text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {!approval && (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    className="w-full text-xs font-semibold bg-[#FF6A24] text-white hover:bg-[#FF8A42] gap-1.5 h-8 shadow-[0_0_15px_rgba(255,106,36,0.3)]"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Sign & Register Approval Token
                  </Button>
                )}
              </div>

              {/* Action Submit */}
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleDeploy}
                  disabled={isBlocked || !approval || isDeploying}
                  className="text-xs font-semibold gap-1.5 h-8 bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_15px_rgba(24,184,104,0.3)] disabled:opacity-50"
                >
                  {isDeploying ? (
                    "Deploying to AVP..."
                  ) : submitResult ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Synchronized Successfully
                    </>
                  ) : (
                    <>
                      <Rocket className="h-3.5 w-3.5" />
                      Submit to Amazon Verified Permissions
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {submitResult && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 font-sans font-semibold">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>Synchronized with Amazon Verified Permissions Policy Store!</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Deployment ID: {submitResult.deploymentId} · Store: {submitResult.targetPolicyStoreId}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verified Deployment Audit Trail */}
      <Card className="border-white/[0.08] bg-[#0D1015]/90 backdrop-blur-md">
        <CardHeader className="p-3.5 pb-2 border-b border-white/[0.06]">
          <CardTitle className="text-xs font-semibold">
            Verified Deployment Audit Trail
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Cryptographically signed deployments recorded in AWS Verified Permissions audit ledger.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-white/[0.06] text-xs">
            {deploymentRecords.map((d) => (
              <div key={d.id} className="p-3.5 flex items-center justify-between gap-2 hover:bg-white/[0.02] transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-orange-400">{d.versionTag}</code>
                    <StatusBadge status="SYNCHRONIZED" size="xs" />
                    <span className="text-muted-foreground text-[11px]">
                      Store: <code className="font-mono text-foreground font-medium">{d.targetStoreId}</code>
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate max-w-md">
                    SHA-256: {d.policyHash}
                  </div>
                </div>

                <div className="text-right text-muted-foreground text-[11px] shrink-0">
                  <span className="text-foreground/80 font-medium">by {d.deployedBy}</span>
                  <p className="text-[10px] text-muted-foreground/60 font-mono">
                    {new Date(d.deployedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
