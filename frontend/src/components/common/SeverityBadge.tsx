import React from "react"
import { AlertOctagon, AlertTriangle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SeverityLevel } from "@/types/authz"

interface SeverityBadgeProps {
  severity: SeverityLevel
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  switch (severity) {
    case "CRITICAL":
      return (
        <Badge variant="blocked" className="gap-1">
          <AlertOctagon className="h-3 w-3" />
          CRITICAL
        </Badge>
      )
    case "HIGH":
      return (
        <Badge variant="deny" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          HIGH
        </Badge>
      )
    case "MEDIUM":
      return (
        <Badge variant="warning" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          MEDIUM
        </Badge>
      )
    case "LOW":
    default:
      return (
        <Badge variant="outline" className="gap-1 text-slate-400">
          <Info className="h-3 w-3" />
          LOW
        </Badge>
      )
  }
}
