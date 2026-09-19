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
  const minVal = Math.min(...chartData, 0)
  const maxVal = Math.max(...chartData, 10)
  const range = maxVal - minVal || 1
  const height = 28
  const width = 72

  const points = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * width
    const y = height - ((d - minVal) / range) * (height - 4) - 2
    return `${x},${y}`
  })
  const polylineStr = points.join(" ")

  const colorMap = {
    orange: {
      stroke: "#FF6A24",
      fill: "rgba(255, 106, 36, 0.2)",
      glow: "shadow-[0_0_12px_rgba(255,106,36,0.3)]",
    },
    amber: {
      stroke: "#F5B544",
      fill: "rgba(245, 181, 68, 0.2)",
      glow: "shadow-[0_0_12px_rgba(245,181,68,0.3)]",
    },
    emerald: {
      stroke: "#18B868",
      fill: "rgba(24, 184, 104, 0.2)",
      glow: "shadow-[0_0_12px_rgba(24,184,104,0.3)]",
    },
    red: {
      stroke: "#EF4444",
      fill: "rgba(239, 68, 68, 0.2)",
      glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]",
    },
    cyan: {
      stroke: "#38BDF8",
      fill: "rgba(56, 189, 248, 0.2)",
      glow: "shadow-[0_0_12px_rgba(56,189,248,0.3)]",
    },
  }

  const activeColor = colorMap[statusColor]

  return (
    <div
      className={cn(
        "glass-card-premium relative p-4 rounded-2xl flex flex-col justify-between min-h-[110px] group cursor-default select-none",
        className
      )}
    >
      {/* Specular Top Edge Light Highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.25] to-transparent pointer-events-none" />

      {/* Header: Technical Label & Delta Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
        {deltaText && (
          <span
            className={cn(
              "text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 backdrop-blur-md transition-transform duration-200 group-hover:scale-105",
              deltaType === "negative" && "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.25)]",
              deltaType === "positive" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(24,184,104,0.25)]",
              deltaType === "warning" && "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,181,68,0.25)]",
              deltaType === "neutral" && "bg-white/[0.08] text-white/90 border-white/[0.12]"
            )}
          >
            {deltaText}
          </span>
        )}
      </div>

      {/* Middle: Metric Value & Embedded Micro-Chart */}
      <div className="flex items-end justify-between gap-2 mt-2.5">
        <div className="min-w-0">
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-foreground truncate group-hover:text-white transition-colors">
            {value}
          </div>
          {subValue && (
            <div className="text-[11px] text-muted-foreground font-sans truncate mt-0.5">
              {subValue}
            </div>
          )}
        </div>

        {/* Embedded Mini SVG Visualization with Filter Glow */}
        {chartType === "sparkline" && (
          <div className="shrink-0 opacity-85 group-hover:opacity-100 transition-all duration-300 group-hover:scale-105">
            <svg width={width} height={height} className="overflow-visible">
              <defs>
                <filter id={`glow-${statusColor}`}>
                  <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor={activeColor.stroke} floodOpacity="0.6" />
                </filter>
              </defs>
              <polyline
                fill="none"
                stroke={activeColor.stroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#glow-${statusColor})`}
                points={polylineStr}
              />
            </svg>
          </div>
        )}

        {chartType === "bars" && (
          <div className="shrink-0 flex items-end gap-1 h-7 opacity-85 group-hover:opacity-100 transition-all duration-300">
            {chartData.slice(-6).map((val, idx) => {
              const barHeight = Math.max(5, Math.round((val / maxVal) * 24))
              return (
                <div
                  key={idx}
                  className="w-1.5 rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: activeColor.stroke,
                    boxShadow: `0 0 6px ${activeColor.stroke}60`,
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
