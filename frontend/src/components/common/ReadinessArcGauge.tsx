import React from "react"
import { cn } from "@/lib/utils"

interface ReadinessArcGaugeProps {
  score?: number
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
  const width = 260
  const height = 150
  const strokeWidth = 15
  const radius = 95
  const cx = width / 2
  const cy = height - 15

  const arcLength = Math.PI * radius
  const strokeDashoffset = arcLength - (score / 100) * arcLength

  return (
    <div
      className={cn(
        "glass-card-premium relative p-5 rounded-2xl flex flex-col items-center justify-between select-none min-h-[230px] overflow-hidden",
        className
      )}
    >
      {/* Specular Top Horizon Highlight Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.28] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <span className="text-xs font-bold text-foreground tracking-tight flex items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              statusType === "pass" && "bg-emerald-500 shadow-[0_0_10px_#18B868]",
              statusType === "blocked" && "bg-red-500 shadow-[0_0_10px_#EF4444] animate-pulse",
              statusType === "warning" && "bg-amber-500 shadow-[0_0_10px_#F5B544]"
            )}
          />
          {title}
        </span>
        <span
          className={cn(
            "text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border backdrop-blur-md",
            statusType === "pass" && "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(24,184,104,0.3)]",
            statusType === "blocked" && "bg-red-500/15 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
            statusType === "warning" && "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,181,68,0.3)]"
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
            <filter id="gaugeArcGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#FF6A24" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Background Track Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
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
            filter="url(#gaugeArcGlow)"
            className="transition-all duration-1000 ease-out"
          />

          {/* Tick Marks Around Circumference */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = Math.PI - (tick / 100) * Math.PI
            const innerR = radius - 15
            const outerR = radius + 6
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
                stroke="rgba(255, 255, 255, 0.28)"
                strokeWidth="1.5"
              />
            )
          })}
        </svg>

        {/* Center Percentage Display */}
        <div className="absolute bottom-2 inset-x-0 flex flex-col items-center justify-center text-center">
          <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-foreground drop-shadow-[0_0_12px_rgba(255,106,36,0.4)]">
            {score}%
          </div>
          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
            {passedCount} / {totalCount} Invariants Pass
          </div>
        </div>
      </div>

      {/* Footer Info Row */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-2 border-t border-white/[0.08] mt-2">
        <span>0% Critical Failure</span>
        <span className="text-orange-400 font-bold">Target: 100% (Production Gate)</span>
      </div>
    </div>
  )
}
