import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, XCircle, Timer, RotateCcw, Zap, BookOpen, TrendingUp } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import * as api from '../../../services/api'

const QUIZ_DURATION_SECONDS = 90

const DIFFICULTY_LABELS = {
  easy: { label: 'Easy', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  medium: { label: 'Medium', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  hard: { label: 'Hard', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  expert: { label: 'Expert', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
}

function computeLevel(scorePct) {
  if (scorePct >= 85) return 'Advanced'
  if (scorePct >= 60) return 'Intermediate'
  return 'Beginner'
}

function levelColor(level) {
  if (level === 'Advanced') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
  if (level === 'Intermediate') return 'text-amber-400 border-amber-500/30 bg-amber-500/10'
  return 'text-red-400 border-red-500/30 bg-red-500/10'
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Quiz() {
  const { topic, subtopicId, setStepComplete } = useOutletContext()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [error, setError] = useState(null)

  // Timer state
  const [timedMode, setTimedMode] = useState(false)
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION_SECONDS)
  const [timerActive, setTimerActive] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const timerRef = useRef(null)
  const startTimeRef = useRef(null)

  // Difficulty state
  const [selectedDifficulty, setSelectedDifficulty] = useState('auto')
  const [currentDifficulty, setCurrentDifficulty] = useState(null)

  useEffect(() => {
    setData(null)
    setAnswers({})
    setSubmitted(false)
    setSubmitResult(null)
    setError(null)
    setTimeLeft(QUIZ_DURATION_SECONDS)
    setTimerActive(false)
    setElapsedSeconds(0)
    setCurrentDifficulty(null)
    clearInterval(timerRef.current)
  }, [topic.id, subtopicId])

  // Timer tick
  useEffect(() => {
    if (!timerActive) return
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setTimerActive(false)
          submitAttemptRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  const submitAttemptRef = useRef(null)

  async function loadQuiz() {
    setLoading(true)
    setError(null)
    setAnswers({})
    setSubmitted(false)
    setSubmitResult(null)
    setTimeLeft(QUIZ_DURATION_SECONDS)
    setElapsedSeconds(0)
    clearInterval(timerRef.current)
    try {
      const res = await api.generateQuestions(topic.id, {
        subtopicId,
        nQuestions: 5,
        difficulty: selectedDifficulty,
      })
      setData(res)
      setCurrentDifficulty(res.difficulty || selectedDifficulty)
      if (timedMode) {
        startTimeRef.current = Date.now()
        setTimerActive(true)
      }
    } catch (err) {
      setError(err?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  async function submitAttempt(autoSubmit = false) {
    if (!data?.questions?.length) return
    clearInterval(timerRef.current)
    setTimerActive(false)

    const elapsed = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : QUIZ_DURATION_SECONDS - timeLeft
    setElapsedSeconds(elapsed)

    setLoading(true)
    setError(null)
    try {
      const total = data.questions.length
      const orderedAnswers = Array.from({ length: total }, (_, i) =>
        answers[i] !== undefined ? answers[i] : null,
      )
      const res = await api.submitQuizAttempt(topic.id, {
        subtopicId,
        answers: orderedAnswers,
        clientTime: elapsed,
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

  submitAttemptRef.current = () => submitAttempt(true)

  async function tryAgain() {
    setAnswers({})
    setSubmitted(false)
    setSubmitResult(null)
    setTimeLeft(QUIZ_DURATION_SECONDS)
    setElapsedSeconds(0)
    setLoading(true)
    setError(null)
    try {
      const res = await api.generateQuestions(topic.id, {
        subtopicId,
        nQuestions: 5,
        force: false,
        difficulty: selectedDifficulty,
      })
      setData(res)
      setCurrentDifficulty(res.difficulty || selectedDifficulty)
      if (timedMode) {
        startTimeRef.current = Date.now()
        setTimerActive(true)
      }
    } catch (err) {
      setError(err?.message || 'Failed to load quiz')
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
      masteryPct: submitResult.masteryPct || 0,
    }
  }, [submitted, submitResult])

  function getQuestionResult(idx) {
    if (!submitResult?.questions) return null
    return submitResult.questions[idx] || null
  }

  const timerPct = (timeLeft / QUIZ_DURATION_SECONDS) * 100
  const timerColor =
    timeLeft > 30 ? 'bg-indigo-500' : timeLeft > 10 ? 'bg-amber-500' : 'bg-red-500'

  const allAnswered =
    data &&
    Object.keys(answers).length === data.questions?.length &&
    !Object.values(answers).some((v) => v === undefined || v === null)

  const diffInfo = DIFFICULTY_LABELS[currentDifficulty] || DIFFICULTY_LABELS.medium

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-light text-white/50">
          Take a quick quiz for this subtopic; we'll infer knowledge level and weak areas.
        </div>
        <div className="flex items-center gap-2">
          {/* Difficulty selector — only before quiz starts */}
          {!data && (
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-xs text-white/60 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            >
              <option value="auto">Auto Difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          )}
          {/* Timed toggle — only before quiz starts */}
          {!data && (
            <button
              onClick={() => setTimedMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                timedMode
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                  : 'border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/60'
              }`}
            >
              <Timer size={12} />
              Timed {timedMode ? 'On' : 'Off'}
            </button>
          )}
          <Button
            className="rounded-xl bg-white text-black hover:bg-white/90"
            onClick={loadQuiz}
            disabled={loading}
          >
            {loading ? <Spinner /> : <CheckCircle2 size={18} />}
            Load quiz
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      {/* Difficulty badge + Timer bar */}
      {data && (
        <div className="flex items-center gap-3">
          {currentDifficulty && currentDifficulty !== 'auto' && (
            <span
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-xs font-medium ${diffInfo.color}`}
            >
              <Zap size={10} />
              {diffInfo.label}
            </span>
          )}
          {data.questions?.length > 0 && (
            <span className="text-[11px] text-white/30">
              {data.questions.length} questions
            </span>
          )}
        </div>
      )}

      {/* Timer bar */}
      {data && timedMode && !submitted && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-white/25">
              Time Remaining
            </span>
            <span
              className={`font-mono text-sm font-medium ${
                timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-amber-400' : 'text-white/70'
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-1.5 rounded-full transition-all duration-1000 ${timerColor}`}
              style={{ width: `${timerPct}%` }}
            />
          </div>
        </div>
      )}

      {data ? (
        <div className="space-y-4">
          {/* Result summary card */}
          {result ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="text-[11px] font-medium uppercase tracking-widest text-white/25">
                  Result
                </div>
                <span
                  className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${levelColor(result.inferredLevel)}`}
                >
                  {result.inferredLevel}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-widest text-white/25">Score</div>
                  <div className="mt-1 text-2xl font-light text-white">{result.pct}%</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-widest text-white/25">Correct</div>
                  <div className="mt-1 text-2xl font-light text-white">
                    {result.correct}/{result.total}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-widest text-white/25">
                    <TrendingUp size={10} className="inline mr-1" />Mastery
                  </div>
                  <div className="mt-1 text-2xl font-light text-white">{result.masteryPct}%</div>
                </div>
                {timedMode && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-widest text-white/25">
                      Time used
                    </div>
                    <div className="mt-1 text-2xl font-light text-white">
                      {formatTime(elapsedSeconds)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Questions */}
          {data.questions.map((q, idx) => {
            const qResult = submitted ? getQuestionResult(idx) : null
            const chosenIdx = answers[idx]
            const correctIdx = qResult?.correct_index

            return (
              <div
                key={idx}
                className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <div className="flex items-start gap-2 text-sm">
                  {submitted && qResult && (
                    <span className="mt-0.5 flex-shrink-0">
                      {qResult.correct ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )}
                    </span>
                  )}
                  <span className="font-semibold text-white">
                    Q{idx + 1}.{' '}
                    <span className="font-normal text-white/80">{q.question}</span>
                  </span>
                </div>
                {/* Difficulty + skill badges */}
                {(q.difficulty || q.skill) && !submitted && (
                  <div className="mt-1.5 flex gap-1.5">
                    {q.difficulty && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/[0.06] text-white/30">
                        {q.difficulty}
                      </span>
                    )}
                    {q.skill && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/[0.06] text-white/30">
                        {q.skill}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((c, i) => {
                    const checked = chosenIdx === i
                    let optionCls =
                      'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition '
                    if (submitted) {
                      if (i === correctIdx) {
                        optionCls += checked
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                          : 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400/70'
                      } else if (checked) {
                        optionCls += 'border-red-500/50 bg-red-500/10 text-red-300'
                      } else {
                        optionCls += 'border-white/[0.07] bg-white/[0.02] text-white/40 cursor-default'
                      }
                    } else {
                      optionCls += checked
                        ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                        : 'border-white/[0.07] bg-white/[0.02] text-white/70 hover:bg-white/[0.05]'
                    }
                    return (
                      <label key={c} className={optionCls}>
                        <input
                          type="radio"
                          name={`q_${idx}`}
                          checked={checked}
                          onChange={() => {
                            if (submitted) return
                            setAnswers((a) => ({ ...a, [idx]: i }))
                          }}
                          disabled={submitted}
                          className="accent-indigo-500"
                        />
                        <span>
                          {String.fromCharCode(65 + i)}. {c}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {/* Explanation for wrong answers */}
                {submitted && qResult && !qResult.correct && qResult.explanation && (
                  <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
                    <div className="flex items-start gap-2">
                      <BookOpen size={14} className="mt-0.5 text-amber-400/70 flex-shrink-0" />
                      <p className="text-xs text-white/60">{qResult.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2">
            {!submitted ? (
              <>
                <Button
                  className="rounded-xl bg-white text-black hover:bg-white/90"
                  onClick={() => submitAttempt(false)}
                  disabled={!allAnswered || loading}
                >
                  Submit
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] text-white/80 hover:bg-white/[0.05]"
                  onClick={() => {
                    setAnswers({})
                    setSubmitted(false)
                    setSubmitResult(null)
                  }}
                >
                  Reset
                </Button>
              </>
            ) : (
              <Button
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] text-white/70 hover:bg-white/[0.05]"
                onClick={tryAgain}
                disabled={loading}
              >
                <RotateCcw size={15} />
                Try Again
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm font-light text-white/40">
          {timedMode
            ? "Timed mode on — you'll have 90 seconds once the quiz loads."
            : 'Load quiz to answer questions about this subtopic.'}
        </div>
      )}
    </div>
  )
}
