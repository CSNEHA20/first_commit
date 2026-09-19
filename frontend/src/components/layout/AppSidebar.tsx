import React from "react"
import {
  LayoutDashboard,
  FileCode2,
  Zap,
  GitCompare,
  ShieldAlert,
  FlaskConical,
  Rocket,
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
  badge?: {
    text: string
    variant: "default" | "secondary" | "destructive" | "outline" | "allow" | "deny" | "warning" | "blocked" | "ai"
  }
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  failedContractsCount = 1,
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
      badge: { text: "v12 / v13", variant: "outline" },
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
      badge:
        counterexamplesCount > 0
          ? { text: `${counterexamplesCount} Findings`, variant: "destructive" }
          : undefined,
    },
    {
      id: "audit",
      label: "Policy Audit",
      icon: ShieldAlert,
      badge: { text: "BLOCKED", variant: "blocked" },
    },
    {
      id: "tests",
      label: "Regression Suite",
      icon: FlaskConical,
      badge:
        failedContractsCount > 0
          ? { text: `${failedContractsCount} Failed`, variant: "deny" }
          : { text: "18/18 Pass", variant: "allow" },
    },
    {
      id: "deployments",
      label: "Deployments",
      icon: Rocket,
    },
  ]

  return (
    <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/50 backdrop-blur-sm p-3 md:p-4 flex md:flex-col justify-between overflow-x-auto md:overflow-y-auto">
      <div className="space-y-1 w-full flex md:flex-col gap-1 md:gap-0">
        <div className="hidden md:block px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Workspace Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 ${
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </div>

              {item.badge && (
                <Badge
                  variant={item.badge.variant}
                  className={`text-[9px] px-1.5 py-0 font-bold hidden sm:inline-block ${
                    isActive ? "border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground" : ""
                  }`}
                >
                  {item.badge.text}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {/* Sidebar Footer: Production Target Info */}
      <div className="hidden md:block pt-4 border-t border-border mt-6">
        <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1 text-[11px]">
          <span className="text-muted-foreground block text-[10px] uppercase font-bold">
            Target Policy Store
          </span>
          <p className="font-mono font-semibold text-foreground truncate">
            ps-acmepay-prod
          </p>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[10px] pt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>AVP Connected</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
