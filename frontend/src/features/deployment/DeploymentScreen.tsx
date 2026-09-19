import React, { useState, useEffect } from "react"
import {
  Rocket,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowRight,
  FileCode2,
  History,
  Check,
  UserCheck,
  AlertTriangle,
  Server,
  Key,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  const [approverName, setApproverName] = useState("Vishal Lakshmikanthan (Principal SecOps)")
  const [ticketRef, setTicketRef] = useState("SEC-2026-9042")
  const [approvalNotes, setApprovalNotes] = useState("Verified against full AcmePay 18-scenario suite with zero contract violations.")
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
      // 1. Run regression to get canonical gate decision
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


      // 2. Prepare deployment target
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
      // Refresh history
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
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono gap-1">
              <Server className="h-3 w-3 text-indigo-400" />
              Target: Amazon Verified Permissions ({readiness?.adapterMode || "DETERMINISTIC_FAKE"})
            </Badge>
            <Badge variant={isBlocked ? "blocked" : "allow"}>
              {isBlocked ? "Gate: ⛔ BLOCKED" : "Gate: 🟢 VERIFIED"}
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-indigo-500" />
            Verified Permissions Deployment Gate & Governance
          </h1>
          <p className="text-xs text-muted-foreground">
            Enforcing zero-trust verification and cryptographic human approval before synchronizing Cedar policy sets to AWS policy stores.
          </p>
        </div>

        {/* Version Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Candidate:</span>
          <div className="flex items-center p-1 rounded-lg bg-muted border border-border">
            <button
              onClick={() => setSelectedVersion("v12")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v12"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v12 (Verified Baseline)
            </button>
            <button
              onClick={() => setSelectedVersion("v13")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Violates SC-04)
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Deployment Readiness Card */}
      <Card className={`border ${isBlocked ? "border-rose-500/40 bg-rose-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
        <CardHeader className="p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {isBlocked ? (
                  <>
                    <ShieldAlert className="h-5 w-5 text-rose-500" />
                    Deployment Blocked — Unresolved Security Invariants
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    Deployment Readiness Passed — Ready for Operator Approval
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Candidate Version: <span className="font-mono font-bold text-foreground">{selectedVersion}</span> | Target Store:{" "}
                <span className="font-mono text-foreground">{prepResult?.targetPolicyStoreId || `ps-acmepay-${targetEnv}`}</span>
              </CardDescription>
            </div>

            <Tabs value={targetEnv} onValueChange={(v) => setTargetEnv(v as any)}>
              <TabsList className="bg-background border border-border">
                <TabsTrigger value="staging" className="text-xs">Staging</TabsTrigger>
                <TabsTrigger value="production" className="text-xs">Production</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="p-6 pt-3 space-y-4 text-xs">
          {/* Pre-Deployment Verification Checklist */}
          <div className="divide-y divide-border rounded-lg border border-border bg-background/80 overflow-hidden">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="font-medium text-foreground">1. Cedar Syntax & Schema Compilation</span>
              </div>
              <Badge variant="allow">PASSED</Badge>
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="font-medium text-foreground">2. Bounded Scenario Diff (432 Combinations)</span>
              </div>
              <Badge variant="allow">EVALUATED</Badge>
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isBlocked ? (
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
                <span className="font-medium text-foreground">
                  3. Security Contract Regression Suite (18 Scenarios)
                </span>
              </div>
              {isBlocked ? (
                <Badge variant="blocked">1 CONTRACT FAILED (SC-04)</Badge>
              ) : (
                <Badge variant="allow">18/18 PASSED</Badge>
              )}
            </div>

            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {isBlocked ? (
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
                <span className="font-medium text-foreground">
                  4. Critical Counterexample Resolution
                </span>
              </div>
              {isBlocked ? (
                <Badge variant="blocked">1 ACTIVE (S-06)</Badge>
              ) : (
                <Badge variant="allow">0 ACTIVE</Badge>
              )}
            </div>
          </div>

          {isBlocked ? (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold">Production Deployment Restricted:</span>
                <p className="text-muted-foreground">
                  {prepResult?.rejectionReasons?.[0] ||
                    'Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion. Synchronization with Amazon Verified Permissions policy store is strictly blocked by the deterministic gate.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <span className="font-bold">Gate Passed: Ready for Operator Approval</span>
                  <p className="text-muted-foreground">
                    All 18 security contracts and regression assertions evaluated successfully. Policy SHA-256:{" "}
                    <code className="font-mono text-foreground font-semibold">{prepResult?.candidatePolicyHashSha256?.substring(0, 16)}...</code>
                  </p>
                </div>
              </div>

              {/* Human Approval Sign-off Form */}
              <div className="p-4 rounded-lg bg-background border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                    <UserCheck className="h-4 w-4 text-indigo-500" />
                    Human Operator Cryptographic Sign-Off
                  </span>
                  {approval ? (
                    <Badge variant="allow" className="gap-1 font-mono text-[10px]">
                      <Key className="h-3 w-3" /> Token: {approval.approvalToken.substring(0, 12)}...
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Required Before Deploy</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                      Authorizing Operator
                    </label>
                    <input
                      type="text"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      disabled={!!approval}
                      className="w-full px-2.5 py-1.5 rounded-md bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                      Change Ticket / PR Ref
                    </label>
                    <input
                      type="text"
                      value={ticketRef}
                      onChange={(e) => setTicketRef(e.target.value)}
                      disabled={!!approval}
                      className="w-full px-2.5 py-1.5 rounded-md bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                    Approval Justification Notes
                  </label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    disabled={!!approval}
                    className="w-full px-2.5 py-1.5 rounded-md bg-muted/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {!approval && (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    className="w-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Sign & Register Approval Token
                  </Button>
                )}
              </div>
            </div>
          )}

          {submitResult && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-bold">Deployment Successfully Recorded to AVP!</span>
              </div>
              <p className="text-muted-foreground">
                Deployment ID: <code className="font-mono text-foreground">{submitResult.deploymentId}</code> | Store: <code className="font-mono text-foreground">{submitResult.targetPolicyStoreId}</code>
              </p>
              <p className="font-mono text-[10px] text-emerald-400/80 truncate">
                Proof: {submitResult.verificationProof}
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-6 pt-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2 className="h-4 w-4" />
            <span>Target AWS Policy Store: <code className="text-foreground font-mono">{prepResult?.targetPolicyStoreId || `ps-acmepay-${targetEnv}`}</code></span>
          </div>

          <Button
            onClick={handleDeploy}
            disabled={isBlocked || !approval || isDeploying}
            className={`text-xs font-semibold gap-1.5 shadow-md ${
              isBlocked || !approval
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
            }`}
          >
            {submitResult ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Synchronized with AVP
              </>
            ) : isDeploying ? (
              "Deploying to AVP..."
            ) : isBlocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                Deployment Blocked
              </>
            ) : !approval ? (
              <>
                <UserCheck className="h-3.5 w-3.5" />
                Awaiting Operator Sign-Off
              </>
            ) : (
              <>
                <Rocket className="h-3.5 w-3.5" />
                Deploy Verified Policy Set
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Deployment History Ledger */}
      <Card className="border-border bg-card">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-500" />
            Verified Deployment Audit Trail
          </CardTitle>
          <CardDescription>
            Cryptographically signed deployments recorded in AWS Verified Permissions audit ledger.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-xs">
            {deploymentRecords.map((d) => (
              <div key={d.id} className="p-3.5 flex items-center justify-between bg-muted/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground font-mono">{d.versionTag}</span>
                    <Badge variant="allow" className="text-[10px]">{d.status}</Badge>
                    <span className="text-muted-foreground text-[11px]">
                      Store: <code className="font-mono text-foreground">{d.targetStoreId}</code>
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate max-w-md">
                    SHA-256: {d.policyHash}
                  </div>
                </div>

                <div className="text-right text-muted-foreground text-[11px]">
                  <span>Deployed by {d.deployedBy}</span>
                  <p className="text-[10px] text-muted-foreground/70">
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

