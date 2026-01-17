import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Route, Network } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import * as api from '../../services/api'

function levelVariant(level) {
  if (level === 'beginner') return 'success'
  if (level === 'intermediate') return 'primary'
  if (level === 'advanced') return 'warning'
  return 'neutral'
}

const tabs = [
  { to: 'detected', label: 'Detected topic', icon: FileText },
  { to: 'roadmap', label: 'Roadmap', icon: Route },
]

export default function TopicDetails() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getTopic(topicId)
        if (!mounted) return
        setTopic(res)
      } catch (err) {
        if (!mounted) return
        setError(err?.message || 'Failed to load topic')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [topicId])

  const headerRight = useMemo(() => {
    if (!topic) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={levelVariant(topic.level)}>{topic.level}</Badge>
        <Badge className="bg-bg-muted text-fg">
          {topic.confidence === null || topic.confidence === undefined
            ? 'Confidence: —'
            : `${Math.round(topic.confidence * 100)}% confidence`}
        </Badge>
      </div>
    )
  }, [topic])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Spinner /> Loading topic…
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Topic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-500">{error}</div>
          <div className="mt-4">
            <Link to="/dashboard/topics" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              <ArrowLeft size={16} /> Back to topics
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-bg-muted"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {headerRight}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <CardTitle className="truncate">{topic.title}</CardTitle>
            <div className="mt-1 text-sm text-fg-muted">
              Two views: what was detected, and a subtopic roadmap to master it.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(topic.tags || []).map((t) => (
              <Badge key={t} className="bg-bg-muted text-fg">
                {t}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-bg-muted',
                    isActive && 'bg-bg-muted',
                  )
                }
              >
                <t.icon size={16} />
                {t.label}
              </NavLink>
            ))}
            <Link
              to={`/dashboard/dependency-graph?topic=${topicId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
            >
              <Network size={16} />
              View Graph
            </Link>
          </div>

          <div className="mt-4">
            <Outlet context={{ topic }} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
