import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  Library,
  Lightbulb,
  ListChecks,
  Route,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Spinner } from '../../../components/ui/Spinner'
import {
  ensureModule,
  getRoadmapProgress,
  moduleCompletion,
  setRoadmapProgress,
} from '../../../features/roadmap/progress'
import * as api from '../../../services/api'

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function computeLevel(scorePct) {
  if (scorePct >= 85) return 'advanced'
  if (scorePct >= 60) return 'intermediate'
  return 'beginner'
}

// Collapsible card component for each learning section
function LearningCard({ title, icon: Icon, isComplete, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-white/50" />
          <span className="text-sm font-medium text-white">{title}</span>
          {isComplete && <CheckCircle2 size={14} className="text-emerald-400" />}
        </div>
        {isOpen ? (
          <ChevronDown size={16} className="text-white/40" />
        ) : (
          <ChevronRight size={16} className="text-white/40" />
        )}
      </button>
      {isOpen && <div className="border-t border-white/10 p-4">{children}</div>}
    </div>
  )
}

// Explainer section component
function ExplainerSection({ topic, subtopicId, moduleState, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.explainTopic(topic.id, { subtopicId })
      setData(res)
      onComplete?.('explainer', true)
    } catch (err) {
      setError(err?.message || 'Failed to generate explainer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LearningCard title="Explainer" icon={BookOpen} isComplete={moduleState.explainer}>
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
            {loading ? <Spinner /> : <Lightbulb size={16} />}
            Generate
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
        )}

        {data ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold text-white/70">Overview</div>
              <div className="mt-1 text-sm font-light text-white/60">{data.overview}</div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs font-semibold text-white/70">Prerequisites</div>
                <ul className="mt-1 space-y-0.5 text-xs font-light text-white/50">
                  {(data.prerequisites || []).map((b) => <li key={b}>• {b}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs font-semibold text-white/70">Key ideas</div>
                <ul className="mt-1 space-y-0.5 text-xs font-light text-white/50">
                  {(data.keyIdeas || []).map((b) => <li key={b}>• {b}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-xs font-semibold text-white/70">Pitfalls</div>
                <ul className="mt-1 space-y-0.5 text-xs font-light text-white/50">
                  {(data.pitfalls || []).map((b) => <li key={b}>• {b}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm font-light text-white/40">Click "Generate" to fetch the explainer.</div>
        )}
      </div>
    </LearningCard>
  )
}

// Resources section component
function ResourcesSection({ topic, subtopicId, moduleState, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.suggestResources(topic.id, { subtopicId })
      setData(res)
      onComplete?.('resources', true)
    } catch (err) {
      setError(err?.message || 'Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  return (
    <LearningCard title="Resources" icon={Compass} isComplete={moduleState.resources}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-light text-white/50">Curated resources for mastering this subtopic.</div>
          <Button
            className="rounded-xl bg-white text-black hover:bg-white/90"
            onClick={run}
            disabled={loading}
          >
            {loading ? <Spinner /> : <Library size={16} />}
            Load
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
        )}

        {data ? (
          <div className="grid gap-2 md:grid-cols-2">
            {data.resources.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-white">{r.title}</div>
                    <div className="text-xs font-light text-white/50">
                      {r.type}{r.source ? ` • ${r.source}` : ''}
                    </div>
                  </div>
                  <ExternalLink size={14} className="text-white/40 group-hover:text-white/70" />
                </div>
                {r.snippet && <div className="mt-1 text-xs font-light text-white/40">{r.snippet}</div>}
              </a>
            ))}
          </div>
        ) : (
          <div className="text-sm font-light text-white/40">Load to view curated resources.</div>
        )}
      </div>
    </LearningCard>
  )
}

// Quiz section component
function QuizSection({ topic, subtopicId, moduleState, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)
  const [error, setError] = useState(null)

  async function loadQuiz() {
    setLoading(true)
    setError(null)
    setAnswers({})
    setSubmitted(false)
    setSubmitResult(null)
    try {
      const res = await api.generateQuiz(topic.id, { subtopicId, nQuestions: 5 })
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
      onComplete?.('quiz', passed)
    } catch (err) {
      setError(err?.message || 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  const result = useMemo(() => {
    if (!submitted || !submitResult) return null
    return {
      total: submitResult.total || 0,
      correct: submitResult.correctCount || 0,
      pct: submitResult.scorePct || 0,
      inferredLevel: computeLevel(submitResult.scorePct || 0),
    }
  }, [submitted, submitResult])

  return (
    <LearningCard title="Quiz" icon={ListChecks} isComplete={moduleState.quiz}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-light text-white/50">
            Take a quiz to verify understanding and track progress.
          </div>
          <Button
            className="rounded-xl bg-white text-black hover:bg-white/90"
            onClick={loadQuiz}
            disabled={loading}
          >
            {loading ? <Spinner /> : <CheckCircle2 size={16} />}
            Load quiz
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
        )}

        {data ? (
          <div className="space-y-3">
            {data.questions.map((q, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-sm font-medium text-white">
                  Q{idx + 1}. <span className="font-normal text-white/80">{q.question}</span>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((c, i) => {
                    const checked = answers[idx] === i
                    return (
                      <label
                        key={c}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
                          checked
                            ? 'border-indigo-500/50 bg-indigo-500/15 text-white'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`quiz_${subtopicId}_q${idx}`}
                          checked={checked}
                          onChange={() => setAnswers((a) => ({ ...a, [idx]: i }))}
                          className="accent-indigo-500"
                        />
                        <span>{String.fromCharCode(65 + i)}. {c}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-xl bg-white text-black hover:bg-white/90"
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
                className="rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                onClick={() => {
                  setAnswers({})
                  setSubmitted(false)
                  setSubmitResult(null)
                }}
              >
                Reset
              </Button>
            </div>

            {result && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <ShieldAlert size={14} /> Result
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-white/50">Score</div>
                    <div className="text-base font-semibold text-white">{result.pct}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50">Correct</div>
                    <div className="text-base font-semibold text-white">{result.correct}/{result.total}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/50">Inferred level</div>
                    <div className="text-base font-semibold text-white">{result.inferredLevel}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm font-light text-white/40">Load quiz to test your understanding.</div>
        )}
      </div>
    </LearningCard>
  )
}

// Subtopic accordion item
function SubtopicAccordion({ topic, subtopic, index, progress, setProgress, isExpanded, onToggle }) {
  const moduleState = useMemo(() => ensureModule(progress, subtopic.id), [progress, subtopic.id])
  const pct = useMemo(() => moduleCompletion(moduleState), [moduleState])
  const done = pct >= 1

  function handleStepComplete(stepKey, value) {
    const next = { ...progress }
    const current = ensureModule(next, subtopic.id)
    next[subtopic.id] = { ...current, [stepKey]: !!value }
    setRoadmapProgress(topic.id, next)
    setProgress(next)
  }

  function resetModule() {
    const next = { ...progress }
    next[subtopic.id] = { explainer: false, resources: false, questions: false, quiz: false }
    setRoadmapProgress(topic.id, next)
    setProgress(next)
  }

  const handleToggleClick = () => {
    onToggle?.(!isExpanded)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* Accordion header */}
      <button
        onClick={handleToggleClick}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-3 min-w-0">
          {done ? (
            <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          ) : (
            <Route size={20} className="shrink-0 text-white/40" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {index + 1}. {subtopic.title}
            </div>
            <div className="text-xs text-white/40">
              {done ? 'Completed' : `${Math.round(pct * 100)}% complete`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block w-24 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
              style={{ width: `${Math.round(pct * 100)}%` }}
            />
          </div>
          {isExpanded ? (
            <ChevronDown size={18} className="text-white/40" />
          ) : (
            <ChevronRight size={18} className="text-white/40" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-3">
          {/* Progress bar and reset */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.round(pct * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border border-white/10 bg-white/5 text-white/70 text-xs">
                {Math.round(pct * 100)}%
              </Badge>
              <Button
                variant="secondary"
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/50 hover:bg-white/10 hover:text-white/70"
                onClick={(e) => {
                  e.stopPropagation()
                  resetModule()
                }}
                title="Reset progress"
              >
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>

          {/* Learning sections */}
          <div className="space-y-2">
            <ExplainerSection
              topic={topic}
              subtopicId={subtopic.id}
              moduleState={moduleState}
              onComplete={handleStepComplete}
            />
            <ResourcesSection
              topic={topic}
              subtopicId={subtopic.id}
              moduleState={moduleState}
              onComplete={handleStepComplete}
            />
            <QuizSection
              topic={topic}
              subtopicId={subtopic.id}
              moduleState={moduleState}
              onComplete={handleStepComplete}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function RoadmapIndex({ topic, activeModule, activeStep, onModuleChange }) {
  const [progress, setProgress] = useState(() => getRoadmapProgress(topic?.id))
  // Track which module is expanded (either from props or local state)
  const [localExpanded, setLocalExpanded] = useState(null)

  useEffect(() => {
    if (topic?.id) {
      setProgress(getRoadmapProgress(topic.id))
    }
  }, [topic?.id])

  // Expand the active module when it changes from props
  useEffect(() => {
    if (activeModule) {
      setLocalExpanded(activeModule)
    }
  }, [activeModule])

  const subtopics = useMemo(() => {
    const items = Array.isArray(topic?.subtopics) ? topic.subtopics : []
    return items
      .map((t, idx) => ({
        id: slugify(t) || `subtopic-${idx + 1}`,
        title: t,
      }))
      .filter((x) => x.id)
  }, [topic?.subtopics])

  const overall = useMemo(() => {
    if (!subtopics.length) return 0
    const pct =
      subtopics.reduce((acc, m) => acc + moduleCompletion(ensureModule(progress, m.id)), 0) /
      subtopics.length
    return pct
  }, [subtopics, progress])

  // Handle subtopic expansion with callback to parent
  const handleSubtopicToggle = (subtopicId, isExpanding) => {
    if (isExpanding) {
      setLocalExpanded(subtopicId)
      // Notify parent of module change
      onModuleChange?.(subtopicId, 'explainer')
    } else {
      setLocalExpanded(null)
      onModuleChange?.(null, null)
    }
  }

  if (!topic) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Spinner /> Loading topic...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-light text-white/50">
          Click a subtopic to expand and access explainer, resources, and quiz.
        </div>
        <Badge className="border border-white/10 bg-white/5 text-white/80">
          Overall: {Math.round(overall * 100)}%
        </Badge>
      </div>

      <div className="space-y-3">
        {!subtopics.length ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Spinner /> No subtopics yet. Keep detection running to collect them.
          </div>
        ) : (
          subtopics.map((m, index) => (
            <SubtopicAccordion
              key={m.id}
              topic={topic}
              subtopic={m}
              index={index}
              progress={progress}
              setProgress={setProgress}
              isExpanded={localExpanded === m.id}
              onToggle={(isExpanding) => handleSubtopicToggle(m.id, isExpanding)}
            />
          ))
        )}
      </div>

      <div className="text-xs font-light text-white/40">
        Tip: Complete explainer, resources, and quiz to finish each subtopic. Questions are optional.
      </div>
    </div>
  )
}
