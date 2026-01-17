import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CheckCircle2, ChevronRight, Route } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Spinner } from '../../../components/ui/Spinner'
import {
  ensureModule,
  getRoadmapProgress,
  moduleCompletion,
} from '../../../features/roadmap/progress'

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function RoadmapIndex() {
  const { topic } = useOutletContext()

  const [progress, setProgress] = useState(() => getRoadmapProgress(topic.id))

  useEffect(() => {
    setProgress(getRoadmapProgress(topic.id))
  }, [topic.id])

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-light text-white/50">
          Subtopics are generated from what was detected in your session. Progress is tracked from explainer, resources, and quiz (questions are optional).
        </div>
        <Badge className="border border-white/10 bg-white/5 text-white/80">Overall: {Math.round(overall * 100)}%</Badge>
      </div>

      <div className="space-y-3">
        {!subtopics.length ? (
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Spinner /> No subtopics yet. Keep detection running to collect them.
          </div>
        ) : null}

        {subtopics.map((m, index) => {
          const st = ensureModule(progress, m.id)
          const pct = moduleCompletion(st)
          const done = pct >= 1

          return (
            <Link key={m.id} to={`../roadmap/${m.id}`} className="block">
              <div className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {done ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <Route size={18} className="text-white/40" />
                      )}
                      <div className="truncate text-sm font-semibold text-white">
                        Subtopic {index + 1}: {m.title}
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-light text-white/40">
                      Open to start this subtopic.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                    {Math.round(pct * 100)}%
                    <ChevronRight size={16} className="text-white/40 transition group-hover:translate-x-0.5" />
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.round(pct * 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="text-xs font-light text-white/40">
        Tip: As you finish a subtopic’s steps, its bar shifts towards green.
      </div>
    </div>
  )
}
