import React from "react"
import { cn } from "@/lib/utils"

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: "base" | "elevated" | "subtle"
  withTopHighlight?: boolean
  className?: string
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  variant = "base",
  withTopHighlight = true,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden transition-all duration-200 select-none",
        variant === "base" && "glass-panel",
        variant === "elevated" && "glass-panel-elevated",
        variant === "subtle" && "bg-card/70 border border-white/[0.07] backdrop-blur-md",
        className
      )}
      {...props}
    >
      {/* Subtle Top Specular Horizon Highlight */}
      {withTopHighlight && (
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.18] to-transparent pointer-events-none" />
      )}
      {children}
    </div>
  )
}
