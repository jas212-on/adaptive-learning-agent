import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Flag, Sparkles } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'

export default function Roadmap() {
  const { topic } = useOutletContext()
  const [level, setLevel] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setError(null)
  }, [topic.id])

  const levels = useMemo(() => ['beginner', 'intermediate', 'advanced'], [])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.generateRoadmap(topic.id, level)
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to generate roadmap')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-fg-muted">
          Generate a structured mastery roadmap. This will later use your real model + user profile.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="h-10 rounded-xl border bg-card px-3 text-sm"
          >
            {levels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <Button onClick={run} disabled={loading}>
            {loading ? <Spinner /> : <Sparkles size={18} />}
            Generate roadmap
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      {data ? (
        <div className="grid gap-3 md:grid-cols-3">
          {data.steps.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Flag size={16} /> {s.title}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                {s.items.map((i) => (
                  <li key={i}>• {i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-fg-muted">Generate a roadmap to see dummy steps.</div>
      )}
    </div>
  )
}
