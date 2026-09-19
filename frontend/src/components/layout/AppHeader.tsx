import React from "react"
import {
  Sun,
  Moon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { useTheme } from "@/theme/ThemeProvider"

interface AppHeaderProps {
  activeProject?: string
  activeVersion?: string
  candidateVersion?: string
  gateStatus?: "PASS" | "BLOCKED" | "INCOMPLETE"
  environment?: "Production" | "Staging"
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeProject = "AcmePay-Core-Authz",
  activeVersion = "v12",
  candidateVersion = "v13",
  gateStatus = "BLOCKED",
  environment = "Production",
}) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="border-b border-border bg-card text-foreground sticky top-0 z-40 h-11 px-4 flex items-center justify-between transition-colors select-none">
      {/* Left: Workbench Identifier & Project Context */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Monogram / Logotype */}
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
            PL
          </span>
          <span className="font-semibold tracking-tight text-foreground text-xs">
            PolicyLab
          </span>
        </div>

        <span className="text-muted-foreground/40">/</span>

        {/* Project Name */}
        <span className="text-foreground font-medium hidden sm:inline text-xs">
          {activeProject}
        </span>

        <span className="text-muted-foreground/40 hidden md:inline">/</span>

        {/* Environment Tag */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {environment}
          </span>
        </div>

        <span className="text-muted-foreground/40 hidden lg:inline">·</span>

        {/* Versions Context */}
        <div className="hidden lg:flex items-center gap-2 text-muted-foreground text-[11px] font-mono">
          <span>Baseline: <strong className="text-foreground">{activeVersion}</strong></span>
          <span className="text-muted-foreground/40">➔</span>
          <span>Review: <strong className="text-status-deny">{candidateVersion} (Draft)</strong></span>
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

        <div className="h-3.5 w-[1px] bg-border" />

        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
