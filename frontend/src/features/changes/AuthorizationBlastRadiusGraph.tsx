import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ListFilter,
  ShieldAlert,
  Users,
  User,
  Bot,
  Sliders,
  Database,
  Server,
  Eye,
  CheckCircle2,
  Code2,
  Info,
  X,
  RefreshCw,
  FileSearch,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BlastRadiusGraphData,
  BlastRadiusNode,
  BlastRadiusEdge,
  GraphNodeStatus,
} from "./blastRadiusGraphModel"
import { Counterexample } from "@/types/authz"

interface AuthorizationBlastRadiusGraphProps {
  graphData: BlastRadiusGraphData
  onSelectCounterexample?: (cxId: string) => void
  onInspectEvidence?: (cx: Counterexample) => void
  counterexamples?: Counterexample[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

interface NodePhysicsState {
  x: number
  y: number
  vx: number
  vy: number
  isDragging: boolean
}

export const AuthorizationBlastRadiusGraph: React.FC<AuthorizationBlastRadiusGraphProps> = ({
  graphData,
  onSelectCounterexample,
  onInspectEvidence,
  counterexamples = [],
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<BlastRadiusNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<BlastRadiusNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<BlastRadiusEdge | null>(null)
  const [isDraggingAny, setIsDraggingAny] = useState<boolean>(false)

  // Physics & dynamic coordinates state for free-floating and elastic dragging
  const [nodePositions, setNodePositions] = useState<Record<string, NodePhysicsState>>({})
  const positionsRef = useRef<Record<string, NodePhysicsState>>({})
  const dragRef = useRef<{
    nodeId: string
    startX: number
    startY: number
    hasMoved: boolean
  } | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const graphGroupRef = useRef<SVGGElement | null>(null)

  // Initialize and synchronize node positions whenever graphData updates
  useEffect(() => {
    const initial: Record<string, NodePhysicsState> = {}
    graphData.nodes.forEach((node) => {
      initial[node.id] = {
        x: node.x,
        y: node.y,
        vx: 0,
        vy: 0,
        isDragging: false,
      }
    })
    positionsRef.current = initial
    setNodePositions(initial)
  }, [graphData.nodes])

  // Physics animation loop: Handles zero-gravity space drift + spring return on release
  useEffect(() => {
    let animId: number

    const loop = (now: number) => {
      const timeSec = now * 0.001
      let hasChange = false

      const currentPositions = { ...positionsRef.current }

      graphData.nodes.forEach((node, idx) => {
        let state = currentPositions[node.id]
        if (!state) {
          state = {
            x: node.x,
            y: node.y,
            vx: 0,
            vy: 0,
            isDragging: false,
          }
          currentPositions[node.id] = state
        }

        if (state.isDragging) {
          // While user is pulling node, keep it at cursor position
          hasChange = true
          return
        }

        // 1. Subtle cosmic idle floating (zero-gravity breathing drift)
        const idleFloatX = Math.sin(timeSec * 1.3 + idx * 0.85) * 2.8
        const idleFloatY = Math.cos(timeSec * 1.1 + idx * 0.85) * 3.2

        // Equilibrium home position
        const targetX = node.x + idleFloatX
        const targetY = node.y + idleFloatY

        // 2. Spring force returning node to its original space
        const dx = targetX - state.x
        const dy = targetY - state.y
        const dist = Math.hypot(dx, dy)

        // Elastic spring parameters
        const stiffness = 0.13
        const damping = 0.79

        const fx = dx * stiffness
        const fy = dy * stiffness

        state.vx = (state.vx + fx) * damping
        state.vy = (state.vy + fy) * damping

        state.x += state.vx
        state.y += state.vy

        if (dist > 0.1 || Math.hypot(state.vx, state.vy) > 0.05) {
          hasChange = true
        }
      })

      if (hasChange) {
        positionsRef.current = currentPositions
        setNodePositions({ ...currentPositions })
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [graphData.nodes])

  // Helper to convert screen pointer event coordinates to SVG coordinate space
  const getSvgCoordinates = useCallback((e: React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = graphGroupRef.current?.getScreenCTM() || svgRef.current.getScreenCTM()
    if (ctm) {
      const transformed = pt.matrixTransform(ctm.inverse())
      return { x: transformed.x, y: transformed.y }
    }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 900,
      y: ((e.clientY - rect.top) / rect.height) * 600,
    }
  }, [])

  // Pointer event handlers for free-dragging nodes in space
  const handleNodePointerDown = (node: BlastRadiusNode, e: React.PointerEvent) => {
    e.stopPropagation()
    try {
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    } catch {}

    dragRef.current = {
      nodeId: node.id,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
    }

    setIsDraggingAny(true)

    if (positionsRef.current[node.id]) {
      positionsRef.current[node.id].isDragging = true
      positionsRef.current[node.id].vx = 0
      positionsRef.current[node.id].vy = 0
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const { nodeId, startX, startY } = dragRef.current

    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 4) {
      dragRef.current.hasMoved = true
    }

    const svgPt = getSvgCoordinates(e)
    if (positionsRef.current[nodeId]) {
      positionsRef.current[nodeId].x = svgPt.x
      positionsRef.current[nodeId].y = svgPt.y
      positionsRef.current[nodeId].vx = 0
      positionsRef.current[nodeId].vy = 0
      positionsRef.current[nodeId].isDragging = true
      setNodePositions({ ...positionsRef.current })
    }
  }

  const handleNodePointerUp = (node: BlastRadiusNode, e: React.PointerEvent) => {
    e.stopPropagation()
    try {
      ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
    } catch {}

    const wasMoved = dragRef.current?.hasMoved
    dragRef.current = null
    setIsDraggingAny(false)

    // Mark node as no longer being dragged; spring loop will pull it back
    if (positionsRef.current[node.id]) {
      positionsRef.current[node.id].isDragging = false
      setNodePositions({ ...positionsRef.current })
    }

    // If user merely clicked without pulling, open the inspection details drawer
    if (!wasMoved) {
      setSelectedNode(node)
      setSelectedEdge(null)
    }
  }

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.2, 2.2))
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.2, 0.6))
  const handleResetZoom = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
    setSelectedNode(null)
    setSelectedEdge(null)
    setActiveFilter(null)
    // Snap all nodes back to home
    const reset: Record<string, NodePhysicsState> = {}
    graphData.nodes.forEach((n) => {
      reset[n.id] = { x: n.x, y: n.y, vx: 0, vy: 0, isDragging: false }
    })
    positionsRef.current = reset
    setNodePositions(reset)
  }

  // Filter nodes based on legend selection
  const filteredNodes = useMemo(() => {
    if (!activeFilter) return graphData.nodes
    return graphData.nodes.filter(
      (n) => n.category === "center" || n.status === activeFilter
    )
  }, [graphData.nodes, activeFilter])

  const filteredEdges = useMemo(() => {
    if (!activeFilter) return graphData.edges
    return graphData.edges.filter((e) => e.status === activeFilter)
  }, [graphData.edges, activeFilter])

  // Current live position helper for any node id
  const getNodePos = useCallback(
    (node: BlastRadiusNode) => {
      const live = nodePositions[node.id]
      if (live) return { x: live.x, y: live.y, isDragging: live.isDragging }
      return { x: node.x, y: node.y, isDragging: false }
    },
    [nodePositions]
  )

  // Color helpers
  const getStatusColor = (status: GraphNodeStatus) => {
    switch (status) {
      case "NEWLY_AUTHORIZED":
        return "#10B981" // Emerald green
      case "MODIFIED_AFFECTED":
        return "#F59E0B" // Amber/orange
      case "REVOKED":
        return "#EF4444" // Crimson red
      case "CONTRACT_VIOLATION":
        return "#A855F7" // Electric violet
      case "SAFE":
        return "#10B981" // Emerald
      case "UNCHANGED":
        return "#06B6D4" // Cyan/teal
      default:
        return "#94A3B8"
    }
  }

  const getStatusGlow = (status: GraphNodeStatus) => {
    switch (status) {
      case "NEWLY_AUTHORIZED":
        return "url(#glow-green)"
      case "MODIFIED_AFFECTED":
        return "url(#glow-orange)"
      case "REVOKED":
        return "url(#glow-red)"
      case "CONTRACT_VIOLATION":
        return "url(#glow-purple)"
      default:
        return undefined
    }
  }

  // Node Icon component renderer
  const renderNodeIcon = (node: BlastRadiusNode) => {
    const size = node.type === "POLICY_CENTER" ? 22 : 14
    const color = getStatusColor(node.status)

    switch (node.iconType) {
      case "code":
        return <Code2 size={size} color="#FFFFFF" />
      case "user":
        return <User size={size} color={color} />
      case "users":
        return <Users size={size} color={color} />
      case "bot":
        return <Bot size={size} color={color} />
      case "sliders":
        return <Sliders size={size} color={color} />
      case "database":
        return <Database size={size} color={color} />
      case "server":
        return <Server size={size} color={color} />
      case "eye":
        return <Eye size={size} color={color} />
      case "shield-alert":
        return <ShieldAlert size={size} color="#FFFFFF" />
      case "check":
        return <CheckCircle2 size={size} color="#10B981" />
      default:
        return <Info size={size} color={color} />
    }
  }

  // Find linked counterexample if node or edge has one
  const linkedCounterexample = useMemo(() => {
    const cxId = selectedNode?.details.counterexampleId || selectedEdge?.counterexampleId
    if (!cxId) return null
    return counterexamples.find((c) => c.id === cxId) || null
  }, [selectedNode, selectedEdge, counterexamples])

  if (isLoading) {
    return (
      <div className="glass-panel-premium p-8 rounded-2xl border border-white/[0.08] flex flex-col items-center justify-center min-h-[460px] space-y-4">
        <div className="relative">
          <RefreshCw className="h-10 w-10 animate-spin text-orange-500" />
          <div className="absolute inset-0 blur-lg bg-orange-500/30 -z-10 rounded-full" />
        </div>
        <div className="text-center space-y-1">
          <h4 className="text-sm font-bold text-foreground font-mono">Computing Blast Radius Topology...</h4>
          <p className="text-xs text-muted-foreground">Evaluating deterministic transitions and scenario boundaries</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass-panel-premium p-8 rounded-2xl border border-red-500/30 flex flex-col items-center justify-center min-h-[460px] space-y-4 text-center">
        <ShieldAlert className="h-10 w-10 text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.4)]" />
        <div className="space-y-1 max-w-md">
          <h4 className="text-sm font-bold text-foreground">Graph Generation Error</h4>
          <p className="text-xs text-red-300/90">{error}</p>
        </div>
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40"
          >
            Retry Analysis
          </Button>
        )}
      </div>
    )
  }

  const { centerNode } = graphData
  const centerPos = getNodePos(centerNode)

  return (
    <div className="glass-panel-premium relative rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden flex flex-col">
      {/* Top Header & Interactive Controls Bar */}
      <div className="p-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_10px_#F97316] animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 font-mono">
              Authorization Blast Radius
              <Badge
                variant="outline"
                className={`text-[10px] font-mono px-1.5 py-0 ${
                  graphData.isBlocked
                    ? "border-red-500/40 text-red-400 bg-red-500/10"
                    : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                }`}
              >
                {graphData.gateStatus}
              </Badge>
              <span className="text-[10px] text-orange-400 font-normal hidden md:inline font-sans">
                (Pull & drag nodes freely)
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground font-sans">
              Drag nodes freely across space — release to snap back into orbit
            </p>
          </div>
        </div>

        {/* View Controls: Zoom, Fit, Legend Toggle */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            title="Zoom In"
            className="h-7 w-7 p-0 border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="h-7 w-7 p-0 border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetZoom}
            title="Fit to View & Reset Positions"
            className="h-7 px-2 text-[11px] gap-1 border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-foreground"
          >
            <Maximize2 className="h-3 w-3 text-orange-400" />
            <span className="hidden sm:inline">Fit</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLegendOpen((o) => !o)}
            title="Toggle Legend"
            className={`h-7 px-2 text-[11px] gap-1 border-white/[0.1] ${
              isLegendOpen ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "bg-white/[0.04] text-foreground"
            }`}
          >
            <ListFilter className="h-3 w-3" />
            <span className="hidden sm:inline">Legend</span>
          </Button>
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      <div className="relative w-full h-[460px] sm:h-[490px] bg-gradient-to-b from-[#090A0E] via-[#0C0E14] to-[#090A0E] overflow-hidden flex items-center justify-center select-none touch-none">
        {/* Ambient Orbitals & Space Aura */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full border border-white/[0.03] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-dashed border-white/[0.025] pointer-events-none" />
          {graphData.isBlocked ? (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-red-500/[0.05] rounded-full blur-3xl pointer-events-none" />
          ) : (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-emerald-500/[0.05] rounded-full blur-3xl pointer-events-none" />
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 900 600"
          className="w-full h-full select-none"
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            if (dragRef.current) {
              const id = dragRef.current.nodeId
              if (positionsRef.current[id]) {
                positionsRef.current[id].isDragging = false
                setNodePositions({ ...positionsRef.current })
              }
              dragRef.current = null
            }
            setIsDraggingAny(false)
          }}
        >
          {/* SVG Glow Filter Definitions */}
          <defs>
            <filter id="glow-green" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10B981" floodOpacity="0.75" />
            </filter>
            <filter id="glow-orange" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.75" />
            </filter>
            <filter id="glow-red" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.75" />
            </filter>
            <filter id="glow-purple" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#A855F7" floodOpacity="0.85" />
            </filter>
            <radialGradient id="centerGlowDraft" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="centerGlowSafe" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Master Zoom & Pan Transformation Container */}
          <g
            ref={graphGroupRef}
            transform={`translate(${450 + panOffset.x}, ${300 + panOffset.y}) scale(${zoomLevel}) translate(-450, -300)`}
          >
            {/* Rubber-band return tether indicator when a node is pulled far from home */}
            <g className="tether-anchors-layer">
              {filteredNodes.map((node) => {
                const pos = getNodePos(node)
                const pullDist = Math.hypot(pos.x - node.x, pos.y - node.y)
                if (pullDist < 16) return null

                const color = getStatusColor(node.status)
                return (
                  <g key={`tether_${node.id}`} className="pointer-events-none opacity-60">
                    {/* Home space ghost ring */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                    {/* Elastic rubber-band tether line connecting home to current pulled coordinate */}
                    <line
                      x1={node.x}
                      y1={node.y}
                      x2={pos.x}
                      y2={pos.y}
                      stroke={color}
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  </g>
                )
              })}
            </g>

            {/* Connected Edges with dynamic stretching and illuminated dot beads */}
            <g className="edges-layer">
              {filteredEdges.map((edge) => {
                const targetNode = graphData.nodes.find((n) => n.id === edge.target)
                if (!targetNode) return null

                const targetPos = getNodePos(targetNode)
                const x1 = centerPos.x
                const y1 = centerPos.y
                const x2 = targetPos.x
                const y2 = targetPos.y
                const color = getStatusColor(edge.status)
                const isSelected = selectedEdge?.id === edge.id || selectedNode?.id === targetNode.id
                const isPulled = targetPos.isDragging || centerPos.isDragging

                // Dynamic illuminated dot positions along edge
                const dots = []
                const count = edge.dotsCount || 3
                for (let i = 1; i <= count; i++) {
                  const t = i / (count + 1)
                  dots.push({
                    x: x1 + (x2 - x1) * t,
                    y: y1 + (y2 - y1) * t,
                  })
                }

                return (
                  <g
                    key={edge.id}
                    className="cursor-pointer transition-opacity group"
                    onClick={() => {
                      setSelectedEdge(edge)
                      setSelectedNode(targetNode)
                    }}
                  >
                    {/* Outer glow stroke on hover or select */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={isSelected ? 4 : isPulled ? 3 : 2}
                      strokeOpacity={isSelected ? 0.9 : isPulled ? 0.65 : 0.35}
                      filter={getStatusGlow(edge.status)}
                    />

                    {/* Core connector line */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={isSelected ? 2.5 : 1.2}
                      strokeOpacity={isSelected ? 1 : 0.75}
                    />

                    {/* Illuminated beads along edge */}
                    {dots.map((dot, idx) => (
                      <circle
                        key={`${edge.id}_dot_${idx}`}
                        cx={dot.x}
                        cy={dot.y}
                        r={isSelected ? 4 : 3}
                        fill={color}
                        opacity={isSelected ? 1 : 0.85}
                        filter={getStatusGlow(edge.status)}
                      />
                    ))}
                  </g>
                )
              })}
            </g>

            {/* Central Policy Node (freely pullable, snaps back on release) */}
            <g
              className="cursor-grab active:cursor-grabbing transition-transform group"
              onPointerDown={(e) => handleNodePointerDown(centerNode, e)}
              onPointerUp={(e) => handleNodePointerUp(centerNode, e)}
              onMouseEnter={() => setHoveredNode(centerNode)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Center Background Aura */}
              <circle
                cx={centerPos.x}
                cy={centerPos.y}
                r={centerNode.radius + 28}
                fill={graphData.isBlocked ? "url(#centerGlowDraft)" : "url(#centerGlowSafe)"}
              />

              {/* Outer Hexagon / Circle Frame */}
              <circle
                cx={centerPos.x}
                cy={centerPos.y}
                r={centerNode.radius + 6}
                fill="#121622"
                stroke={getStatusColor(centerNode.status)}
                strokeWidth="2.5"
                filter={getStatusGlow(centerNode.status)}
              />

              {/* Inner Core */}
              <circle
                cx={centerPos.x}
                cy={centerPos.y}
                r={centerNode.radius}
                fill={graphData.isBlocked ? "#3B0E14" : "#0A291A"}
                stroke="#FFFFFF"
                strokeOpacity="0.2"
                strokeWidth="1.5"
              />

              {/* Code Icon inside center */}
              <foreignObject
                x={centerPos.x - 12}
                y={centerPos.y - 12}
                width="24"
                height="24"
                className="pointer-events-none"
              >
                <div className="flex items-center justify-center w-full h-full">
                  <Code2 size={18} className="text-white drop-shadow-sm" />
                </div>
              </foreignObject>

              {/* Central Version Tag Label */}
              <text
                x={centerPos.x}
                y={centerPos.y + 54}
                textAnchor="middle"
                className="fill-foreground font-mono font-bold text-[13px] tracking-wide pointer-events-none select-none"
              >
                {centerNode.label}
              </text>
              <rect
                x={centerPos.x - 42}
                y={centerPos.y + 60}
                width="84"
                height="18"
                rx="9"
                fill="#000000"
                fillOpacity="0.65"
                stroke={getStatusColor(centerNode.status)}
                strokeWidth="1"
                className="pointer-events-none"
              />
              <text
                x={centerPos.x}
                y={centerPos.y + 73}
                textAnchor="middle"
                className="fill-orange-400 font-sans font-semibold text-[9px] uppercase tracking-wider pointer-events-none select-none"
              >
                {centerNode.sublabel}
              </text>
            </g>

            {/* Connected Satellite Nodes (freely stranded in space, draggable, snap back) */}
            <g className="nodes-layer">
              {filteredNodes
                .filter((n) => n.id !== "center_policy")
                .map((node) => {
                  const pos = getNodePos(node)
                  const color = getStatusColor(node.status)
                  const isSelected = selectedNode?.id === node.id
                  const isHovered = hoveredNode?.id === node.id

                  return (
                    <g
                      key={node.id}
                      className="cursor-grab active:cursor-grabbing transition-transform group"
                      onPointerDown={(e) => handleNodePointerDown(node, e)}
                      onPointerUp={(e) => handleNodePointerUp(node, e)}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      {/* Outer Halo on Selection/Hover/Pull */}
                      {(isSelected || isHovered || pos.isDragging) && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={node.radius + 10}
                          fill={color}
                          fillOpacity={pos.isDragging ? 0.35 : 0.2}
                          className="animate-pulse"
                        />
                      )}

                      {/* Node Circle Container */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={node.radius}
                        fill="#121622"
                        stroke={color}
                        strokeWidth={isSelected || pos.isDragging ? "3" : "2"}
                        filter={getStatusGlow(node.status)}
                      />

                      {/* Icon container */}
                      <foreignObject
                        x={pos.x - 12}
                        y={pos.y - 12}
                        width="24"
                        height="24"
                        className="pointer-events-none"
                      >
                        <div className="flex items-center justify-center w-full h-full">
                          {renderNodeIcon(node)}
                        </div>
                      </foreignObject>

                      {/* Primary Node Label */}
                      <text
                        x={pos.x}
                        y={pos.y + node.radius + 14}
                        textAnchor="middle"
                        className="fill-foreground font-sans font-bold text-[11px] pointer-events-none select-none"
                      >
                        {node.label}
                      </text>

                      {/* Subtitle / Count Badge */}
                      <text
                        x={pos.x}
                        y={pos.y + node.radius + 26}
                        textAnchor="middle"
                        style={{ fill: color }}
                        className="font-mono text-[9.5px] font-semibold pointer-events-none select-none"
                      >
                        {node.sublabel}
                      </text>
                    </g>
                  )
                })}
            </g>
          </g>
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredNode && !selectedNode && !isDraggingAny && (
          <div
            className="absolute z-20 pointer-events-none p-3 rounded-xl bg-[#090A0D]/95 border border-white/[0.15] shadow-2xl backdrop-blur-xl text-xs space-y-1.5 max-w-xs animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: Math.min(Math.max(getNodePos(hoveredNode).y - 40, 20), 380),
              left: Math.min(Math.max(getNodePos(hoveredNode).x - 80, 20), 650),
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-1">
              <span className="font-bold text-foreground font-mono">{hoveredNode.details.title}</span>
              <Badge
                className="text-[9px] px-1 py-0"
                style={{
                  backgroundColor: `${getStatusColor(hoveredNode.status)}20`,
                  color: getStatusColor(hoveredNode.status),
                  borderColor: `${getStatusColor(hoveredNode.status)}40`,
                }}
              >
                {hoveredNode.details.status}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {hoveredNode.details.description}
            </p>
            {hoveredNode.details.countText && (
              <div className="text-[10px] font-mono font-semibold" style={{ color: getStatusColor(hoveredNode.status) }}>
                {hoveredNode.details.countText}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Detail Drawer / Inspection Card (When a Node or Edge is Selected) */}
      {selectedNode && (
        <div className="p-4 border-t border-white/[0.1] bg-[#0E1118]/95 backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center border shrink-0"
                style={{
                  backgroundColor: `${getStatusColor(selectedNode.status)}15`,
                  borderColor: `${getStatusColor(selectedNode.status)}40`,
                }}
              >
                {renderNodeIcon(selectedNode)}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground font-mono">{selectedNode.details.title}</h4>
                  <Badge
                    className="text-[10px] font-mono"
                    style={{
                      backgroundColor: `${getStatusColor(selectedNode.status)}20`,
                      color: getStatusColor(selectedNode.status),
                      borderColor: `${getStatusColor(selectedNode.status)}40`,
                    }}
                  >
                    {selectedNode.details.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedNode.details.description}</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedNode(null)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Node Entities & Scenario Transition details */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/[0.06] text-xs">
            {selectedNode.details.principals && selectedNode.details.principals.length > 0 && (
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                  Sample Principals
                </span>
                <div className="font-mono text-foreground truncate mt-0.5">
                  {selectedNode.details.principals.join(", ")}
                </div>
              </div>
            )}

            {selectedNode.details.actions && selectedNode.details.actions.length > 0 && (
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                  Impacted Actions
                </span>
                <div className="font-mono text-orange-400 truncate mt-0.5">
                  {selectedNode.details.actions.join(", ")}
                </div>
              </div>
            )}

            {selectedNode.details.resources && selectedNode.details.resources.length > 0 && (
              <div className="p-2 rounded-lg bg-black/40 border border-white/[0.06]">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block font-mono">
                  Target Resources
                </span>
                <div className="font-mono text-foreground truncate mt-0.5">
                  {selectedNode.details.resources.join(", ")}
                </div>
              </div>
            )}
          </div>

          {/* Actions Bar for Selected Node */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
            <div className="text-[11px] text-muted-foreground font-mono">
              {selectedNode.details.countText || `Scope: ${selectedNode.details.category}`}
            </div>

            <div className="flex items-center gap-2">
              {linkedCounterexample && onInspectEvidence && (
                <Button
                  size="sm"
                  onClick={() => onInspectEvidence(linkedCounterexample)}
                  className="h-7 text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  <span>Inspect Counterexample ({linkedCounterexample.id})</span>
                </Button>
              )}
              {selectedNode.details.violatedContractId && onSelectCounterexample && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectCounterexample("cx_01")}
                  className="h-7 text-xs gap-1 border-purple-500/40 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>View Contract {selectedNode.details.violatedContractId}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Legend Bar */}
      {isLegendOpen && (
        <div className="p-3 border-t border-white/[0.08] bg-black/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => setActiveFilter(activeFilter === "NEWLY_AUTHORIZED" ? null : "NEWLY_AUTHORIZED")}
              className={`flex items-center gap-1.5 transition-all text-xs ${
                activeFilter === "NEWLY_AUTHORIZED" ? "opacity-100 font-bold scale-105" : "opacity-85 hover:opacity-100"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
              <span className="text-foreground">Newly Authorized</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === "MODIFIED_AFFECTED" ? null : "MODIFIED_AFFECTED")}
              className={`flex items-center gap-1.5 transition-all text-xs ${
                activeFilter === "MODIFIED_AFFECTED" ? "opacity-100 font-bold scale-105" : "opacity-85 hover:opacity-100"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_8px_#F59E0B]" />
              <span className="text-foreground">Modified / Affected</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === "REVOKED" ? null : "REVOKED")}
              className={`flex items-center gap-1.5 transition-all text-xs ${
                activeFilter === "REVOKED" ? "opacity-100 font-bold scale-105" : "opacity-85 hover:opacity-100"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444] shadow-[0_0_8px_#EF4444]" />
              <span className="text-foreground">Revoked</span>
            </button>

            <button
              onClick={() => setActiveFilter(activeFilter === "CONTRACT_VIOLATION" ? null : "CONTRACT_VIOLATION")}
              className={`flex items-center gap-1.5 transition-all text-xs ${
                activeFilter === "CONTRACT_VIOLATION" ? "opacity-100 font-bold scale-105" : "opacity-85 hover:opacity-100"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#A855F7] shadow-[0_0_8px_#A855F7]" />
              <span className="text-foreground">Contract Violation</span>
            </button>
          </div>

          <div className="text-[10px] text-muted-foreground font-mono">
            Bounded universe: {graphData.stats.totalScenariosEvaluated} scenarios ({graphData.stats.coveragePct}% coverage)
          </div>
        </div>
      )}
    </div>
  )
}
