import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Network, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import * as api from '../../services/api'

/**
 * Advanced hierarchical layout algorithm for dependency graphs
 * Assigns levels based on topological ordering and centers nodes per level
 */
function computeHierarchicalLayout(graphData) {
  if (!graphData?.nodes?.length) return { nodes: [], edges: [] }

  const { nodes: rawNodes, edges: rawEdges } = graphData
  const spacingX = 250
  const spacingY = 150

  // Build adjacency map for level assignment
  const levelMap = new Map()
  const inDegree = new Map()
  const adjList = new Map()

  // Initialize
  rawNodes.forEach((n) => {
    inDegree.set(n.id, 0)
    adjList.set(n.id, [])
  })

  // Build graph structure
  rawEdges.forEach((e) => {
    const source = e.from || e.source
    const target = e.to || e.target
    if (source && target) {
      adjList.get(source)?.push(target)
      inDegree.set(target, (inDegree.get(target) || 0) + 1)
    }
  })

  // Topological sort to assign levels (BFS-based)
  const queue = []
  rawNodes.forEach((n) => {
    if (inDegree.get(n.id) === 0) {
      levelMap.set(n.id, 0)
      queue.push(n.id)
    }
  })

  while (queue.length > 0) {
    const current = queue.shift()
    const currentLevel = levelMap.get(current)

    adjList.get(current)?.forEach((neighbor) => {
      const newLevel = currentLevel + 1
      levelMap.set(neighbor, Math.max(levelMap.get(neighbor) || 0, newLevel))

      const deg = inDegree.get(neighbor) - 1
      inDegree.set(neighbor, deg)
      if (deg === 0) queue.push(neighbor)
    })
  }

  // Assign default level to any unvisited nodes
  rawNodes.forEach((n) => {
    if (!levelMap.has(n.id)) levelMap.set(n.id, 0)
  })

  // Group nodes by level
  const levelGroups = new Map()
  rawNodes.forEach((n) => {
    const lvl = levelMap.get(n.id)
    if (!levelGroups.has(lvl)) levelGroups.set(lvl, [])
    levelGroups.get(lvl).push(n)
  })

  // Position nodes
  const positionedNodes = []
  levelGroups.forEach((nodesInLevel, level) => {
    const count = nodesInLevel.length
    const totalWidth = (count - 1) * spacingX
    const startX = -totalWidth / 2

    nodesInLevel.forEach((node, index) => {
      positionedNodes.push({
        id: node.id,
        type: 'default',
        position: {
          x: startX + index * spacingX,
          y: level * spacingY
        },
        data: {
          label: node.label || node.id,
          kind: node.kind,
          description: node.description
        },
        style: {
          width: 100,
          height: 100,
          borderRadius: '50%',
          border: `3px solid ${getNodeColor(node.kind)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: '600',
          background: getNodeBackground(node.kind),
          textAlign: 'center',
          padding: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s ease-in-out'
        }
      })
    })
  })

  // Create edges with proper styling
  const formattedEdges = rawEdges
    .filter((e) => {
      const source = e.from || e.source
      const target = e.to || e.target
      return source && target
    })
    .map((e, i) => ({
      id: `edge-${i}`,
      source: e.from || e.source,
      target: e.to || e.target,
      type: 'smoothstep',
      animated: true,
      style: { strokeWidth: 2, stroke: '#94a3b8' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#94a3b8'
      }
    }))

  return { nodes: positionedNodes, edges: formattedEdges }
}

/**
 * Get node border color based on kind
 */
function getNodeColor(kind) {
  const colors = {
    prereq: '#f59e0b',
    core: '#3b82f6',
    next: '#10b981',
    default: '#6366f1'
  }
  return colors[kind] || colors.default
}

/**
 * Get node background color based on kind
 */
function getNodeBackground(kind) {
  const backgrounds = {
    prereq: '#fef3c7',
    core: '#dbeafe',
    next: '#d1fae5',
    default: '#e0e7ff'
  }
  return backgrounds[kind] || backgrounds.default
}

/**
 * Production-level Dependency Graph Component
 */
export default function DependencyGraph() {
  const [params] = useSearchParams()
  const topicId = params.get('topic') || 'react-hooks'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [graphData, setGraphData] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Fetch graph data
  useEffect(() => {
    let mounted = true

    async function fetchGraph() {
      setLoading(true)
      setError(null)

      try {
        const data = await api.getConceptGraph(topicId)
        if (!mounted) return

        setGraphData(data)

        // Compute layout and set nodes/edges
        const { nodes: layoutNodes, edges: layoutEdges } = computeHierarchicalLayout(data)
        setNodes(layoutNodes)
        setEdges(layoutEdges)

        // Auto-select core node or first node
        const coreNode = data.nodes.find((n) => n.kind === 'core')
        setSelectedNode(coreNode || data.nodes[0])
      } catch (err) {
        if (mounted) {
          console.error('Failed to load graph:', err)
          setError(err?.message || 'Failed to load concept graph')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchGraph()

    return () => {
      mounted = false
    }
  }, [topicId, setNodes, setEdges])

  // Handle node click
  const onNodeClick = useCallback(
    (event, node) => {
      const nodeData = graphData?.nodes.find((n) => n.id === node.id)
      setSelectedNode(nodeData)

      // Highlight selected node
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            border:
              n.id === node.id
                ? `4px solid ${getNodeColor(n.data.kind)}`
                : `3px solid ${getNodeColor(n.data.kind)}`,
            transform: n.id === node.id ? 'scale(1.1)' : 'scale(1)'
          }
        }))
      )
    },
    [graphData, setNodes]
  )

  // Retry handler
  const handleRetry = useCallback(() => {
    window.location.reload()
  }, [])

  // Memoize node types for performance
  const nodeTypes = useMemo(() => ({}), [])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="flex items-center gap-3 text-base text-fg-muted">
          <Spinner />
          <span>Loading concept graph...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
          <p className="mb-2 text-lg font-semibold text-red-600">Failed to Load Graph</p>
          <p className="mb-4 text-sm text-fg-muted">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network size={20} />
            Concept Dependency Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-4">
          {/* Graph Visualization */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border bg-bg-muted" style={{ height: '600px' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.5}
                maxZoom={1.5}
                defaultEdgeOptions={{
                  animated: true
                }}
              >
                <Background color="#94a3b8" gap={16} />
                <Controls />
                <MiniMap
                  nodeColor={(node) => getNodeColor(node.data.kind)}
                  maskColor="rgba(0, 0, 0, 0.1)"
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0'
                  }}
                />
                <Panel position="top-right" className="bg-white rounded-lg shadow-md p-3 m-2">
                  <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full" style={{ background: '#fef3c7', border: '2px solid #f59e0b' }} />
                      <span>Prerequisites</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full" style={{ background: '#dbeafe', border: '2px solid #3b82f6' }} />
                      <span>Core</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded-full" style={{ background: '#d1fae5', border: '2px solid #10b981' }} />
                      <span>Next Topics</span>
                    </div>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Selected Node Info */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-fg">Selected Concept</div>
              {selectedNode ? (
                <>
                  <div className="mb-2 text-base font-bold text-fg">{selectedNode.label}</div>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="inline-block rounded-full px-2 py-1 text-xs font-medium"
                      style={{
                        background: getNodeBackground(selectedNode.kind),
                        color: getNodeColor(selectedNode.kind)
                      }}
                    >
                      {selectedNode.kind || 'default'}
                    </span>
                  </div>
                  {selectedNode.description && (
                    <p className="text-sm text-fg-muted">{selectedNode.description}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-fg-muted">Click on a node to view details</p>
              )}
            </div>

            {/* Graph Stats */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-fg">Graph Statistics</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-fg-muted">Total Concepts:</span>
                  <span className="font-semibold">{nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-muted">Dependencies:</span>
                  <span className="font-semibold">{edges.length}</span>
                </div>
              </div>
            </div>

            {/* Learning Path Hint */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-2 text-sm font-semibold text-fg">Learning Path</div>
              <p className="text-xs text-fg-muted leading-relaxed">
                Follow the arrows from top to bottom. Start with prerequisites (orange), master the core concept (blue), then explore next topics (green).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
