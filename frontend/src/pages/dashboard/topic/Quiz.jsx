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
  const { topic, subtopicId, setStepComplete } = useOutletContext()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    setData(null)
    setAnswers({})
    setSubmitted(false)
    setSubmitResult(null)
    setError(null)
  }, [topic.id, subtopicId])

  async function loadQuiz() {
    setLoading(true)
    setError(null)
    setAnswers({})
    setSubmitted(false)
    setSubmitResult(null)
    try {
      const res = await api.generateQuestions(topic.id, { subtopicId, nQuestions: 5 })
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  async function submitAttempt() {
    if (!data?.questions?.length) return
    setLoading(true)
    setError(null)
    try {
      const total = data.questions.length
      const orderedAnswers = Array.from({ length: total }, (_, i) => answers[i])
      const res = await api.submitQuizAttempt(topic.id, {
        subtopicId,
        answers: orderedAnswers,
        clientTime: new Date().toISOString(),
      })
      setSubmitResult(res)
      setSubmitted(true)

      const correct = res?.correctCount ?? 0
      const passed = correct >= 4
      setStepComplete?.('quiz', passed)
    } catch (err) {
      setError(err?.message || 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  const result = useMemo(() => {
    if (!submitted || !submitResult) return null
    const total = submitResult.total || 0
    const correct = submitResult.correctCount || 0
    const pct = submitResult.scorePct || 0
    return {
      total,
      correct,
      pct,
      inferredLevel: computeLevel(pct),
    }
  }, [submitted, submitResult])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-fg-muted">
          Take a quick quiz for this subtopic; we’ll infer knowledge level and weak areas.
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
            <div key={idx} className="rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">
                Q{idx + 1}. <span className="font-normal">{q.question}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((c, i) => {
                  const checked = answers[idx] === i
                  return (
                    <label
                      key={c}
                      className={
                        'flex cursor-pointer items-center gap-2 rounded-xl border bg-bg-muted px-3 py-2 text-sm hover:bg-bg-muted/70'
                      }
                    >
                      <input
                        type="radio"
                        name={`q_${idx}`}
                        checked={checked}
                        onChange={() => setAnswers((a) => ({ ...a, [idx]: i }))}
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
              onClick={submitAttempt}
              disabled={
                submitted ||
                Object.keys(answers).length < (data.questions?.length || 0) ||
                Object.values(answers).some((v) => v === undefined || v === null)
              }
            >
              Submit
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setAnswers({})
                setSubmitted(false)
                setSubmitResult(null)
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
