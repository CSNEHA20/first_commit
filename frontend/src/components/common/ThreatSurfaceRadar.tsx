import React, { useState } from "react"
import { cn } from "@/lib/utils"

export interface RadarMetric {
  axis: string
  baselineScore: number
  candidateScore: number
  unit?: string
  description?: string
}

interface ThreatSurfaceRadarProps {
  metrics?: RadarMetric[]
  className?: string
  title?: string
  subtitle?: string
  baselineLabel?: string
  candidateLabel?: string
}

const DEFAULT_METRICS: RadarMetric[] = [
  { axis: "Privilege Escalation", baselineScore: 15, candidateScore: 92, unit: "Critical", description: "Wildcard permit grants unassigned capabilities" },
  { axis: "Resource Exposure", baselineScore: 20, candidateScore: 84, unit: "High", description: "184 payroll & billing entities exposed" },
  { axis: "Action Scope", baselineScore: 25, candidateScore: 95, unit: "Broadened", description: "4 of 4 schema actions matched" },
  { axis: "Principal Reach", baselineScore: 30, candidateScore: 78, unit: "Moderate", description: "Contractor & Editor roles impacted" },
  { axis: "Contract Assurance", baselineScore: 95, candidateScore: 45, unit: "Failed", description: "3 of 6 security invariant contracts failing" },
  { axis: "Blast Radius", baselineScore: 10, candidateScore: 88, unit: "Significant", description: "+2 unauthorized state transitions" },
]

export const ThreatSurfaceRadar: React.FC<ThreatSurfaceRadarProps> = ({
  metrics = DEFAULT_METRICS,
  className,
  title = "Authorization Threat Surface Map",
  subtitle = "Dimensional comparison of baseline vs candidate security boundaries",
  baselineLabel = "Baseline",
  candidateLabel = "Candidate",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const size = 320
  const center = size / 2
  const radius = 110
  const count = metrics.length

  const getCoordinates = (index: number, score: number) => {
    const angle = (Math.PI * 2 / count) * index - Math.PI / 2
    const dist = (score / 100) * radius
    return {
      x: center + dist * Math.cos(angle),
      y: center + dist * Math.sin(angle),
    }
  }

  const rings = [25, 50, 75, 100]
  const ringPolygons = rings.map((pct) => {
    const pts = Array.from({ length: count }).map((_, i) => {
      const { x, y } = getCoordinates(i, pct)
      return `${x},${y}`
    }).join(" ")
    return { pct, pts }
  })

  const candidatePoints = metrics.map((m, i) => {
    const { x, y } = getCoordinates(i, m.candidateScore)
    return `${x},${y}`
  }).join(" ")

  const baselinePoints = metrics.map((m, i) => {
    const { x, y } = getCoordinates(i, m.baselineScore)
    return `${x},${y}`
  }).join(" ")

  return (
    <div
      className={cn(
        "glass-card-premium relative p-5 rounded-2xl flex flex-col justify-between select-none overflow-hidden",
        className
      )}
    >
      {/* Specular Top Horizon Highlight Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.28] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-xs font-bold text-foreground tracking-tight flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_10px_#FF6A24] animate-pulse" />
            {title}
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
            <span className="h-1.5 w-3 rounded-sm bg-sky-400" />
            <span className="text-sky-600 dark:text-sky-300">{baselineLabel}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-500/15 border border-orange-500/30">
            <span className="h-1.5 w-3 rounded-sm bg-orange-500 shadow-[0_0_8px_#FF6A24]" />
            <span className="text-orange-500 font-bold">{candidateLabel}</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative flex items-center justify-center py-2">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          <defs>
            <radialGradient id="radarCandidateGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF6A24" stopOpacity="0.55" />
              <stop offset="70%" stopColor="#FF8A42" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#FF6A24" stopOpacity="0.02" />
            </radialGradient>
            <radialGradient id="radarBaselineGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.02" />
            </radialGradient>
            <filter id="radarOrangeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FF6A24" floodOpacity="0.65" />
            </filter>
          </defs>

          {/* Web Concentric Polygons */}
          {ringPolygons.map(({ pct, pts }) => (
            <polygon
              key={pct}
              points={pts}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
              strokeDasharray={pct === 100 ? "none" : "2,3"}
            />
          ))}

          {/* Radial Spokes / Axes */}
          {metrics.map((_, i) => {
            const { x, y } = getCoordinates(i, 100)
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1"
              />
            )
          })}

          {/* Baseline Polygon (v12) */}
          <polygon
            points={baselinePoints}
            fill="url(#radarBaselineGlow)"
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeOpacity="0.75"
            strokeDasharray="3,3"
          />

          {/* Candidate Polygon (v13 - Radiant Orange Area) */}
          <polygon
            points={candidatePoints}
            fill="url(#radarCandidateGlow)"
            stroke="#FF6A24"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#radarOrangeGlow)"
            className="transition-all duration-500"
          />

          {/* Candidate Vertex Nodes with Glowing Pulsing Hover */}
          {metrics.map((m, i) => {
            const { x, y } = getCoordinates(i, m.candidateScore)
            const isHovered = hoveredIndex === i

            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 7 : 4.5}
                  fill="#FF8A42"
                  stroke="#FFFFFF"
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  className="transition-all duration-200"
                  filter="url(#radarOrangeGlow)"
                />
              </g>
            )
          })}

          {/* Axis Labels Placed Around Circumference */}
          {metrics.map((m, i) => {
            const { x, y } = getCoordinates(i, 124)
            const isHovered = hoveredIndex === i
            const textAnchor = x > center + 10 ? "start" : x < center - 10 ? "end" : "middle"

            return (
              <text
                key={i}
                x={x}
                y={y}
                textAnchor={textAnchor}
                dominantBaseline="central"
                className={cn(
                  "text-[9px] font-mono transition-all duration-200 cursor-pointer select-none",
                  isHovered ? "fill-orange-400 font-bold scale-110" : "fill-muted-foreground hover:fill-white"
                )}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {m.axis}
              </text>
            )
          })}
        </svg>
      </div>

      {/* Interactive Detail Inspector on Hover */}
      <div className="mt-1 p-2.5 rounded-xl bg-black/40 border border-white/[0.1] backdrop-blur-md text-xs font-mono flex items-center justify-between min-h-[40px] shadow-inner">
        {hoveredIndex !== null ? (
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-orange-400 font-bold">{metrics[hoveredIndex].axis}:</span>
              <span className="text-muted-foreground ml-1.5 text-[11px] font-sans">
                {metrics[hoveredIndex].description}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sky-400 text-[10px]">v12: {metrics[hoveredIndex].baselineScore}%</span>
              <span className="text-muted-foreground text-[10px]">➔</span>
              <span className="text-orange-400 font-bold text-[10px]">v13: {metrics[hoveredIndex].candidateScore}%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-[11px] text-muted-foreground font-sans">
            <span>Hover over radar vertex nodes to inspect dimensional exposure</span>
            <span className="font-mono text-[10px] text-orange-400 font-bold">+68% Net Surface Expansion</span>
          </div>
        )}
      </div>
    </div>
  )
}
