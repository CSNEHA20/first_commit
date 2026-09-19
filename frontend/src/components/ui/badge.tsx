import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
  {
    variants: {
      variant: {
        default:
          "border border-primary/20 bg-primary text-primary-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground",
        destructive:
          "border border-destructive/30 bg-destructive/10 text-destructive font-semibold",
        outline: "border border-border bg-transparent text-foreground",
        allow: "border border-status-allow/40 bg-status-allow/10 text-status-allow font-semibold",
        deny: "border border-status-deny/40 bg-status-deny/10 text-status-deny font-semibold",
        warning: "border border-status-warning/40 bg-status-warning/10 text-status-warning font-semibold",
        blocked: "border border-status-blocked/50 bg-status-blocked/15 text-status-blocked font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
