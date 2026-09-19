import React from "react"
import {
  ShieldCheck,
  Sun,
  Moon,
  GitFork,
  Layers,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/theme/ThemeProvider"

interface AppHeaderProps {
  activeProject?: string
  activeVersion?: string
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeProject = "AcmePay-Core-Authz",
  activeVersion = "v12 (Production)",
}) => {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Left: Branding & Project Selector */}
        <div className="flex items-center gap-3.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black tracking-wider text-white shadow-md shadow-indigo-500/20">
            PL
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-foreground text-sm sm:text-base">
              PolicyLab
            </span>
            <span className="hidden sm:inline-block text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
              v1.0.0
            </span>
          </div>

          <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

          {/* Project & Version Selector Pill */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border text-xs font-medium text-foreground hover:bg-muted cursor-pointer transition-colors">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span>{activeProject}</span>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono border-border">
              Active: {activeVersion}
            </Badge>
          </div>
        </div>

        {/* Right: Engine Status, Theme Toggle, Dual Repo Status */}
        <div className="flex items-center gap-2.5">
          {/* Dual Repo Sync indicator */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-1 rounded-md bg-muted/40 border border-border">
            <GitFork className="h-3 w-3 text-emerald-500" />
            <span>Dual-Repo Synced</span>
          </div>

          {/* Cedar Engine Badge */}
          <Badge variant="allow" className="gap-1 text-xs hidden sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Cedar v3.1</span>
          </Badge>

          {/* Bedrock Grounding Badge */}
          <Badge variant="ai" className="gap-1 text-xs hidden sm:inline-flex">
            <Sparkles className="h-3 w-3" />
            <span>Claude 3.5</span>
          </Badge>

          {/* Theme Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="h-8 px-2.5 gap-1.5 text-xs text-foreground border-border hover:bg-muted"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
