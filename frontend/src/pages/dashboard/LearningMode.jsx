import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Compass,
  GraduationCap,
  Home,
  Library,
  Lightbulb,
  ListChecks,
  Play,
  X,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/Tabs'
import { Tooltip, TooltipProvider, tooltipContent } from '../../components/ui/Tooltip'
import {
  getRoadmapProgress,
  setRoadmapProgress,
  ensureModule,
  moduleCompletion,
} from '../../features/roadmap/progress'
import * as api from '../../services/api'

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Sidebar Module Item
function ModuleItem({ module, isActive, progress, onClick }) {
  const state = ensureModule(progress, module.id)
  const pct = moduleCompletion(state)
  const isComplete = pct >= 1

  return (
    <button
      onClick={onClick}
      className={`
        flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition
        ${isActive ? 'bg-indigo-500/20 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/80'}
      `}
    >
      {isComplete ? (
        <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
      ) : (
        <CircleDashed size={16} className="shrink-0 text-white/30" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{module.title}</div>
        <div className="text-xs text-white/40">{Math.round(pct * 100)}% complete</div>
      </div>
      {isActive && <ChevronRight size={14} className="text-white/40" />}
    </button>
  )
}

// Up Next Suggestion Card
function UpNextCard({ module, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]"
    >
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
        <Play size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{module.title}</div>
        <div className="text-xs text-white/50">Next up</div>
      </div>
    </button>
  )
}

// Step content components
function ExplainerContent({ topic, subtopicId, onComplete }) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Explainer</h3>
          <p className="text-sm text-white/50">Understand the concept with structure and mental models</p>
        </div>
        <Button
          className="rounded-xl bg-indigo-500 text-white hover:bg-indigo-600"
          onClick={run}
          disabled={loading}
        >
          {loading ? <Spinner /> : <Lightbulb size={16} />}
          Generate
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {data ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-sm font-semibold text-white/70 mb-2">Overview</h4>
            <p className="text-sm text-white/60 leading-relaxed">{data.overview}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-sm font-semibold text-white/70 mb-2">Prerequisites</h4>
              <ul className="space-y-1 text-sm text-white/50">
                {(data.prerequisites || []).map((b) => <li key={b}>• {b}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-sm font-semibold text-white/70 mb-2">Key Ideas</h4>
              <ul className="space-y-1 text-sm text-white/50">
                {(data.keyIdeas || []).map((b) => <li key={b}>• {b}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="text-sm font-semibold text-white/70 mb-2">Common Pitfalls</h4>
              <ul className="space-y-1 text-sm text-white/50">
                {(data.pitfalls || []).map((b) => <li key={b}>• {b}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
          <Lightbulb size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Click "Generate" to create the explainer content</p>
        </div>
      )}
    </div>
  )
}

function ResourcesContent({ topic, subtopicId, onComplete }) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Resources</h3>
          <p className="text-sm text-white/50">Curated learning materials</p>
        </div>
        <Button
          className="rounded-xl bg-indigo-500 text-white hover:bg-indigo-600"
          onClick={run}
          disabled={loading}
        >
          {loading ? <Spinner /> : <Library size={16} />}
          Load Resources
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {data ? (
        <div className="grid gap-3 md:grid-cols-2">
          {data.resources?.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium text-white group-hover:text-indigo-400">{r.title}</h4>
                  <p className="mt-1 text-sm text-white/50">{r.type}{r.source ? ` • ${r.source}` : ''}</p>
                </div>
                <Compass size={16} className="text-white/30 group-hover:text-indigo-400" />
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
          <Library size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Click "Load Resources" to fetch learning materials</p>
        </div>
      )}
    </div>
  )
}

function QuizContent({ topic, subtopicId, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)

  async function loadQuiz() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.generateQuiz(topic.id, { subtopicId })
      setData(res)
      setAnswers({})
      setSubmitted(false)
      setResult(null)
    } catch (err) {
      setError(err?.message || 'Failed to load quiz')
    } finally {
      setLoading(false)
    }
  }

  async function submitQuiz() {
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
      const correct = res?.correctCount ?? 0
      const pct = res?.scorePct ?? 0
      setResult({
        correct,
        total: res?.total ?? total,
        pct,
        inferredLevel: pct >= 85 ? 'advanced' : pct >= 60 ? 'intermediate' : 'beginner',
        graded: res?.graded || [],
      })
      setSubmitted(true)
      // Pass if score >= 60%
      if (pct >= 60) {
        onComplete?.('quiz', true)
      }
    } catch (err) {
      setError(err?.message || 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Knowledge Quiz</h3>
          <p className="text-sm text-white/50">Test your understanding</p>
        </div>
        <Button
          className="rounded-xl bg-indigo-500 text-white hover:bg-indigo-600"
          onClick={loadQuiz}
          disabled={loading}
        >
          {loading ? <Spinner /> : <ListChecks size={16} />}
          Load Quiz
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {data?.questions?.length > 0 ? (
        <div className="space-y-4">
          {data.questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-medium text-white mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[qi] === oi
                  const isCorrect = submitted && result?.graded?.[qi] && isSelected
                  const isWrong = submitted && isSelected && !result?.graded?.[qi]

                  return (
                    <button
                      key={oi}
                      onClick={() => !submitted && setAnswers({ ...answers, [qi]: oi })}
                      disabled={submitted}
                      className={`
                        w-full rounded-lg border px-4 py-2.5 text-left text-sm transition
                        ${isCorrect ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : ''}
                        ${isWrong ? 'border-red-500 bg-red-500/20 text-red-300' : ''}
                        ${!isCorrect && !isWrong && isSelected ? 'border-indigo-500 bg-indigo-500/20 text-white' : ''}
                        ${!isCorrect && !isWrong && !isSelected ? 'border-white/10 bg-white/[0.02] text-white/70 hover:bg-white/[0.05]' : ''}
                      `}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <Button
              className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={submitQuiz}
              disabled={submitted || Object.keys(answers).length !== data.questions.length}
            >
              Submit Quiz
            </Button>
            {submitted && (
              <Button
                variant="secondary"
                className="rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                onClick={() => {
                  setAnswers({})
                  setSubmitted(false)
                  setResult(null)
                }}
              >
                Retry
              </Button>
            )}
          </div>

          {result && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-white/50">Score</div>
                  <div className="text-2xl font-bold text-white">{result.pct}%</div>
                </div>
                <div>
                  <div className="text-sm text-white/50">Correct</div>
                  <div className="text-2xl font-bold text-white">{result.correct}/{result.total}</div>
                </div>
                <div>
                  <div className="text-sm text-white/50">Level</div>
                  <div className="text-2xl font-bold text-white capitalize">{result.inferredLevel}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
          <ListChecks size={32} className="mx-auto text-white/20 mb-3" />
          <p className="text-sm text-white/40">Click "Load Quiz" to test your knowledge</p>
        </div>
      )}
    </div>
  )
}

export default function LearningMode() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({})

  // Get active module and step from URL
  const activeModule = searchParams.get('module') || ''
  const activeStep = searchParams.get('step') || 'explainer'

  // Fetch topic data
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await api.getTopic(topicId)
        setTopic(data)
        setProgress(getRoadmapProgress(topicId) || {})
      } catch (err) {
        setError(err?.message || 'Failed to load topic')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [topicId])

  // Compute subtopics
  const subtopics = useMemo(() => {
    const items = Array.isArray(topic?.subtopics) ? topic.subtopics : []
    return items.map((t, idx) => ({
      id: slugify(t) || `subtopic-${idx + 1}`,
      title: t,
    }))
  }, [topic?.subtopics])

  // Set default active module
  useEffect(() => {
    if (subtopics.length && !activeModule) {
      setSearchParams({ module: subtopics[0].id, step: 'explainer' }, { replace: true })
    }
  }, [subtopics, activeModule, setSearchParams])

  // Save position on change
  useEffect(() => {
    if (topicId && activeModule && activeStep) {
      api.saveLastViewedPosition(topicId, { module: activeModule, step: activeStep })
    }
  }, [topicId, activeModule, activeStep])

  // Current module
  const currentModule = useMemo(() => {
    return subtopics.find((s) => s.id === activeModule) || subtopics[0]
  }, [subtopics, activeModule])

  // Overall progress
  const overallProgress = useMemo(() => {
    if (!subtopics.length) return 0
    const total = subtopics.reduce((acc, m) => acc + moduleCompletion(ensureModule(progress, m.id)), 0)
    return total / subtopics.length
  }, [subtopics, progress])

  // Next incomplete module
  const nextModule = useMemo(() => {
    const currentIdx = subtopics.findIndex((s) => s.id === activeModule)
    for (let i = currentIdx + 1; i < subtopics.length; i++) {
      const state = ensureModule(progress, subtopics[i].id)
      if (moduleCompletion(state) < 1) return subtopics[i]
    }
    return null
  }, [subtopics, activeModule, progress])

  const handleModuleSelect = (moduleId) => {
    setSearchParams({ module: moduleId, step: 'explainer' })
  }

  const handleStepChange = (step) => {
    setSearchParams({ module: activeModule, step })
  }

  const handleStepComplete = (stepKey, value) => {
    const next = { ...progress }
    const current = ensureModule(next, activeModule)
    next[activeModule] = { ...current, [stepKey]: !!value }
    setRoadmapProgress(topicId, next)
    setProgress(next)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f] p-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={() => navigate('/dashboard/topics')}>Back to Topics</Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-[#0a0a0f]">
        {/* Left Sidebar - Module Navigation */}
        <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/10 bg-[#0a0a0f] p-4 overflow-y-auto">
          <div className="mb-6">
            <Link
              to={`/dashboard/topics/${topicId}`}
              className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition"
            >
              <ArrowLeft size={16} />
              Exit Learning Mode
            </Link>
          </div>

          <div className="mb-4">
            <h2 className="truncate text-lg font-semibold text-white">{topic?.title}</h2>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
              <span className="text-xs text-white/50">{Math.round(overallProgress * 100)}%</span>
            </div>
          </div>

          <div className="space-y-1">
            {subtopics.map((module) => (
              <ModuleItem
                key={module.id}
                module={module}
                isActive={module.id === activeModule}
                progress={progress}
                onClick={() => handleModuleSelect(module.id)}
              />
            ))}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="ml-64 mr-72 flex-1 p-8">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 -mx-8 mb-6 border-b border-white/10 bg-[#0a0a0f]/90 px-8 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <GraduationCap size={14} />
                  <span>Learning Mode</span>
                </div>
                <h1 className="text-xl font-bold text-white">{currentModule?.title}</h1>
              </div>
              <Tooltip content={`${Math.round(moduleCompletion(ensureModule(progress, activeModule)) * 100)}% complete`}>
                <Badge className="border border-white/10 bg-white/5 text-white/70">
                  {Math.round(moduleCompletion(ensureModule(progress, activeModule)) * 100)}%
                </Badge>
              </Tooltip>
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs value={activeStep} onValueChange={handleStepChange}>
            <TabsList className="mb-6 w-full justify-start gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
              <TabsTrigger value="explainer" className="flex items-center gap-2">
                <BookOpen size={14} />
                Explainer
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <Compass size={14} />
                Resources
              </TabsTrigger>
              <TabsTrigger value="quiz" className="flex items-center gap-2">
                <ListChecks size={14} />
                Quiz
              </TabsTrigger>
            </TabsList>

            <TabsContent value="explainer">
              <ExplainerContent topic={topic} subtopicId={activeModule} onComplete={handleStepComplete} />
            </TabsContent>
            <TabsContent value="resources">
              <ResourcesContent topic={topic} subtopicId={activeModule} onComplete={handleStepComplete} />
            </TabsContent>
            <TabsContent value="quiz">
              <QuizContent topic={topic} subtopicId={activeModule} onComplete={handleStepComplete} />
            </TabsContent>
          </Tabs>
        </main>

        {/* Right Sidebar - Up Next & Info */}
        <aside className="fixed right-0 top-0 h-full w-72 border-l border-white/10 bg-[#0a0a0f] p-4 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Progress Overview</h3>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/50">Overall</span>
                <span className="text-sm font-medium text-white">{Math.round(overallProgress * 100)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all"
                  style={{ width: `${Math.round(overallProgress * 100)}%` }}
                />
              </div>
              <div className="mt-3 text-xs text-white/40">
                {subtopics.filter((s) => moduleCompletion(ensureModule(progress, s.id)) >= 1).length} of {subtopics.length} modules complete
              </div>
            </div>
          </div>

          {nextModule && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Up Next</h3>
              <UpNextCard module={nextModule} onClick={() => handleModuleSelect(nextModule.id)} />
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Step Checklist</h3>
            <div className="space-y-2">
              {[
                { key: 'explainer', label: 'Explainer', icon: BookOpen },
                { key: 'resources', label: 'Resources', icon: Compass },
                { key: 'quiz', label: 'Quiz', icon: ListChecks },
              ].map(({ key, label, icon: Icon }) => {
                const state = ensureModule(progress, activeModule)
                const isComplete = !!state[key]
                return (
                  <button
                    key={key}
                    onClick={() => handleStepChange(key)}
                    className={`
                      flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition
                      ${activeStep === key ? 'bg-indigo-500/20 text-white' : 'text-white/60 hover:bg-white/5'}
                    `}
                  >
                    {isComplete ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <CircleDashed size={14} className="text-white/30" />
                    )}
                    <Icon size={14} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white/70 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link
                to={`/dashboard/topics/${topicId}`}
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/60 hover:bg-white/[0.06] hover:text-white transition"
              >
                <Home size={14} />
                View Topic Details
              </Link>
              <Link
                to="/dashboard/dependency-graph"
                className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/60 hover:bg-white/[0.06] hover:text-white transition"
              >
                <GraduationCap size={14} />
                Dependency Graph
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </TooltipProvider>
  )
}
