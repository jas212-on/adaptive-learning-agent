import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Route } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent } from '../../../components/ui/Card'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'
import {
  ensureModule,
  getRoadmapProgress,
  moduleCompletion,
} from '../../../features/roadmap/progress'

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function RoadmapIndex() {
  const { topic } = useOutletContext()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(() => getRoadmapProgress(topic.id))

  useEffect(() => {
    setProgress(getRoadmapProgress(topic.id))
  }, [topic.id])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.generateRoadmap(topic.id, topic.level || 'intermediate')
        if (!mounted) return
        setData(res)
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load roadmap')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [topic.id, topic.level])

  const modules = useMemo(() => {
    const steps = data?.steps || []
    return steps.map((s, idx) => ({
      id: slugify(s.title) || `module-${idx + 1}`,
      title: s.title,
      items: s.items || [],
    }))
  }, [data])

  const overall = useMemo(() => {
    if (!modules.length) return 0
    const pct =
      modules.reduce((acc, m) => acc + moduleCompletion(ensureModule(progress, m.id)), 0) /
      modules.length
    return pct
  }, [modules, progress])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Loading roadmap…
      </div>
    )
  }

  if (error) return <div className="text-sm text-red-500">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">
          Complete modules to master the topic. Each module contains explainer, resources, questions, and a quiz.
        </div>
        <Badge className="bg-bg-muted text-fg">Overall: {Math.round(overall * 100)}%</Badge>
      </div>

      <div className="space-y-3">
        {modules.map((m, index) => {
          const st = ensureModule(progress, m.id)
          const pct = moduleCompletion(st)
          const done = pct >= 1

          return (
            <Link key={m.id} to={`../roadmap/${m.id}`} className="block">
              <Card className="overflow-hidden transition hover:bg-bg-muted/50">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {done ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <Route size={18} className="text-fg-muted" />
                        )}
                        <div className="truncate text-sm font-semibold">
                          Module {index + 1}: {m.title}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-fg-muted">
                        {m.items.length ? m.items[0] : 'Open to start the module.'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium">
                      {Math.round(pct * 100)}%
                      <ChevronRight size={16} className="text-fg-muted" />
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full rounded-full bg-border">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="text-xs text-fg-muted">
        Tip: As you finish a module’s steps, its bar shifts towards green.
      </div>
    </div>
  )
}
