import React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string; isCurrent?: boolean }>
  statusBadge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  breadcrumbs,
  statusBadge,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3.5 mb-4",
        className
      )}
    >
      <div className="space-y-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mb-0.5">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-muted-foreground/40">/</span>}
                <span
                  className={cn(
                    crumb.isCurrent
                      ? "text-foreground font-medium"
                      : "hover:text-foreground transition-colors"
                  )}
                >
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && <div className="text-primary shrink-0">{icon}</div>}
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {statusBadge && <div className="shrink-0">{statusBadge}</div>}
        </div>

        {subtitle && (
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
