import React from "react"
import { cn } from "@/lib/utils"

interface GlassStatCardProps {
  label: string
  value: string | number
  subValue?: string
  deltaText?: string
  deltaType?: "positive" | "negative" | "warning" | "neutral"
  statusColor?: "orange" | "amber" | "emerald" | "red" | "cyan"
  chartType?: "sparkline" | "bars" | "none"
  chartData?: number[]
  className?: string
}

export const GlassStatCard: React.FC<GlassStatCardProps> = ({
  label,
  value,
  subValue,
  deltaText,
  deltaType = "neutral",
  statusColor = "orange",
  chartType = "sparkline",
  chartData = [10, 18, 14, 25, 20, 32, 28, 40],
  className,
}) => {
  // Generate SVG path for mini sparkline
  const minVal = Math.min(...chartData, 0)
  const maxVal = Math.max(...chartData, 10)
  const range = maxVal - minVal || 1
  const height = 24
  const width = 64

  const points = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * width
    const y = height - ((d - minVal) / range) * height
    return `${x},${y}`
  })
  const polylineStr = points.join(" ")

  const colorMap = {
    orange: {
      stroke: "#FF6A24",
      fill: "rgba(255, 106, 36, 0.15)",
      badgeBg: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      accentBar: "bg-orange-500",
    },
    amber: {
      stroke: "#F5B544",
      fill: "rgba(245, 181, 68, 0.15)",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accentBar: "bg-amber-500",
    },
    emerald: {
      stroke: "#18B868",
      fill: "rgba(24, 184, 104, 0.15)",
      badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accentBar: "bg-emerald-500",
    },
    red: {
      stroke: "#EF4444",
      fill: "rgba(239, 68, 68, 0.15)",
      badgeBg: "bg-red-500/10 text-red-400 border-red-500/20",
      accentBar: "bg-red-500",
    },
    cyan: {
      stroke: "#38BDF8",
      fill: "rgba(56, 189, 248, 0.15)",
      badgeBg: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      accentBar: "bg-sky-500",
    },
  }

  const activeColor = colorMap[statusColor]

  return (
    <div
      className={cn(
        "relative p-3.5 rounded-xl border border-white/[0.08] bg-[#0D1015]/80 backdrop-blur-md transition-all duration-200 hover:border-white/[0.16] hover:bg-[#13171E]/90 group select-none flex flex-col justify-between min-h-[100px]",
        className
      )}
    >
      {/* Top Specular Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent pointer-events-none" />

      {/* Header: Technical Label & Delta Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
        {deltaText && (
          <span
            className={cn(
              "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0",
              deltaType === "negative" && "bg-red-500/10 text-red-400 border-red-500/20",
              deltaType === "positive" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              deltaType === "warning" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
              deltaType === "neutral" && "bg-white/[0.05] text-muted-foreground border-white/[0.08]"
            )}
          >
            {deltaText}
          </span>
        )}
      </div>

      {/* Middle: Metric Value & Embedded Micro-Chart */}
      <div className="flex items-end justify-between gap-2 mt-2">
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground truncate">
            {value}
          </div>
          {subValue && (
            <div className="text-[11px] text-muted-foreground font-sans truncate mt-0.5">
              {subValue}
            </div>
          )}
        </div>

        {/* Embedded Mini SVG Visualization (Sparkline or Mini Bar) */}
        {chartType === "sparkline" && (
          <div className="shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <svg width={width} height={height} className="overflow-visible">
              <polyline
                fill="none"
                stroke={activeColor.stroke}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylineStr}
              />
            </svg>
          </div>
        )}

        {chartType === "bars" && (
          <div className="shrink-0 flex items-end gap-1 h-6 opacity-75 group-hover:opacity-100 transition-opacity">
            {chartData.slice(-6).map((val, idx) => {
              const barHeight = Math.max(4, Math.round((val / maxVal) * 20))
              return (
                <div
                  key={idx}
                  className="w-1.5 rounded-t transition-all"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: activeColor.stroke,
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
