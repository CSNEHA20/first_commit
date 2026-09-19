import React from "react"
import {
  Sun,
  Moon,
  ShieldAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/theme/ThemeProvider"

interface AppHeaderProps {
  activeProject?: string
  activeVersion?: string
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeProject = "AcmePay / Authorization",
  activeVersion = "v12",
}) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="border-b border-border bg-card text-foreground sticky top-0 z-40 h-11 px-4 flex items-center justify-between transition-colors">
      {/* Left: Workbench Identifier & Project Context */}
      <div className="flex items-center gap-2.5 text-xs">
        {/* Monogram / Logotype */}
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground select-none">
            PL
          </span>
          <span className="font-semibold tracking-tight text-foreground">
            PolicyLab
          </span>
        </div>

        <span className="text-muted-foreground/50">/</span>

        <span className="text-foreground font-medium hidden sm:inline">
          {activeProject}
        </span>

        <span className="text-muted-foreground/50 hidden md:inline">/</span>

        <div className="hidden md:flex items-center gap-1.5 text-muted-foreground">
          <span>Env: <strong className="text-foreground font-medium">Production</strong></span>
          <span className="text-muted-foreground/40">·</span>
          <span>Baseline: <code className="font-mono text-foreground font-medium">{activeVersion}</code></span>
        </div>
      </div>

      {/* Right: Validation Gate Status & Theme Toggle */}
      <div className="flex items-center gap-3">
        {/* Contextual Pre-deployment Gate Indicator */}
        <div className="flex items-center gap-1.5">
          <Badge variant="blocked" className="text-[10px] py-0.5 px-2 gap-1 font-mono">
            <ShieldAlert className="h-3 w-3 text-status-blocked" />
            <span>Gate: Blocked (SC-04)</span>
          </Badge>
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
