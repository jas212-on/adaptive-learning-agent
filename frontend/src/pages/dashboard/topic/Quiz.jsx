import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'

function computeLevel(scorePct) {
  if (scorePct >= 85) return 'advanced'
  if (scorePct >= 60) return 'intermediate'
  return 'beginner'
}

export default function Quiz() {
  const { topic } = useOutletContext()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setAnswers({})
    setSubmitted(false)
    setError(null)
  }, [topic.id])

  async function loadQuiz() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.generateQuestions(topic.id)
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  const result = useMemo(() => {
    if (!submitted || !data) return null
    const qs = data.questions || []
    const total = qs.length
    const wrongSkills = []
    let correct = 0
    for (const q of qs) {
      const chosen = answers[q.id]
      if (chosen === q.answerIndex) correct += 1
      else wrongSkills.push(q.skill)
    }
    const pct = total ? Math.round((correct / total) * 100) : 0
    const weakAreas = Array.from(
      wrongSkills.reduce((acc, s) => acc.set(s, (acc.get(s) || 0) + 1), new Map()),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([skill]) => skill)

    return {
      total,
      correct,
      pct,
      inferredLevel: computeLevel(pct),
      weakAreas,
    }
  }, [submitted, data, answers])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">
          Take a quick quiz; we’ll infer knowledge level and weak areas.
        </div>
        <Button onClick={loadQuiz} disabled={loading}>
          {loading ? <Spinner /> : <CheckCircle2 size={18} />}
          Load quiz
        </Button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      {data ? (
        <div className="space-y-4">
          {data.questions.map((q, idx) => (
            <div key={q.id} className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">
                Q{idx + 1}. <span className="font-normal">{q.prompt}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.choices.map((c, i) => {
                  const checked = answers[q.id] === i
                  return (
                    <label
                      key={c}
                      className={
                        'flex cursor-pointer items-center gap-2 rounded-xl border bg-bg-muted px-3 py-2 text-sm hover:bg-bg-muted/70'
                      }
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={checked}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                      />
                      <span>
                        {String.fromCharCode(65 + i)}. {c}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setSubmitted(true)}
              disabled={submitted || Object.keys(answers).length < (data.questions?.length || 0)}
            >
              Submit
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAnswers({})
                setSubmitted(false)
              }}
            >
              Reset
            </Button>
          </div>

          {result ? (
            <div className="rounded-xl border bg-bg-muted p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert size={16} /> Result
              </div>
              <div className="mt-2 grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-xs text-fg-muted">Score</div>
                  <div className="text-lg font-semibold">{result.pct}%</div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted">Correct</div>
                  <div className="text-lg font-semibold">
                    {result.correct}/{result.total}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted">Inferred level</div>
                  <div className="text-lg font-semibold">{result.inferredLevel}</div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted">Weak areas</div>
                  <div className="text-sm font-medium">
                    {result.weakAreas.length ? result.weakAreas.join(', ') : 'None detected'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-sm text-fg-muted">Load quiz to answer dummy questions.</div>
      )}
    </div>
  )
}
