import React, { useState } from "react"
import { cn } from "@/lib/utils"

export interface RadarMetric {
  axis: string
  baselineScore: number // 0 to 100
  candidateScore: number // 0 to 100
  unit?: string
  description?: string
}

interface ThreatSurfaceRadarProps {
  metrics?: RadarMetric[]
  className?: string
  title?: string
  subtitle?: string
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
  subtitle = "Dimensional comparison of baseline (v12) vs candidate (v13) security boundaries",
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const size = 300
  const center = size / 2
  const radius = 105
  const count = metrics.length

  // Helper to compute (x, y) coordinates for an axis at given percentage (0-100)
  const getCoordinates = (index: number, score: number) => {
    const angle = (Math.PI * 2 / count) * index - Math.PI / 2
    const dist = (score / 100) * radius
    return {
      x: center + dist * Math.cos(angle),
      y: center + dist * Math.sin(angle),
    }
  }

  // Generate background concentric web rings (25%, 50%, 75%, 100%)
  const rings = [25, 50, 75, 100]
  const ringPolygons = rings.map((pct) => {
    const pts = Array.from({ length: count }).map((_, i) => {
      const { x, y } = getCoordinates(i, pct)
      return `${x},${y}`
    }).join(" ")
    return { pct, pts }
  })

  // Candidate polygon points (Orange glow)
  const candidatePoints = metrics.map((m, i) => {
    const { x, y } = getCoordinates(i, m.candidateScore)
    return `${x},${y}`
  }).join(" ")

  // Baseline polygon points (Cyan/slate subtle)
  const baselinePoints = metrics.map((m, i) => {
    const { x, y } = getCoordinates(i, m.baselineScore)
    return `${x},${y}`
  }).join(" ")

  return (
    <div className={cn("relative p-4 rounded-xl border border-white/[0.08] bg-[#0D1015]/85 backdrop-blur-md flex flex-col justify-between select-none", className)}>
      {/* Top Specular Line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-xs font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#FF6A24]" />
            {title}
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-sm bg-sky-400/80" />
            <span className="text-muted-foreground">v12 Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-sm bg-orange-500 shadow-[0_0_6px_#FF6A24]" />
            <span className="text-orange-400 font-semibold">v13 Candidate</span>
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
            {/* Candidate Glow Gradient */}
            <radialGradient id="candidateGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FF6A24" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FF6A24" stopOpacity="0.05" />
            </radialGradient>
            <radialGradient id="baselineGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.02" />
            </radialGradient>
          </defs>

          {/* Web Concentric Polygons */}
          {ringPolygons.map(({ pct, pts }) => (
            <polygon
              key={pct}
              points={pts}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="1"
              strokeDasharray={pct === 100 ? "none" : "2,2"}
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
                stroke="rgba(255, 255, 255, 0.09)"
                strokeWidth="1"
              />
            )
          })}

          {/* Baseline Polygon (v12) */}
          <polygon
            points={baselinePoints}
            fill="url(#baselineGlow)"
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeOpacity="0.65"
            strokeDasharray="3,3"
          />

          {/* Candidate Polygon (v13 - Vibrant Orange Blast Area) */}
          <polygon
            points={candidatePoints}
            fill="url(#candidateGlow)"
            stroke="#FF6A24"
            strokeWidth="2"
            strokeLinejoin="round"
            className="filter drop-shadow-[0_0_8px_rgba(255,106,36,0.4)]"
          />

          {/* Candidate Vertex Nodes with Interactive Hover */}
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
                  r={isHovered ? 6 : 4}
                  fill="#FF8A42"
                  stroke="#090A0D"
                  strokeWidth="2"
                  className="transition-all duration-150"
                />
              </g>
            )
          })}

          {/* Axis Labels Placed Around Circumference */}
          {metrics.map((m, i) => {
            const { x, y } = getCoordinates(i, 122)
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
                  "text-[9px] font-mono transition-colors duration-150 cursor-pointer",
                  isHovered ? "fill-orange-400 font-bold" : "fill-muted-foreground"
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
      <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/[0.06] text-xs font-mono flex items-center justify-between min-h-[36px]">
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
            <span className="font-mono text-[10px] text-orange-400/90 font-semibold">+68% Net Surface Expansion</span>
          </div>
        )}
      </div>
    </div>
  )
}
