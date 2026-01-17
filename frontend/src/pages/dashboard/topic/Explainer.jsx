import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Lightbulb } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'

export default function Explainer() {
  const { topic, subtopicId, setStepComplete } = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setError(null)
  }, [topic.id, subtopicId])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.explainTopic(topic.id, { subtopicId })
      setData(res)
      setStepComplete?.('explainer', true)
    } catch (err) {
      setError(err?.message || 'Failed to generate explainer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">
          The explainer goes beyond detected snippets (structure + mental models).
        </div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Spinner /> : <Lightbulb size={18} />}
          Generate explainer
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      {data ? (
        <div className="space-y-4">
          <div className="rounded-xl border bg-bg-muted p-4">
            <div className="text-sm font-semibold">Overview</div>
            <div className="mt-2 text-sm text-fg-muted">{data.overview}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">Prerequisites</div>
              <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                {(data.prerequisites || []).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">Key ideas</div>
              <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                {(data.keyIdeas || []).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">Pitfalls</div>
              <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                {(data.pitfalls || []).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
          </div>

          
        </div>
      ) : (
        <div className="text-sm text-fg-muted">Click “Generate explainer” to fetch the explainer via Gemini.</div>
      )}
    </div>
  )
}
