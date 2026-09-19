import React from "react"
import { Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { AuthorizationDecision } from "@/types/authz"

interface DecisionBadgeProps {
  decision: AuthorizationDecision
  size?: "sm" | "default" | "lg"
  showIcon?: boolean
}

export const DecisionBadge: React.FC<DecisionBadgeProps> = ({
  decision,
  size = "default",
  showIcon = true,
}) => {
  const isAllow = decision === "ALLOW"

  return (
    <Badge
      variant={isAllow ? "allow" : "deny"}
      className={`font-mono font-bold tracking-tight inline-flex items-center gap-1 ${
        size === "sm"
          ? "text-[10px] px-1.5 py-0"
          : size === "lg"
          ? "text-xs px-2.5 py-1"
          : "text-[11px] px-2 py-0.5"
      }`}
    >
      {showIcon && (
        isAllow ? (
          <Check className="h-3 w-3 stroke-[2.5]" />
        ) : (
          <X className="h-3 w-3 stroke-[2.5]" />
        )
      )}
      <span>{decision}</span>
    </Badge>
  )
}
