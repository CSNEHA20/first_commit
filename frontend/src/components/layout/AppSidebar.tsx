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
  Play,
  HelpCircle,
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

interface NavSection {
  title: string
  items: Array<{
    id: ActiveTab
    label: string
    icon: React.ComponentType<{ className?: string }>
    badgeText?: string
    badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "allow" | "deny" | "warning" | "blocked"
  }>
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onSelectTab,
  failedContractsCount = 3,
  counterexamplesCount = 3,
}) => {
  const sections: NavSection[] = [
    {
      title: "Workspace",
      items: [
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
      ],
    },
    {
      title: "Analysis",
      items: [
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
      ],
    },
    {
      title: "Operations",
      items: [
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
      ],
    },
  ]

  return (
    <aside className="w-full md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card/90 backdrop-blur-xl flex md:flex-col justify-between p-3 overflow-x-auto md:overflow-y-auto select-none">
      <div className="space-y-4 w-full">
        {/* Brand Header (Inspired by CY·FOCUS in Reference Images) */}
        <div className="hidden md:flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-[0_0_14px_rgba(255,106,36,0.5)]">
              <span className="font-mono font-black text-xs text-white tracking-wider">PL</span>
            </div>
            <div>
              <div className="text-xs font-bold tracking-wider text-foreground uppercase flex items-center gap-1.5">
                <span>POLICY</span>
                <span className="text-orange-500 font-black">·</span>
                <span>LAB</span>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground block -mt-0.5">
                SECURITY ENGINE
              </span>
            </div>
          </div>
        </div>

        {/* Primary Verification Action Button (High-vis Orange) */}
        <div className="hidden md:block">
          <button
            onClick={() => onSelectTab("tests")}
            className="w-full h-8 px-3 rounded-lg bg-[#FF6A24] hover:bg-[#FF8A42] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Run Verification</span>
            <span className="text-[10px] font-mono opacity-80 ml-auto">+</span>
          </button>
        </div>

        {/* Navigation Sections */}
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="hidden md:block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              {section.title}
            </div>

            <nav className="flex md:flex-col gap-0.5" aria-label={section.title}>
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                      isActive
                        ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold border-l-2 border-orange-500 pl-2 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? "text-orange-500" : "text-muted-foreground"
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
        ))}
      </div>

      {/* Sidebar Footer: Contextual Gate Card & Operator Profile */}
      <div className="hidden md:block pt-3 border-t border-border mt-3 space-y-2.5">
        {/* Active Review Widget */}
        <div className="p-2.5 rounded-lg bg-card border border-border space-y-1.5 text-xs shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Active Review
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#EF4444] animate-pulse" />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono font-semibold text-foreground">v13 (Candidate)</span>
            <span className="text-red-500 font-bold font-mono">BLOCKED</span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
            <span>3 Invariant Violations</span>
          </div>
        </div>

        {/* Operator Profile */}
        <div className="p-2 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-6 w-6 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center font-mono text-[10px] text-orange-500 font-bold shrink-0">
              VS
            </div>
            <div className="truncate">
              <span className="text-[11px] font-semibold text-foreground truncate block leading-tight">
                Vishal & Sneha
              </span>
              <span className="text-[9px] text-muted-foreground font-mono truncate block">
                @vibesync · SecOps Lead
              </span>
            </div>
          </div>

          <a
            href="https://github.com/Vishallakshmikanthan/policylab"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Help & Docs"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </aside>
  )
}
