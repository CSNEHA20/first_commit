/**
 * AWS Verified Permissions Connector Card
 *
 * Calls the existing /deployment/readiness endpoint and displays the
 * ACTUAL connection status. Because AVP subscription is not active for
 * the current IAM user, this will show LOCAL_MOCKED -- never CONNECTED.
 *
 * Status will show CONNECTED only when a real API request actually succeeds.
 */

import React, { useState } from "react"
import { Cloud, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getAVPReadiness } from "@/lib/api"

type ConnectionState =
  | "NOT_CONFIGURED"
  | "CONNECTING"
  | "LOCAL_MOCKED"
  | "CONNECTED"
  | "ACCESS_DENIED"
  | "ERROR"
  | "UNAVAILABLE"

interface AVPStatus {
  state: ConnectionState
  details: string
  adapterMode?: string
  region?: string
  storeId?: string
}

export const AVPConnector: React.FC = () => {
  const [status, setStatus] = useState<AVPStatus>({
    state: "NOT_CONFIGURED",
    details: "Not yet probed. Click \"Check Connection\" to query the backend.",
  })

  const handleCheckConnection = async () => {
    setStatus({ state: "CONNECTING", details: "Probing AVP readiness endpoint..." })
    try {
      const res = await getAVPReadiness()
      const firstStoreId = Object.values(res.configuredPolicyStores || {})[0]
      // Truthfully report adapter mode from backend
      if (res.adapterMode === "DETERMINISTIC_FAKE") {
        setStatus({
          state: "LOCAL_MOCKED",
          details: "Local deterministic AVP simulation adapter active. No live AWS credentials configured.",
          adapterMode: res.adapterMode,
          region: res.awsRegion || undefined,
          storeId: firstStoreId,
        })
      } else if (res.isReadyForDeployment && res.adapterMode === "LIVE_BOTO3") {
        setStatus({
          state: "CONNECTED",
          details: `Connected to Amazon Verified Permissions in ${res.awsRegion || "configured region"}.`,
          adapterMode: res.adapterMode,
          region: res.awsRegion || undefined,
          storeId: firstStoreId,
        })
      } else {
        setStatus({
          state: "ERROR",
          details: res.missingRequirements?.join(", ") || "AVP requirements not satisfied.",
          adapterMode: res.adapterMode,
          region: res.awsRegion || undefined,
        })
      }
    } catch (err: any) {
      const msg = err.message || "AVP readiness check failed"
      if (msg.includes("AccessDenied") || msg.includes("403")) {
        setStatus({ state: "ACCESS_DENIED", details: msg })
      } else if (msg.includes("401")) {
        setStatus({ state: "ACCESS_DENIED", details: "Authentication required." })
      } else {
        setStatus({ state: "ERROR", details: msg })
      }
    }
  }

  const stateConfig: Record<ConnectionState, { icon: React.ReactNode; color: string; label: string }> = {
    NOT_CONFIGURED: { icon: <Cloud className="h-3.5 w-3.5" />, color: "text-muted-foreground", label: "Not Configured" },
    CONNECTING: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: "text-blue-400", label: "Connecting..." },
    LOCAL_MOCKED: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-amber-400", label: "LOCAL_MOCKED" },
    CONNECTED: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-400", label: "Connected" },
    ACCESS_DENIED: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-400", label: "Access Denied" },
    ERROR: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-400", label: "Error" },
    UNAVAILABLE: { icon: <XCircle className="h-3.5 w-3.5" />, color: "text-red-400", label: "Unavailable" },
  }

  const cfg = stateConfig[status.state]

  return (
    <Card className="glass-card-premium rounded-2xl border border-white/[0.08]">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Cloud className="h-4 w-4 text-sky-400" />
          Amazon Verified Permissions
          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${cfg.color} bg-current/10 border border-current/20`}>
            {cfg.icon}
            {cfg.label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-3 text-xs">
        <p className="text-muted-foreground text-[11px]">{status.details}</p>

        {status.state === "LOCAL_MOCKED" && (
          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-300 space-y-1">
            <p className="font-semibold">Known Blocker</p>
            <p className="text-muted-foreground">
              AVP subscription is not active for the current IAM user (vishal,
              arn:aws:iam::583365238271:user/vishal). Live probe returned:
              AccessDeniedException: The AWS Access Key Id needs a subscription
              for the service.
            </p>
            <p className="text-muted-foreground">
              To enable: Subscribe to Amazon Verified Permissions in the AWS
              Console, create a policy store, and set AWS_AVP_ENABLED=true +
              AVP_POLICY_STORE_ID in the backend environment.
            </p>
          </div>
        )}

        {(status.region || status.storeId) && (
          <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
            {status.region && <p>Region: {status.region}</p>}
            {status.storeId && <p>Store ID: {status.storeId}</p>}
            {status.adapterMode && <p>Adapter: {status.adapterMode}</p>}
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={handleCheckConnection}
          disabled={status.state === "CONNECTING"}
          className="w-full h-8 text-xs border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
        >
          {status.state === "CONNECTING" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              Checking...
            </>
          ) : (
            "Check Connection"
          )}
        </Button>

        <p className="text-[10px] text-muted-foreground/50 font-mono">
          CONNECTED status is only shown when a real AVP request succeeds.
          No credentials are collected here.
        </p>
      </CardContent>
    </Card>
  )
}
