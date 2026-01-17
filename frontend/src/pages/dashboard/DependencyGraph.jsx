import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network, ChevronDown, ChevronRight, RefreshCw, Settings2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'
import * as api from '../../services/api'

/**
 * Layout algorithm for hierarchical concept graph.
 * Organizes nodes in a tree-like structure based on depth and parent relationships.
 */
function hierarchicalLayout(nodes, edges) {
  const positions = new Map()
  
  if (!nodes || nodes.length === 0) return positions
  
  // Build parent-children map
  const childrenMap = new Map()
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  
  nodes.forEach(n => {
    childrenMap.set(n.id, [])
  })
  
  edges.forEach(e => {
    const children = childrenMap.get(e.from) || []
    children.push(e.to)
    childrenMap.set(e.from, children)
  })
  
  // Find root node (depth 0 or kind === 'core')
  const root = nodes.find(n => n.depth === 0 || n.kind === 'core') || nodes[0]
  
  // Calculate tree dimensions - INCREASED for better visibility
  const nodeWidth = 200
  const nodeHeight = 70
  const horizontalGap = 40
  const verticalGap = 120
  
  // Position nodes recursively
  function positionSubtree(nodeId, startX, depth, visited = new Set()) {
    if (visited.has(nodeId)) return startX
    visited.add(nodeId)
    
    const children = childrenMap.get(nodeId) || []
    const y = 100 + depth * (nodeHeight + verticalGap)
    
    if (children.length === 0) {
      // Leaf node
      positions.set(nodeId, { x: startX + nodeWidth / 2, y })
      return startX + nodeWidth + horizontalGap
    }
    
    // Position children first
    let currentX = startX
    const childPositions = []
    
    children.forEach(childId => {
      currentX = positionSubtree(childId, currentX, depth + 1, visited)
      const childPos = positions.get(childId)
      if (childPos) childPositions.push(childPos.x)
    })
    
    // Position parent centered above children
    if (childPositions.length > 0) {
      const centerX = (Math.min(...childPositions) + Math.max(...childPositions)) / 2
      positions.set(nodeId, { x: centerX, y })
    } else {
      positions.set(nodeId, { x: startX + nodeWidth / 2, y })
    }
    
    return currentX
  }
  
  positionSubtree(root.id, 60, 0)
  
  return positions
}

/**
 * Get color scheme for node based on kind and depth.
 */
function getNodeStyle(kind, depth, isSelected) {
  const baseStyles = {
    core: {
      fill: 'rgba(99, 102, 241, 0.15)',
      stroke: 'rgb(129, 140, 248)',
      text: 'rgb(165, 180, 252)',
    },
    subtopic: {
      fill: 'rgba(255, 255, 255, 0.05)',
      stroke: 'rgba(255, 255, 255, 0.2)',
      text: 'rgba(255, 255, 255, 0.8)',
    },
    detail: {
      fill: 'rgba(255, 255, 255, 0.03)',
      stroke: 'rgba(255, 255, 255, 0.1)',
      text: 'rgba(255, 255, 255, 0.6)',
    },
    prereq: {
      fill: 'rgba(255, 255, 255, 0.02)',
      stroke: 'rgba(255, 255, 255, 0.1)',
      text: 'rgba(255, 255, 255, 0.5)',
    },
    next: {
      fill: 'rgba(255, 255, 255, 0.02)',
      stroke: 'rgba(255, 255, 255, 0.1)',
      text: 'rgba(255, 255, 255, 0.5)',
    },
  }
  
  const style = baseStyles[kind] || baseStyles.subtopic
  
  if (isSelected) {
    return {
      fill: 'rgba(99, 102, 241, 0.2)',
      stroke: 'rgb(129, 140, 248)',
      text: 'white',
      strokeWidth: 3,
    }
  }
  
  return { ...style, strokeWidth: 2 }
}

/**
 * Topic selector component shown when no topic is selected.
 */
function TopicSelector() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTopics() {
      try {
        const res = await api.listDetectedTopics()
        setTopics(res || [])
      } catch (err) {
        console.error('Failed to load topics:', err)
      } finally {
        setLoading(false)
      }
    }
    loadTopics()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network size={18} /> Select a Topic
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm font-light text-white/50 mb-4">
          Choose a detected topic to view its concept dependency graph.
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Spinner /> Loading topics…
          </div>
        ) : topics.length === 0 ? (
          <div className="text-center py-8">
            <Network size={48} className="mx-auto mb-4 text-white/30" />
            <div className="text-white/60">No topics detected yet.</div>
            <div className="mt-2 text-sm font-light text-white/40">
              Start the detector on the Detection page to capture topics.
            </div>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => (
              <a
                key={t.id}
                href={`?topic=${encodeURIComponent(t.id)}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
                  <Network size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white truncate">{t.title}</div>
                  <div className="text-xs font-light text-white/50">{t.level || 'Unknown level'}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DependencyGraph() {
  const [params] = useSearchParams()
  const topicId = params.get('topic')

  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [options, setOptions] = useState({
    maxDepth: 2,
    maxChildren: 5,
    useGemini: true,
  })
  const [showSettings, setShowSettings] = useState(false)
  const svgContainerRef = useRef(null)

  const loadGraph = useCallback(async () => {
    if (!topicId) {
      setError('No topic selected. Please select a topic from the Topics page.')
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const res = await api.getConceptGraph(topicId, options)
      setGraph(res)
      // Select the root/core node by default
      const coreNode = res.nodes.find((n) => n.kind === 'core' || n.depth === 0)
      setSelected(coreNode?.id || res.nodes[0]?.id)
      setZoom(1) // Reset zoom on new graph
    } catch (err) {
      setError(err?.message || 'Failed to load graph')
    } finally {
      setLoading(false)
    }
  }, [topicId, options])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  // Calculate positions using hierarchical layout
  const positions = useMemo(() => {
    if (!graph) return new Map()
    return hierarchicalLayout(graph.nodes, graph.edges)
  }, [graph])

  // Calculate SVG dimensions based on node positions
  const svgDimensions = useMemo(() => {
    if (positions.size === 0) return { width: 800, height: 600, minX: 0, minY: 0 }
    
    const xs = Array.from(positions.values()).map(p => p.x)
    const ys = Array.from(positions.values()).map(p => p.y)
    
    const minX = Math.min(...xs) - 150
    const maxX = Math.max(...xs) + 150
    const minY = Math.min(...ys) - 80
    const maxY = Math.max(...ys) + 80
    
    return {
      width: Math.max(800, maxX - minX),
      height: Math.max(500, maxY - minY),
      minX,
      minY,
    }
  }, [positions])

  // Calculate viewBox based on zoom
  const viewBox = useMemo(() => {
    const { width, height, minX, minY } = svgDimensions
    return `${minX} ${minY} ${width} ${height}`
  }, [svgDimensions])

  if (!topicId) {
    return <TopicSelector />
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Spinner /> Building concept graph…
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="text-sm text-red-400 mb-4">{error}</div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              onClick={loadGraph}
            >
              <RefreshCw size={14} className="mr-2" /> Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedNode = graph?.nodes.find((n) => n.id === selected)
  const childNodes = graph?.edges
    .filter(e => e.from === selected)
    .map(e => graph.nodes.find(n => n.id === e.to))
    .filter(Boolean) || []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Network size={18} /> Concept Dependency Graph
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadGraph}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>
          
          {showSettings && (
            <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="text-sm font-medium text-white">Graph Settings</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs text-white/50">Max Depth (0-2)</span>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white"
                    value={options.maxDepth}
                    onChange={(e) => setOptions(o => ({ ...o, maxDepth: parseInt(e.target.value) }))}
                  >
                    <option value={0}>0 - Core only</option>
                    <option value={1}>1 - Subtopics</option>
                    <option value={2}>2 - Full depth</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-white/50">Max Children</span>
                  <select
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white"
                    value={options.maxChildren}
                    onChange={(e) => setOptions(o => ({ ...o, maxChildren: parseInt(e.target.value) }))}
                  >
                    {[3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    checked={options.useGemini}
                    onChange={(e) => setOptions(o => ({ ...o, useGemini: e.target.checked }))}
                    className="rounded accent-indigo-500"
                  />
                  <span className="text-sm text-white/80">Use AI expansion</span>
                </label>
              </div>
              <Button className="rounded-xl bg-white text-black hover:bg-white/90" size="sm" onClick={loadGraph}>Apply</Button>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {/* Zoom controls */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut size={14} />
                </Button>
                <span className="text-sm text-white/60 min-w-[4rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={() => setZoom(z => Math.min(2, z + 0.25))}
                  disabled={zoom >= 2}
                >
                  <ZoomIn size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                >
                  <Maximize2 size={14} />
                </Button>
              </div>
              <div className="text-xs text-white/50">
                Scroll to pan • Click nodes to select
              </div>
            </div>
            
            <div 
              ref={svgContainerRef}
              className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-black overflow-auto"
              style={{ maxHeight: '600px' }}
            >
              <svg 
                viewBox={viewBox} 
                style={{ 
                  width: svgDimensions.width * zoom,
                  height: svgDimensions.height * zoom,
                  minWidth: '100%',
                  minHeight: '500px',
                }}
              >
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--fg-muted))" />
                  </marker>
                  {/* Gradient definitions for nodes */}
                  <linearGradient id="coreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary) / 0.25)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.1)" />
                  </linearGradient>
                  <linearGradient id="subtopicGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--accent) / 0.2)" />
                    <stop offset="100%" stopColor="hsl(var(--accent) / 0.05)" />
                  </linearGradient>
                  <linearGradient id="detailGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--bg-muted))" />
                    <stop offset="100%" stopColor="hsl(var(--bg))" />
                  </linearGradient>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
                  </filter>
                </defs>

                {/* Draw edges */}
                {graph.edges.map((e, idx) => {
                  const from = positions.get(e.from)
                  const to = positions.get(e.to)
                  if (!from || !to) return null
                  
                  // Calculate edge endpoints (from bottom of parent to top of child)
                  const x1 = from.x
                  const y1 = from.y + 35 // bottom of parent node
                  const x2 = to.x
                  const y2 = to.y - 35 // top of child node
                  
                  // Draw curved path
                  const midY = (y1 + y2) / 2
                  const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
                  
                  const isConnectedToSelected = e.from === selected || e.to === selected
                  
                  return (
                    <path
                      key={idx}
                      d={path}
                      stroke={isConnectedToSelected ? "hsl(var(--primary))" : "hsl(var(--fg-muted))"}
                      strokeWidth={isConnectedToSelected ? "3" : "2"}
                      fill="none"
                      markerEnd="url(#arrow)"
                      opacity={isConnectedToSelected ? "0.8" : "0.4"}
                    />
                  )
                })}

                {/* Draw nodes */}
                {graph.nodes.map((n) => {
                  const p = positions.get(n.id)
                  if (!p) return null
                  
                  const isSelected = n.id === selected
                  const style = getNodeStyle(n.kind, n.depth, isSelected)
                  
                  // Node dimensions
                  const nodeW = 200
                  const nodeH = 70
                  
                  // Get gradient based on kind
                  const gradientId = n.kind === 'core' ? 'coreGradient' : 
                                     n.kind === 'subtopic' ? 'subtopicGradient' : 'detailGradient'
                  
                  // Truncate label if too long - allow more characters
                  const maxLabelLength = 24
                  const displayLabel = n.label.length > maxLabelLength 
                    ? n.label.substring(0, maxLabelLength - 1) + '…'
                    : n.label
                  
                  return (
                    <g
                      key={n.id}
                      onClick={() => setSelected(n.id)}
                      style={{ cursor: 'pointer' }}
                      filter={isSelected ? 'url(#shadow)' : undefined}
                    >
                      <rect
                        x={p.x - nodeW / 2}
                        y={p.y - nodeH / 2}
                        width={nodeW}
                        height={nodeH}
                        rx="14"
                        fill={isSelected ? 'hsl(var(--card))' : `url(#${gradientId})`}
                        stroke={style.stroke}
                        strokeWidth={style.strokeWidth}
                      />
                      {/* Main label */}
                      <text
                        x={p.x}
                        y={p.y + (n.kind === 'core' ? 2 : -2)}
                        textAnchor="middle"
                        fill={style.text}
                        fontSize={n.kind === 'core' ? '16' : '14'}
                        fontFamily="ui-sans-serif, system-ui"
                        fontWeight={n.kind === 'core' ? '700' : '500'}
                      >
                        {displayLabel}
                      </text>
                      {/* Kind badge for non-core nodes */}
                      {n.kind !== 'core' && (
                        <text
                          x={p.x}
                          y={p.y + 18}
                          textAnchor="middle"
                          fill="hsl(var(--fg-muted))"
                          fontSize="10"
                          fontFamily="ui-sans-serif, system-ui"
                        >
                          {n.kind === 'subtopic' ? '◆ Subtopic' : '○ Detail'}
                        </text>
                      )}
                      {/* Core topic indicator */}
                      {n.kind === 'core' && (
                        <text
                          x={p.x}
                          y={p.y + 22}
                          textAnchor="middle"
                          fill="rgb(129, 140, 248)"
                          fontSize="11"
                          fontFamily="ui-sans-serif, system-ui"
                          fontWeight="600"
                        >
                          ★ Core Topic
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-white/50">
              <span>
                {graph.nodes.length} concepts • {graph.edges.length} relationships • 
                Depth: {graph.maxDepth}
              </span>
              <span>Click a concept to see details</span>
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-3">
            {/* Selected concept details */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white mb-3">Selected Concept</div>
              {selectedNode ? (
                <div className="space-y-2">
                  <div className="text-base font-medium text-white">{selectedNode.label}</div>
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full',
                      selectedNode.kind === 'core' && 'bg-indigo-500/20 text-indigo-400',
                      selectedNode.kind === 'subtopic' && 'bg-white/10',
                      selectedNode.kind === 'detail' && 'bg-white/5',
                    )}>
                      {selectedNode.kind}
                    </span>
                    {selectedNode.depth > 0 && (
                      <span>Depth: {selectedNode.depth}</span>
                    )}
                  </div>
                  
                  {/* Show children if any */}
                  {childNodes.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-white/50 mb-2">
                        Contains {childNodes.length} subtopics:
                      </div>
                      <ul className="space-y-1">
                        {childNodes.map(child => (
                          <li
                            key={child.id}
                            className="text-sm text-white/60 hover:text-white cursor-pointer flex items-center gap-1 transition"
                            onClick={() => setSelected(child.id)}
                          >
                            <ChevronRight size={12} />
                            {child.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm font-light text-white/40">No concept selected</div>
              )}
            </div>

            {/* Legend */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white mb-3">Legend</div>
              <div className="space-y-2 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-indigo-500/20 border border-indigo-400"></div>
                  <span>Core Topic</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white/5 border border-white/20"></div>
                  <span>Subtopic (L1)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-white/[0.03] border border-white/10"></div>
                  <span>Detail (L2)</span>
                </div>
              </div>
            </div>

            {/* Navigation hints */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white mb-2">Learning Path</div>
              <div className="text-xs font-light text-white/50">
                Start with the core concept, then explore subtopics for deeper understanding.
                Each level builds on the previous one.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
