import React from "react"
import { cn } from "@/lib/utils"

interface ReadinessArcGaugeProps {
  score?: number // 0 - 100
  title?: string
  statusLabel?: string
  statusType?: "pass" | "blocked" | "warning"
  passedCount?: number
  totalCount?: number
  className?: string
}

export const ReadinessArcGauge: React.FC<ReadinessArcGaugeProps> = ({
  score = 50,
  title = "Security Contract Assurance",
  statusLabel = "GATE BLOCKED",
  statusType = "blocked",
  passedCount = 3,
  totalCount = 6,
  className,
}) => {
  // Semi-circle configuration
  const width = 240
  const height = 140
  const strokeWidth = 14
  const radius = 90
  const cx = width / 2
  const cy = height - 15

  // Semicircle arc length = PI * radius
  const arcLength = Math.PI * radius
  const strokeDashoffset = arcLength - (score / 100) * arcLength

  return (
    <div
      className={cn(
        "relative p-4 rounded-xl border border-white/[0.08] bg-[#0D1015]/85 backdrop-blur-md flex flex-col items-center justify-between select-none min-h-[220px]",
        className
      )}
    >
      {/* Top Specular Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              statusType === "pass" && "bg-emerald-500 shadow-[0_0_8px_#18B868]",
              statusType === "blocked" && "bg-red-500 shadow-[0_0_8px_#EF4444]",
              statusType === "warning" && "bg-amber-500 shadow-[0_0_8px_#F5B544]"
            )}
          />
          {title}
        </span>
        <span
          className={cn(
            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border",
            statusType === "pass" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            statusType === "blocked" && "bg-red-500/10 text-red-400 border-red-500/20",
            statusType === "warning" && "bg-amber-500/10 text-amber-400 border-amber-500/20"
          )}
        >
          {statusLabel}
        </span>
      </div>

      {/* Gauge Semicircle Canvas */}
      <div className="relative mt-2 flex items-center justify-center">
        <svg width={width} height={height} className="overflow-visible">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="50%" stopColor="#FF6A24" />
              <stop offset="100%" stopColor="#F5B544" />
            </linearGradient>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Value Indicator Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={arcLength}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            filter="url(#gaugeGlow)"
            className="transition-all duration-700 ease-out"
          />

          {/* Tick Marks Around Circumference */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = Math.PI - (tick / 100) * Math.PI
            const innerR = radius - 14
            const outerR = radius + 4
            const x1 = cx + innerR * Math.cos(angle)
            const y1 = cy - innerR * Math.sin(angle)
            const x2 = cx + outerR * Math.cos(angle)
            const y2 = cy - outerR * Math.sin(angle)
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.2)"
                strokeWidth="1.5"
              />
            )
          })}
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute bottom-2 inset-x-0 flex flex-col items-center justify-center text-center">
          <div className="text-3xl font-black font-mono tracking-tight text-foreground">
            {score}%
          </div>
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
            {passedCount} / {totalCount} Invariants Pass
          </div>
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-white/[0.06] mt-2">
        <span>0% Critical Failure</span>
        <span className="text-orange-400">Target: 100% (Production Gate)</span>
      </div>
    </div>
  )
}
