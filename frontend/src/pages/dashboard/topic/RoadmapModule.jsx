import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Compass, HelpCircle, ListChecks, RotateCcw } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import {
  ensureModule,
  getRoadmapProgress,
  moduleCompletion,
  setRoadmapProgress,
} from '../../../features/roadmap/progress'

const steps = [
  { to: 'explainer', label: 'Explainer', icon: BookOpen, key: 'explainer' },
  { to: 'resources', label: 'Resources', icon: Compass, key: 'resources' },
  { to: 'questions', label: 'Questions', icon: ListChecks, key: 'questions', optional: true },
  { to: 'quiz', label: 'Quiz', icon: HelpCircle, key: 'quiz' },
]

export default function RoadmapModule() {
  const { topic } = useOutletContext()
  const { subtopicId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [progress, setProgress] = useState(() => getRoadmapProgress(topic.id))

  useEffect(() => {
    setProgress(getRoadmapProgress(topic.id))
  }, [topic.id])

  const moduleState = useMemo(() => ensureModule(progress, subtopicId), [progress, subtopicId])
  const pct = useMemo(() => moduleCompletion(moduleState), [moduleState])

  const activeStepIndex = useMemo(() => {
    const last = location.pathname.split('/').filter(Boolean).at(-1)
    const idx = steps.findIndex((s) => s.to === last)
    return idx >= 0 ? idx : 0
  }, [location.pathname])

  const activeStepKey = steps[activeStepIndex]?.key || 'explainer'

  function setStepComplete(stepKey, value = true) {
    const next = { ...progress }
    const current = ensureModule(next, subtopicId)
    next[subtopicId] = { ...current, [stepKey]: !!value }
    setRoadmapProgress(topic.id, next)
    setProgress(next)
  }

  function toggleComplete(stepKey) {
    setStepComplete(stepKey, !moduleState?.[stepKey])
  }

  function resetModule() {
    const next = { ...progress }
    next[subtopicId] = { explainer: false, resources: false, questions: false, quiz: false }
    setRoadmapProgress(topic.id, next)
    setProgress(next)
  }

  function goToPrevStep() {
    if (activeStepIndex > 0) {
      navigate(steps[activeStepIndex - 1].to)
    }
  }

  function goToNextStep() {
    if (activeStepIndex < steps.length - 1) {
      navigate(steps[activeStepIndex + 1].to)
    }
  }

  const done = pct >= 1

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-white">Subtopic: {subtopicId}</div>
          <div className="mt-1 text-sm font-light text-white/50">
            Complete all steps to finish this subtopic.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-white/10 bg-white/5 text-white/80">{Math.round(pct * 100)}%</Badge>
          {done ? (
            <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 size={14} className="mr-1" /> Completed
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>

      {/* Step navigation tabs */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
        <div className="flex flex-wrap gap-2">
          {steps.map((s, idx) => {
            const isActive = idx === activeStepIndex
            const isCompleted = moduleState[s.key]
            return (
              <NavLink
                key={s.to}
                to={s.to}
                className={cn(
                  'relative flex flex-1 min-w-[120px] flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white/10 text-white shadow-lg shadow-white/5'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/70',
                )}
              >
                <div className="flex items-center gap-2">
                  <s.icon size={16} />
                  <span className="hidden sm:inline">{s.label}</span>
                  {s.optional && <span className="text-xs text-white/30">(opt)</span>}
                </div>
                {isCompleted && (
                  <CheckCircle2 size={14} className="absolute right-2 top-2 text-emerald-400" />
                )}
                {/* Step number indicator */}
                <span className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  isActive ? 'bg-white text-black' : 'bg-white/10 text-white/60',
                )}>
                  {idx + 1}
                </span>
              </NavLink>
            )
          })}
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            onClick={goToPrevStep}
            disabled={activeStepIndex === 0}
          >
            <ArrowLeft size={16} />
            Previous
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            onClick={goToNextStep}
            disabled={activeStepIndex === steps.length - 1}
          >
            Next
            <ArrowRight size={16} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className={cn(
              'rounded-xl',
              moduleState[activeStepKey]
                ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-white text-black hover:bg-white/90',
            )}
            onClick={() => toggleComplete(activeStepKey)}
          >
            <CheckCircle2 size={16} />
            {moduleState[activeStepKey] ? 'Completed' : 'Mark complete'}
          </Button>
          <Button
            variant="secondary"
            className="rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            onClick={resetModule}
          >
            <RotateCcw size={16} />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <Outlet context={{ topic, subtopicId, setStepComplete }} />
      </div>
    </div>
  )
}
