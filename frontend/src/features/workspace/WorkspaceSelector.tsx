/**
 * PolicyLab Workspace Selector
 *
 * Shown when no workspace is active (app first load or after switching workspaces).
 * Allows the engineer to:
 *   - Enter the AcmePay Demo workspace (fixture-based, clearly labeled)
 *   - Create a new Connected Workspace (engineer supplies their own Cedar artifacts)
 *   - Return to a previously created Connected Workspace (session-local)
 *   - View connector status for GitHub, Local CLI, and AVP (all labeled NOT YET IMPLEMENTED or LOCAL_MOCKED)
 */

import React, { useState } from "react"
import {
  Shield,
  Plus,
  ChevronRight,
  FlaskConical,
  Layers,
  Trash2,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Workspace, useWorkspace, DEMO_WORKSPACE } from "@/store/workspaceStore"
import { ConnectedWorkspaceSetup } from "./ConnectedWorkspaceSetup"
import { GitHubConnector } from "./connectors/GitHubConnector"
import { LocalConnector } from "./connectors/LocalConnector"
import { AVPConnector } from "./connectors/AVPConnector"

export const WorkspaceSelector: React.FC = () => {
  const { state, dispatch } = useWorkspace()
  const [showSetup, setShowSetup] = useState(false)
  const [showConnectors, setShowConnectors] = useState(false)

  const connectedWorkspaces = state.workspaces.filter((w) => w.mode === "connected")

  if (showSetup) {
    return (
      <ConnectedWorkspaceSetup
        onCancel={() => setShowSetup(false)}
        onComplete={(ws) => {
          dispatch({ type: "CREATE_WORKSPACE", workspace: ws })
          setShowSetup(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#090A0D] flex items-start justify-center pt-16 px-4">
      {/* Atmospheric Layers */}
      <div className="fixed top-0 inset-x-0 h-[520px] cyber-aurora-top pointer-events-none z-0" />
      <div className="fixed top-[-100px] right-[-100px] h-[650px] w-[650px] cyber-aurora-corner pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-3xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(255,106,36,0.4)]">
              <Shield className="h-7 w-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">PolicyLab</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cedar authorization verification workspace
            </p>
          </div>
        </div>

        {/* Demo Workspace Card */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono mb-2 px-1">
            Demo Workspace
          </p>
          <button
            onClick={() => dispatch({ type: "SELECT_WORKSPACE", id: DEMO_WORKSPACE.id })}
            className="w-full text-left"
          >
            <Card className="glass-card-premium rounded-2xl border border-orange-500/20 hover:border-orange-500/40 transition-all hover:shadow-[0_0_20px_rgba(255,106,36,0.1)] cursor-pointer group">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0">
                  <FlaskConical className="h-5 w-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">AcmePay Demo</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      DEMO
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-muted-foreground border border-white/10">
                      FIXTURE DATA
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AcmePay authorization benchmark  v12 (baseline) vs v13 (candidate)  Local Cedar WASM simulation
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-400 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </button>
        </div>

        {/* Connected Workspaces */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Connected Workspaces
              <span className="ml-1.5 text-muted-foreground/50">(Local Session)</span>
            </p>
            <Button
              size="sm"
              onClick={() => setShowSetup(true)}
              className="h-7 text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              New Workspace
            </Button>
          </div>

          {connectedWorkspaces.length === 0 ? (
            <Card className="glass-card-premium rounded-2xl border border-white/[0.08]">
              <CardContent className="p-6 text-center space-y-2">
                <Layers className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">No connected workspaces yet</p>
                <p className="text-xs text-muted-foreground/60">
                  Create a workspace to work with your own Cedar policies, schema, and scenarios.
                  <br />
                  <span className="font-mono text-[10px]">Scope: Local session  localStorage</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSetup(true)}
                  className="mt-2 text-xs border-white/[0.12] hover:bg-white/[0.05]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create Connected Workspace
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {connectedWorkspaces.map((ws: Workspace) => (
                <div key={ws.id} className="flex items-center gap-2">
                  <button
                    onClick={() => dispatch({ type: "SELECT_WORKSPACE", id: ws.id })}
                    className="flex-1 text-left"
                  >
                    <Card className="glass-card-premium rounded-2xl border border-white/[0.08] hover:border-white/[0.15] transition-all cursor-pointer group">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-9 w-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                          <Layers className="h-4.5 w-4.5 text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">{ws.name}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
                              CONNECTED
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 text-muted-foreground border border-white/10 shrink-0">
                              LOCAL SESSION
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                            <span className="text-[11px] text-muted-foreground">
                              Created {new Date(ws.createdAt).toLocaleString()}
                            </span>
                            {ws.connected?.scenarios.length ? (
                              <span className="text-[11px] text-muted-foreground">
                                 {ws.connected.scenarios.length} scenario{ws.connected.scenarios.length !== 1 ? "s" : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                      </CardContent>
                    </Card>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    title="Delete workspace"
                    onClick={() => dispatch({ type: "DELETE_WORKSPACE", id: ws.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* External Connectors Section */}
        <div>
          <button
            onClick={() => setShowConnectors((v) => !v)}
            className="w-full flex items-center justify-between px-1 mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono hover:text-foreground transition-colors"
          >
            <span>External Connectors (Future Milestones)</span>
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showConnectors ? "rotate-90" : ""}`} />
          </button>
          {showConnectors && (
            <div className="space-y-3">
              <GitHubConnector />
              <LocalConnector />
              <AVPConnector />
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 font-mono pb-8">
          PolicyLab  Cedar WASM 4.13.0  Local Session  No cloud charges incurred
        </p>
      </div>
    </div>
  )
}
