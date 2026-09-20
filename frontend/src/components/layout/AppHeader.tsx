import React from "react"
import {
  Sun,
  Moon,
  Download,
  Shield,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserSessionBadge } from "@/components/common/UserSessionBadge"
import { useTheme } from "@/theme/ThemeProvider"

interface AppHeaderProps {
  activeProject?: string
  activeVersion?: string
  candidateVersion?: string
  gateStatus?: "PASS" | "BLOCKED" | "INCOMPLETE"
  environment?: "Production" | "Staging"
  /** Mode badge: 'demo' shows orange DEMO label, 'connected' shows sky CONNECTED label */
  workspaceMode?: "demo" | "connected"
  /** Callback to open the workspace switcher */
  onSwitchWorkspace?: () => void
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeProject = "AcmePay-Core-Authz",
  activeVersion = "v12",
  candidateVersion = "v13",
  gateStatus = "BLOCKED",
  environment = "Production",
  workspaceMode = "demo",
  onSwitchWorkspace,
}) => {
  const { theme, toggleTheme } = useTheme()

  const handleExportEvidence = () => {
    const data = {
      project: activeProject,
      environment,
      baseline: activeVersion,
      candidate: candidateVersion,
      gateStatus,
      timestamp: new Date().toISOString(),
      contractsViolated: ["SC-04", "SC-05", "SC-03"],
      boundedUniverse: 432,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `policylab-evidence-${candidateVersion}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <header className="border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md text-foreground sticky top-0 z-40 h-12 px-4 flex items-center justify-between transition-colors select-none">
      {/* Left: Workbench Identifier & Project Context */}
      <div className="flex items-center gap-2 text-xs">
        {/* Monogram / Logotype */}
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_10px_rgba(255,106,36,0.4)]">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-foreground text-xs hidden sm:inline">
            PolicyLab
          </span>
        </div>

        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />

        {/* Project Name — clickable to switch workspace */}
        <button
          onClick={onSwitchWorkspace}
          disabled={!onSwitchWorkspace}
          className="text-foreground font-medium hidden sm:inline text-xs hover:text-orange-400 transition-colors disabled:cursor-default"
          title={onSwitchWorkspace ? "Switch workspace" : undefined}
        >
          {activeProject}
        </button>

        {/* Workspace Mode Badge */}
        {workspaceMode === "demo" ? (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            DEMO
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            CONNECTED
          </span>
        )}

        <ChevronRight className="h-3 w-3 text-muted-foreground/40 hidden md:inline" />

        {/* Environment Tag */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#18B868]" />
            {environment}
          </span>
        </div>

        <span className="text-muted-foreground/40 hidden lg:inline">·</span>

        {/* Versions Context */}
        <div className="hidden lg:flex items-center gap-2 text-muted-foreground text-[11px] font-mono">
          <span>Baseline: <strong className="text-foreground">{activeVersion}</strong></span>
          <span className="text-muted-foreground/40">➔</span>
          <span>Review: <strong className="text-red-400">{candidateVersion} (Draft)</strong></span>
        </div>
      </div>

      {/* Right: Gate Status & Controls */}
      <div className="flex items-center gap-2.5">
        {/* Contextual Pre-deployment Gate Indicator */}
        <div className="flex items-center gap-1.5">
          <StatusBadge
            status={gateStatus}
            label={`Gate: ${gateStatus} (SC-04)`}
            size="sm"
          />
        </div>

        {/* User Identity / Emulated Role Badge */}
        <UserSessionBadge />

        {/* Export Evidence Action (Inspired by Ref Images) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportEvidence}
          className="h-7 text-xs gap-1.5 border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-foreground hidden sm:flex"
        >
          <Download className="h-3 w-3 text-orange-400" />
          <span>Export</span>
        </Button>

        <div className="h-3.5 w-[1px] bg-white/[0.1]" />

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
          title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
        >
          {theme === "light" ? (
            <Moon className="h-3.5 w-3.5" />
          ) : (
            <Sun className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </header>
  )
}
