import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Network, ChevronRight, BookOpen } from 'lucide-react'
import { Badge } from './Badge'
import { Tooltip, tooltipContent } from './Tooltip'
import {
  ensureModule,
  getRoadmapProgress,
  moduleCompletion,
} from '../../features/roadmap/progress'

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Sticky sidebar component for topic details page
 */
export function TopicSidebar({ topic, className }) {
  const progress = useMemo(() => {
    if (!topic?.id) return {}
    return getRoadmapProgress(topic.id)
  }, [topic?.id])

  const subtopics = useMemo(() => {
    if (!topic?.subtopics) return []
    return topic.subtopics.map((t, idx) => ({
      id: slugify(t) || `subtopic-${idx + 1}`,
      title: t,
    }))
  }, [topic?.subtopics])

  const stats = useMemo(() => {
    if (!subtopics.length) return { completed: 0, total: 0, percentage: 0 }
    const completed = subtopics.filter((m) => {
      const state = ensureModule(progress, m.id)
      return moduleCompletion(state) >= 1
    }).length
    return {
      completed,
      total: subtopics.length,
      percentage: Math.round((completed / subtopics.length) * 100),
    }
  }, [subtopics, progress])

  const firstIncomplete = useMemo(() => {
    return subtopics.find((m) => {
      const state = ensureModule(progress, m.id)
      return moduleCompletion(state) < 1
    })
  }, [subtopics, progress])

  if (!topic) return null

  return (
    <aside className={`space-y-4 ${className}`}>
      {/* Quick Summary */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Quick Summary</h3>
        <p className="mt-2 text-xs font-light text-white/60 line-clamp-4">
          {topic.summary || 'No summary available. Start detection to generate one.'}
        </p>
      </div>

      {/* Progress Metrics */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Progress</h3>
          <Tooltip content={tooltipContent.progress}>
            <Badge className="cursor-help border border-white/10 bg-white/5 text-white/70">
              {stats.completed}/{stats.total}
            </Badge>
          </Tooltip>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${stats.percentage}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-white/50">
          {stats.percentage}% complete
        </div>
        {firstIncomplete && (
          <Link
            to={`/dashboard/topics/${topic.id}?module=${firstIncomplete.id}`}
            className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-500/15 px-3 py-2 text-xs font-medium text-indigo-400 transition hover:bg-indigo-500/25"
          >
            <BookOpen size={14} />
            Continue: {firstIncomplete.title}
          </Link>
        )}
      </div>

      {/* Module Quick Links */}
      {subtopics.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="text-sm font-semibold text-white">Modules</h3>
          <div className="mt-3 space-y-1">
            {subtopics.slice(0, 5).map((m, idx) => {
              const state = ensureModule(progress, m.id)
              const pct = moduleCompletion(state)
              const done = pct >= 1

              return (
                <Link
                  key={m.id}
                  to={`/dashboard/topics/${topic.id}?module=${m.id}`}
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/5"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      done ? 'bg-emerald-400' : pct > 0 ? 'bg-amber-400' : 'bg-white/20'
                    }`}
                  />
                  <span className="flex-1 truncate text-white/70 group-hover:text-white">
                    {idx + 1}. {m.title}
                  </span>
                  <ChevronRight
                    size={12}
                    className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white/50"
                  />
                </Link>
              )
            })}
            {subtopics.length > 5 && (
              <div className="px-2 py-1 text-xs text-white/40">
                +{subtopics.length - 5} more modules
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini Dependency Graph */}
      <Link
        to={`/dashboard/dependency-graph?topic=${topic.id}`}
        className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
      >
        <Tooltip content={tooltipContent.dependencyGraph}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Dependencies</h3>
            <Network size={16} className="text-indigo-400" />
          </div>
        </Tooltip>
        <div className="mt-3 flex items-center justify-center rounded-lg bg-white/5 py-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg border border-white/20 bg-white/10" />
            <ChevronRight size={14} className="text-white/30" />
            <div className="h-10 w-10 rounded-lg border-2 border-indigo-500/50 bg-indigo-500/20" />
            <ChevronRight size={14} className="text-white/30" />
            <div className="h-8 w-8 rounded-lg border border-white/20 bg-white/10" />
          </div>
        </div>
        <div className="mt-2 text-center text-xs text-white/50">
          Click to view full graph
        </div>
      </Link>
    </aside>
  )
}

export default TopicSidebar
