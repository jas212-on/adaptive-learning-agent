import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ExternalLink, Library } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'

export default function Resources() {
  const { topic, subtopicId } = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setError(null)
  }, [topic.id])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.suggestResources(topic.id, { subtopicId })
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">Curated resources for mastering the topic.</div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Spinner /> : <Library size={18} />}
          Load resources
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      {data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.resources.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border bg-card p-4 hover:bg-bg-muted"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{r.title}</div>
                  <div className="text-xs text-fg-muted">
                    {r.type}{r.source ? ` • ${r.source}` : ''}
                  </div>
                </div>
                <ExternalLink size={16} />
              </div>
              {r.snippet ? <div className="mt-2 text-xs text-fg-muted">{r.snippet}</div> : null}
            </a>
          ))}
        </div>
      ) : (
        <div className="text-sm text-fg-muted">Load to view dummy links (replace with real suggestions later).</div>
      )}
    </div>
  )
}
