import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import * as api from '../../services/api'

function layout(nodes) {
  // Simple fixed layout (professional enough for a prototype; replace with real graph layout later).
  const kindOrder = { prereq: 0, core: 1, next: 2 }
  const groups = nodes.reduce((acc, n) => {
    const k = n.kind || 'core'
    acc[k] = acc[k] || []
    acc[k].push(n)
    return acc
  }, {})

  const columns = Object.keys(groups).sort((a, b) => (kindOrder[a] ?? 99) - (kindOrder[b] ?? 99))
  const pos = new Map()

  const colX = [140, 360, 580]
  columns.forEach((col, ci) => {
    const list = groups[col]
    list.forEach((n, i) => {
      pos.set(n.id, { x: colX[ci] || 360, y: 120 + i * 110 })
    })
  })

  return pos
}

export default function DependencyGraph() {
  const [params] = useSearchParams()
  const topicId = params.get('topic') || 'react-hooks'

  const [loading, setLoading] = useState(true)
  const [graph, setGraph] = useState(null)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getConceptGraph(topicId)
        if (!mounted) return
        setGraph(res)
        setSelected(res.nodes.find((n) => n.kind === 'core')?.id || res.nodes[0]?.id)
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load graph')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [topicId])

  const pos = useMemo(() => (graph ? layout(graph.nodes) : new Map()), [graph])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Loading concept graph…
      </div>
    )
  }

  if (error) return <div className="text-sm text-red-500">{error}</div>

  const selectedNode = graph.nodes.find((n) => n.id === selected)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network size={18} /> Concept Dependency Graph
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border bg-bg-muted p-3">
              <svg viewBox="0 0 720 460" className="h-[460px] w-full">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--fg-muted))" />
                  </marker>
                </defs>

                {graph.edges.map((e, idx) => {
                  const a = pos.get(e.from)
                  const b = pos.get(e.to)
                  if (!a || !b) return null
                  return (
                    <line
                      key={idx}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="hsl(var(--fg-muted))"
                      strokeWidth="2"
                      markerEnd="url(#arrow)"
                      opacity="0.7"
                    />
                  )
                })}

                {graph.nodes.map((n) => {
                  const p = pos.get(n.id)
                  const active = n.id === selected
                  if (!p) return null
                  return (
                    <g key={n.id} onClick={() => setSelected(n.id)} style={{ cursor: 'pointer' }}>
                      <rect
                        x={p.x - 110}
                        y={p.y - 28}
                        width="220"
                        height="56"
                        rx="16"
                        fill={active ? 'hsl(var(--card))' : 'hsl(var(--bg))'}
                        stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                        strokeWidth={active ? 2.5 : 2}
                      />
                      <text x={p.x} y={p.y + 5} textAnchor="middle" fill="hsl(var(--fg))" fontSize="14" fontFamily="ui-sans-serif, system-ui">
                        {n.label}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>

            <div className="mt-3 text-xs text-fg-muted">
              Prototype graph UI. Later: auto-layout + interactive expand/collapse + concept mastery states.
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">Selected concept</div>
              <div className="mt-2 text-sm">{selectedNode?.label}</div>
              <div className="mt-1 text-xs text-fg-muted">Kind: {selectedNode?.kind}</div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">Navigation hints</div>
              <div className="mt-2 space-y-2 text-sm text-fg-muted">
                <div className={cn('rounded-xl border bg-bg-muted p-3')}>Learn prerequisites first → then core concept → then next topics.</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
