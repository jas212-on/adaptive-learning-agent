import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { HelpCircle, Sparkles } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'

export default function Questions() {
  const { topic } = useOutletContext()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setError(null)
  }, [topic.id])

  const count = useMemo(() => data?.questions?.length || 0, [data])

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.generateQuestions(topic.id)
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to generate questions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">Generate topic-specific questions (MCQ/short answers later).</div>
        <Button onClick={run} disabled={loading}>
          {loading ? <Spinner /> : <Sparkles size={18} />}
          Generate
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      {data ? (
        <div className="space-y-3">
          <div className="text-sm text-fg-muted">Generated {count} questions.</div>
          {data.questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HelpCircle size={16} /> Q{idx + 1}
              </div>
              <div className="mt-2 text-sm">{q.prompt}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, i) => (
                  <div key={c} className="rounded-xl border bg-bg-muted px-3 py-2 text-sm">
                    {String.fromCharCode(65 + i)}. {c}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-fg-muted">Skill: {q.skill}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-fg-muted">Generate to see dummy questions.</div>
      )}
    </div>
  )
}
