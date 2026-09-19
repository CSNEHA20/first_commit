import React from "react"
import { CheckCircle2, XCircle } from "lucide-react"
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
      className={`font-mono font-bold tracking-wider ${
        size === "sm" ? "text-[10px] px-1.5 py-0" : size === "lg" ? "text-sm px-3 py-1" : "text-xs px-2 py-0.5"
      }`}
    >
      {showIcon && (
        isAllow ? (
          <CheckCircle2 className="h-3 w-3 mr-1 inline-block" />
        ) : (
          <XCircle className="h-3 w-3 mr-1 inline-block" />
        )
      )}
      {decision}
    </Badge>
  )
}
