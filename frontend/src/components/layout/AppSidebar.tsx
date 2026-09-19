import React from "react"
import {
  LayoutDashboard,
  FileCode2,
  Zap,
  GitCompare,
  ShieldCheck,
  Rocket,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

export type ActiveTab =
  | "overview"
  | "policies"
  | "simulator"
  | "changes"
  | "audit"
  | "tests"
  | "deployments"

interface AppSidebarProps {
  activeTab: ActiveTab
  onSelectTab: (tab: ActiveTab) => void
  failedContractsCount?: number
  counterexamplesCount?: number
}

interface NavItem {
  id: ActiveTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeText?: string
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "allow" | "deny" | "warning" | "blocked"
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  failedContractsCount = 3,
  counterexamplesCount = 3,
}) => {
  const navItems: NavItem[] = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "policies",
      label: "Policy Editor",
      icon: FileCode2,
    },
    {
      id: "simulator",
      label: "Simulator",
      icon: Zap,
    },
    {
      id: "changes",
      label: "Change Analysis",
      icon: GitCompare,
      badgeText: counterexamplesCount > 0 ? `${counterexamplesCount} findings` : undefined,
      badgeVariant: "deny",
    },
    {
      id: "tests",
      label: "Security Contracts",
      icon: ShieldCheck,
      badgeText: failedContractsCount > 0 ? `${failedContractsCount} fail` : "Pass",
      badgeVariant: failedContractsCount > 0 ? "blocked" : "allow",
    },
    {
      id: "deployments",
      label: "Deployments",
      icon: Rocket,
    },
    {
      id: "audit",
      label: "Strands Audit",
      icon: ShieldAlert,
    },
  ]

  return (
    <aside className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/60 flex md:flex-col justify-between p-2 md:p-3 overflow-x-auto md:overflow-y-auto select-none">
      <div className="space-y-4 w-full">
        <div className="space-y-0.5">
          <div className="hidden md:block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Workspace
          </div>

          <nav className="flex md:flex-col gap-0.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                    isActive
                      ? "bg-accent text-foreground font-semibold border-l-2 border-primary -ml-[2px] pl-[10px]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </div>

                  {item.badgeText && (
                    <Badge
                      variant={item.badgeVariant || "outline"}
                      className="text-[9px] px-1.5 py-0 h-4 font-mono ml-1 shrink-0"
                    >
                      {item.badgeText}
                    </Badge>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Contextual Bottom Section: Current Review Status */}
      <div className="hidden md:block pt-3 border-t border-border mt-4">
        <div className="p-2.5 rounded-md bg-muted/40 border border-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current Review
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-status-deny animate-pulse" />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono font-medium text-foreground">v13 draft</span>
            <span className="text-status-deny font-medium">Gate blocked</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-status-deny shrink-0" />
            <span>3 contract regressions</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
