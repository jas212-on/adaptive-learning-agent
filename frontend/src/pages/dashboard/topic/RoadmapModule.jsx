import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { BookOpen, CheckCircle2, Compass, HelpCircle, ListChecks } from 'lucide-react'
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
  { to: 'questions', label: 'Questions (optional)', icon: ListChecks, key: 'questions' },
  { to: 'quiz', label: 'Quiz', icon: HelpCircle, key: 'quiz' },
]

export default function RoadmapModule() {
  const { topic } = useOutletContext()
  const { subtopicId } = useParams()
  const location = useLocation()

  const [progress, setProgress] = useState(() => getRoadmapProgress(topic.id))

  useEffect(() => {
    setProgress(getRoadmapProgress(topic.id))
  }, [topic.id])

  const moduleState = useMemo(() => ensureModule(progress, subtopicId), [progress, subtopicId])
  const pct = useMemo(() => moduleCompletion(moduleState), [moduleState])

  const activeStepKey = useMemo(() => {
    const last = location.pathname.split('/').filter(Boolean).at(-1)
    const match = steps.find((s) => s.to === last)
    return match?.key || 'explainer'
  }, [location.pathname])

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

  const done = pct >= 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Subtopic: {subtopicId}</div>
          <div className="mt-1 text-sm text-fg-muted">
            Complete all steps to finish this subtopic.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-bg-muted text-fg">{Math.round(pct * 100)}%</Badge>
          {done ? (
            <Badge variant="success" className="bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 size={14} className="mr-1" /> Completed
            </Badge>
          ) : null}
          <Button variant="secondary" onClick={() => toggleComplete(activeStepKey)}>
            {moduleState[activeStepKey] ? 'Mark as not done' : 'Mark this step done'}
          </Button>
          <Button variant="ghost" onClick={resetModule}>
            Reset
          </Button>
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-border">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium hover:bg-bg-muted',
                isActive && 'bg-bg-muted',
              )
            }
          >
            <s.icon size={16} />
            {s.label}
            {moduleState[s.key] ? <CheckCircle2 size={16} className="text-emerald-500" /> : null}
          </NavLink>
        ))}
      </div>

      <Outlet context={{ topic, subtopicId, setStepComplete }} />
    </div>
  )
}
