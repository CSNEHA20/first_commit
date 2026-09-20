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
    <header className="border-b border-border bg-card/80 backdrop-blur-md text-foreground sticky top-0 z-40 h-12 px-4 flex items-center justify-between gap-4 transition-colors select-none">
      {/* Left: Workbench Identifier & Project Context */}
      <div className="flex items-center gap-2 text-xs min-w-0 shrink">
        {/* Monogram / Logotype */}
        <div className="flex items-center gap-2 font-semibold shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-orange-500 to-amber-600 shadow-[0_0_10px_rgba(255,106,36,0.4)]">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-foreground text-xs hidden sm:inline">
            PolicyLab
          </span>
        </div>

        <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />

        {/* Project Name — clickable to switch workspace */}
        <button
          onClick={onSwitchWorkspace}
          disabled={!onSwitchWorkspace}
          className="text-foreground font-medium hidden sm:inline text-xs hover:text-orange-500 transition-colors disabled:cursor-default truncate max-w-[140px] md:max-w-[200px]"
          title={onSwitchWorkspace ? "Return to Console Hub / Switch workspace" : undefined}
        >
          {activeProject}
        </button>

        {/* Workspace Mode Badge */}
        {workspaceMode === "demo" ? (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20 shrink-0">
            DEMO
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
            CONNECTED
          </span>
        )}

        <ChevronRight className="h-3 w-3 text-muted-foreground/40 hidden md:inline shrink-0" />

        {/* Environment Tag */}
        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#18B868]" />
            {environment}
          </span>
        </div>

        <span className="text-muted-foreground/40 hidden xl:inline shrink-0">·</span>

        {/* Versions Context */}
        <div className="hidden xl:flex items-center gap-2 text-muted-foreground text-[11px] font-mono shrink-0">
          <span>Baseline: <strong className="text-foreground">{activeVersion}</strong></span>
          <span className="text-muted-foreground/40">➔</span>
          <span>Review: <strong className="text-red-500">{candidateVersion} (Draft)</strong></span>
        </div>
      </div>

      {/* Right: Gate Status & Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Contextual Pre-deployment Gate Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
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
          className="h-7 text-xs gap-1.5 border-border bg-card hover:bg-muted text-foreground hidden sm:flex shrink-0"
        >
          <Download className="h-3 w-3 text-orange-500 shrink-0" />
          <span>Export</span>
        </Button>

        <div className="h-3.5 w-[1px] bg-border shrink-0" />

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
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
