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
        <div className="text-sm font-light text-white/50">Generate topic-specific questions (MCQ/short answers later).</div>
        <Button
          className="rounded-xl bg-white text-black hover:bg-white/90"
          onClick={run}
          disabled={loading}
        >
          {loading ? <Spinner /> : <Sparkles size={18} />}
          Generate
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div> : null}

      {data ? (
        <div className="space-y-3">
          <div className="text-sm text-white/60">Generated {count} questions.</div>
          {data.questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <HelpCircle size={16} /> Q{idx + 1}
              </div>
              <div className="mt-2 text-sm text-white/80">{q.prompt}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, i) => (
                  <div key={c} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                    {String.fromCharCode(65 + i)}. {c}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs font-light text-white/40">Skill: {q.skill}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm font-light text-white/40">Generate to see dummy questions.</div>
      )}
    </div>
  )
}
