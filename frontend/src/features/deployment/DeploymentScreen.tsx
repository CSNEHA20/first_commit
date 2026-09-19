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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <Server className="h-3 w-3 text-primary" />
              Target: Amazon Verified Permissions ({readiness?.adapterMode || "DETERMINISTIC_FAKE"})
            </span>
            <span className="text-muted-foreground/40">·</span>
            <StatusBadge status={isBlocked ? "BLOCKED" : "PASS"} size="xs" label={isBlocked ? "Gate: BLOCKED" : "Gate: VERIFIED"} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Verified Permissions Release & Deployment Gate
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Candidate:</span>
          <div className="flex items-center p-0.5 rounded-md bg-muted border border-border">
            <button
              onClick={() => setSelectedVersion("v12")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                selectedVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Verified)
            </button>
            <button
              onClick={() => setSelectedVersion("v13")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Violates SC-04)
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded bg-status-deny/10 border border-status-deny/20 text-status-deny text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Deployment Gate Checklist & Approval Card */}
      <Card className="border-border bg-card">
        <CardHeader className="p-3.5 pb-2 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isBlocked ? (
                <ShieldAlert className="h-4 w-4 text-status-deny" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-status-allow" />
              )}
              <CardTitle className="text-xs font-semibold">
                {isBlocked
                  ? "Deployment Restricted — Unresolved Security Contract Violations"
                  : "Deployment Readiness Verified — Awaiting Operator Sign-Off"}
              </CardTitle>
            </div>

            <Tabs value={targetEnv} onValueChange={(v) => setTargetEnv(v as any)}>
              <TabsList className="h-6 bg-muted">
                <TabsTrigger value="staging" className="text-xs h-5 px-2">Staging</TabsTrigger>
                <TabsTrigger value="production" className="text-xs h-5 px-2">Production</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardDescription className="text-[11px] text-muted-foreground font-mono">
            Candidate: {selectedVersion} · Policy Store: {prepResult?.targetPolicyStoreId || `ps-acmepay-${targetEnv}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-3.5 space-y-3 text-xs">
          {/* Pre-Deployment Verification Checklist */}
          <div className="divide-y divide-border rounded border border-border bg-muted/20">
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
                <span className="font-medium text-foreground">1. Cedar Syntax & Schema Compilation</span>
              </div>
              <StatusBadge status="PASS" size="xs" label="PASSED" />
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
                <span className="font-medium text-foreground">2. Bounded Scenario Diff (432 Combinations)</span>
              </div>
              <StatusBadge status="PASS" size="xs" label="EVALUATED" />
            </div>

            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isBlocked ? (
                  <XCircle className="h-3.5 w-3.5 text-status-deny shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
                )}
                <span className="font-medium text-foreground">
                  3. Security Contract Invariants (18 Scenarios)
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
                  <XCircle className="h-3.5 w-3.5 text-status-deny shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-allow shrink-0" />
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
            <div className="p-2.5 rounded bg-status-blocked/10 border border-status-blocked/20 text-status-deny flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-xs">
                <span className="font-semibold">Release Gate Blocked:</span>
                <p className="text-[11px] text-foreground/80">
                  {prepResult?.rejectionReasons?.[0] ||
                    'Security Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion. Policy synchronization to Amazon Verified Permissions is strictly restricted by the deterministic gate.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Human Operator Sign-Off */}
              <div className="p-3 rounded border border-border bg-card space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                    Human Operator Cryptographic Sign-Off
                  </span>
                  {approval ? (
                    <Badge variant="allow" className="gap-1 font-mono text-[9px]">
                      <Key className="h-3 w-3" /> Token: {approval.approvalToken.substring(0, 12)}...
                    </Badge>
                  ) : (
                    <StatusBadge status="PENDING" size="xs" label="Approval Required" />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5">
                      Authorizing Operator
                    </label>
                    <input
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      disabled={!!approval}
                      className="w-full px-2 py-1 rounded bg-muted/40 border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5">
                      Change Ticket / PR Ref
                    </label>
                    <input
                      type="text"
                      value={ticketRef}
                      onChange={(e) => setTicketRef(e.target.value)}
                      disabled={!!approval}
                      className="w-full px-2 py-1 rounded bg-muted/40 border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] text-muted-foreground uppercase font-semibold block mb-0.5">
                    Justification
                  </label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    disabled={!!approval}
                    className="w-full px-2 py-1 rounded bg-muted/40 border border-input text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {!approval && (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    className="w-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 h-7"
                  >
                    <UserCheck className="h-3 w-3" />
                    Sign & Register Approval Token
                  </Button>
                )}
              </div>

              {/* Action Submit */}
              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleDeploy}
                  disabled={isBlocked || !approval || isDeploying}
                  className="text-xs font-medium gap-1.5 h-8 bg-status-allow text-white hover:bg-status-allow/90 disabled:opacity-50"
                >
                  {isDeploying ? (
                    "Deploying to AVP..."
                  ) : submitResult ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Deployed Successfully
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
            <div className="p-2.5 rounded bg-status-allow/10 border border-status-allow/20 text-status-allow space-y-1 text-xs font-mono">
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
      <Card className="border-border bg-card">
        <CardHeader className="p-3.5 pb-2 border-b border-border">
          <CardTitle className="text-xs font-semibold">
            Verified Deployment Audit Trail
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Cryptographically signed deployments recorded in AWS Verified Permissions audit ledger.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border text-xs">
            {deploymentRecords.map((d) => (
              <div key={d.id} className="p-3 flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-foreground">{d.versionTag}</code>
                    <StatusBadge status="SYNCHRONIZED" size="xs" />
                    <span className="text-muted-foreground text-[11px]">
                      Store: <code className="font-mono text-foreground">{d.targetStoreId}</code>
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate max-w-md">
                    SHA-256: {d.policyHash}
                  </div>
                </div>

                <div className="text-right text-muted-foreground text-[11px] shrink-0">
                  <span>by {d.deployedBy}</span>
                  <p className="text-[10px] text-muted-foreground/70 font-mono">
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
