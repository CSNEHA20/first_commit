/**
 * Local CLI Connector Card
 * Status: NOT YET IMPLEMENTED
 *
 * Documents the future local project connector. Browser filesystem access
 * is NOT used -- a CLI tool would be required.
 */

import React from "react"
import { Terminal, AlertTriangle, FolderOpen } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const LocalConnector: React.FC = () => {
  return (
    <Card className="glass-card-premium rounded-2xl border border-white/[0.08] opacity-60">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          Local Project (CLI)
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            NOT YET IMPLEMENTED
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-2 space-y-2.5 text-xs text-muted-foreground">
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Local project connector is not yet implemented. Browser filesystem access
            is not used. A future CLI tool would handle local Cedar file discovery.
          </span>
        </div>
        <div className="space-y-1.5 text-[11px]">
          <p className="font-semibold text-foreground/70">Planned CLI workflow:</p>
          <div className="p-2 rounded bg-black/40 border border-white/[0.06] font-mono text-[10px] text-emerald-400">
            <p>policylab verify \</p>
            <p className="ml-4">--policy ./authz/policy.cedar \</p>
            <p className="ml-4">--baseline ./authz/baseline.cedar \</p>
            <p className="ml-4">--schema ./authz/schema.json \</p>
            <p className="ml-4">--scenarios ./tests/scenarios.json</p>
          </div>
          <ul className="list-disc list-inside space-y-0.5 ml-1 mt-1">
            <li>Discovers Cedar policy and schema files in your project directory</li>
            <li>Only uploads selected authorization artifacts, not full source code</li>
            <li>Outputs machine-readable JSON for CI/CD integration</li>
          </ul>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60">
          <FolderOpen className="h-3 w-3" />
          Use "Manual Import" above to paste policy text in the meantime.
        </div>
      </CardContent>
    </Card>
  )
}
