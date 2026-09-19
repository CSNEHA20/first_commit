import React from "react"
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  HelpCircle,
  ShieldAlert,
  Server,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type EnterpriseStatus =
  | "PASS"
  | "BLOCKED"
  | "INCOMPLETE"
  | "ALLOW"
  | "DENY"
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "DRAFT"
  | "VERIFIED"
  | "MOCKED"
  | "UNAVAILABLE"
  | "PENDING"
  | "READY"
  | "SYNCHRONIZED"

interface StatusBadgeProps {
  status: EnterpriseStatus | string
  label?: string
  size?: "xs" | "sm" | "default" | "lg"
  showIcon?: boolean
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "default",
  showIcon = true,
  className,
}) => {
  const normStatus = (status || "").toUpperCase() as EnterpriseStatus
  const displayLabel = label || normStatus

  const getBadgeStyle = () => {
    switch (normStatus) {
      case "PASS":
      case "ALLOW":
      case "VERIFIED":
      case "SYNCHRONIZED":
      case "READY":
        return {
          container: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold",
          icon: <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />,
        }
      case "BLOCKED":
      case "DENY":
      case "CRITICAL":
        return {
          container: "border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold",
          icon: <ShieldAlert className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400" />,
        }
      case "HIGH":
        return {
          container: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold",
          icon: <AlertOctagon className="h-3 w-3 shrink-0 text-rose-600 dark:text-rose-400" />,
        }
      case "MEDIUM":
      case "INCOMPLETE":
      case "WARNING" as any:
        return {
          container: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold",
          icon: <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />,
        }
      case "LOW":
      case "DRAFT":
      case "PENDING":
        return {
          container: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium",
          icon: <Clock className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />,
        }
      case "MOCKED":
        return {
          container: "border-border bg-muted/60 text-muted-foreground font-mono font-medium",
          icon: <Server className="h-3 w-3 shrink-0 text-muted-foreground" />,
        }
      case "UNAVAILABLE":
      default:
        return {
          container: "border-border bg-muted/40 text-muted-foreground font-medium",
          icon: <HelpCircle className="h-3 w-3 shrink-0 text-muted-foreground" />,
        }
    }
  }

  const { container, icon } = getBadgeStyle()

  const sizeClass =
    size === "xs"
      ? "text-[9px] px-1 py-0 h-4 gap-0.5"
      : size === "sm"
      ? "text-[10px] px-1.5 py-0.5 h-5 gap-1"
      : size === "lg"
      ? "text-xs px-2.5 py-1 h-7 gap-1.5 font-bold"
      : "text-[11px] px-2 py-0.5 h-6 gap-1 font-medium"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-mono select-none tracking-tight",
        sizeClass,
        container,
        className
      )}
    >
      {showIcon && icon}
      <span>{displayLabel}</span>
    </span>
  )
}
