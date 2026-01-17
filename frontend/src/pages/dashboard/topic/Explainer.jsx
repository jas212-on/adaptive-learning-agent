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
        <div className="text-sm font-light text-white/50">
          The explainer goes beyond detected snippets (structure + mental models).
        </div>
        <Button
          className="rounded-xl bg-white text-black hover:bg-white/90"
          onClick={run}
          disabled={loading}
        >
          {loading ? <Spinner /> : <Lightbulb size={18} />}
          Generate explainer
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div> : null}

      {data ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">Overview</div>
            <div className="mt-2 text-sm font-light text-white/60">{data.overview}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Prerequisites</div>
              <ul className="mt-2 space-y-1 text-sm font-light text-white/60">
                {(data.prerequisites || []).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Key ideas</div>
              <ul className="mt-2 space-y-1 text-sm font-light text-white/60">
                {(data.keyIdeas || []).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold text-white">Pitfalls</div>
              <ul className="mt-2 space-y-1 text-sm font-light text-white/60">
                {(data.pitfalls || []).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
          </div>

          
        </div>
      ) : (
        <div className="text-sm font-light text-white/40">Click "Generate explainer" to fetch the explainer via Gemini.</div>
      )}
    </div>
  )
}
