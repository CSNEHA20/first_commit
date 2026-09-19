import React, { useState } from "react"
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DEPLOYMENT_HISTORY } from "@/fixtures/acmepay"

export const DeploymentScreen: React.FC = () => {
  const [targetEnv, setTargetEnv] = useState<"staging" | "production">("production")
  const [selectedVersion, setSelectedVersion] = useState<"v12" | "v13">("v13")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)

  const isBlocked = selectedVersion === "v13"

  const handleDeploy = () => {
    if (isBlocked) return
    setIsDeploying(true)
    setTimeout(() => {
      setIsDeploying(false)
      setDeploySuccess(true)
      setTimeout(() => setDeploySuccess(false), 3000)
    }, 1200)
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono">
              Target: Amazon Verified Permissions
            </Badge>
            <Badge variant={isBlocked ? "blocked" : "allow"}>
              {isBlocked ? "Gate: ⛔ BLOCKED" : "Gate: 🟢 VERIFIED"}
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Rocket className="h-5 w-5 text-indigo-500" />
            Verified Permissions Deployment Gate
          </h1>
          <p className="text-xs text-muted-foreground">
            Enforcing zero-trust promotion policies before synchronizing Cedar policy sets to AWS policy stores.
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
              v12 (Verified)
            </button>
            <button
              onClick={() => setSelectedVersion("v13")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                selectedVersion === "v13"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              v13 (Draft / Buggy)
            </button>
          </div>
        </div>
      </div>

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
                    Deployment Readiness Passed — Ready for Synchronization
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Candidate Version: <span className="font-mono font-bold text-foreground">{selectedVersion}</span> | Target:{" "}
                <span className="font-mono text-foreground">ps-acmepay-{targetEnv}</span>
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
          {/* Pre-Deployment Checklist */}
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
                <span className="font-medium text-foreground">2. Bounded Scenario Diff Computed (432 cases)</span>
              </div>
              <Badge variant="allow">PASSED</Badge>
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
                <Badge variant="blocked">1 CONTRACT FAILED</Badge>
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
                <Badge variant="blocked">1 CRITICAL ACTIVE</Badge>
              ) : (
                <Badge variant="allow">0 CRITICAL</Badge>
              )}
            </div>
          </div>

          {isBlocked ? (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-start gap-2.5">
              <Lock className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold">Production Deployment Restricted:</span>
                <p className="text-muted-foreground">
                  Contract SC-04 ("Contractors cannot delete payroll reports") failed assertion. Synchronization with Amazon Verified Permissions policy store is blocked by the deterministic gate.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <span className="font-bold">Ready for Production Synchronization:</span>
                <p className="text-muted-foreground">
                  All 18 security contracts and regression assertions evaluated successfully under baseline v12.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-6 pt-0 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2 className="h-4 w-4" />
            <span>Target AWS Policy Store: <code className="text-foreground font-mono">ps-acmepay-{targetEnv}</code></span>
          </div>

          <Button
            onClick={handleDeploy}
            disabled={isBlocked || isDeploying}
            className={`text-xs font-semibold gap-1.5 shadow-md ${
              isBlocked
                ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
            }`}
          >
            {deploySuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Deployed Successfully!
              </>
            ) : isDeploying ? (
              "Deploying to AVP..."
            ) : isBlocked ? (
              <>
                <Lock className="h-3.5 w-3.5" />
                Deployment Blocked
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
            Cryptographically signed deployments recorded in Amazon DynamoDB.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-xs">
            {DEPLOYMENT_HISTORY.map((d) => (
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
