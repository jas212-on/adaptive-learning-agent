import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play, CheckCircle2, CircleDashed, ChevronDown, ChevronRight } from 'lucide-react'
import { getRoadmapProgress, ensureModule, moduleCompletion } from '../roadmap/progress'
import { getResumeLearningInfo } from '../../services/api'

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const LEVEL_STYLE = {
  beginner:     'text-emerald-400/70 border-emerald-500/15',
  intermediate: 'text-indigo-400/70 border-indigo-500/15',
  advanced:     'text-amber-400/70 border-amber-500/15',
}

function SubtopicRow({ title, progress, isComplete }) {
  return (
    <div className="flex items-center gap-2.5 py-[5px]">
      {isComplete
        ? <CheckCircle2 size={11} className="shrink-0 text-emerald-400/70" />
        : <CircleDashed size={11} className="shrink-0 text-white/15" />}
      <span className="flex-1 truncate text-[12px] font-light text-white/42">{title}</span>
      <div className="h-[2px] w-10 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-indigo-400/50 transition-all"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  )
}

export function TopicCard({ topic }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const { subtopics, overallProgress, subtopicProgress } = useMemo(() => {
    const items = Array.isArray(topic?.subtopics) ? topic.subtopics : []
    const subs = items.map((t, i) => ({ id: slugify(t) || `sub-${i}`, title: t }))
    const progress = getRoadmapProgress(topic?.id)
    const progMap = {}
    let total = 0
    subs.forEach(s => {
      const state = ensureModule(progress, s.id)
      const pct = moduleCompletion(state)
      progMap[s.id] = { progress: pct, isComplete: pct >= 1 }
      total += pct
    })
    return { subtopics: subs, overallProgress: subs.length ? total / subs.length : 0, subtopicProgress: progMap }
  }, [topic?.id, topic?.subtopics])

  const resumeInfo = useMemo(() => {
    if (!topic?.id) return null
    return getResumeLearningInfo(topic.id, topic, getRoadmapProgress(topic.id))
  }, [topic])

  const progressPct = Math.round(overallProgress * 100)
  const confidencePct = Math.round((topic.confidence ?? 0) * 100)
  const levelStyle = LEVEL_STYLE[topic.level] || 'text-white/30 border-white/10'

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.015] transition-all duration-150 hover:border-white/[0.10] hover:bg-white/[0.025]">
      {/* Progress shimmer line at top */}
      {progressPct > 0 && (
        <div className="absolute left-0 right-0 top-0 h-[1px]">
          <div
            className="h-full bg-gradient-to-r from-indigo-500/0 via-indigo-400/50 to-indigo-500/0 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <Link to={`/dashboard/topics/${topic.id}`} className="flex-1 p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13.5px] font-medium leading-snug text-white/85">{topic.title}</p>
          <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${levelStyle}`}>
            {topic.level || 'beginner'}
          </span>
        </div>

        {/* Summary / snippet preview */}
        {topic.summary ? (
          <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-white/28">{topic.summary}</p>
        ) : (
          <p className="mt-2 text-[11.5px] text-white/20">
            {subtopics.length
              ? `${subtopics.length} subtopic${subtopics.length !== 1 ? 's' : ''} detected`
              : 'No subtopics yet'}
          </p>
        )}

        {/* Progress bar */}
        {subtopics.length > 0 && (
          <div className="mt-3.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9.5px] uppercase tracking-[0.1em] text-white/20">Progress</span>
              <span className="text-[10px] text-white/30">{progressPct}%</span>
            </div>
            <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-indigo-400/45 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2">
        <button
          onClick={() => setExpanded(e => !e)}
          disabled={subtopics.length === 0}
          className="flex items-center gap-1 text-[11px] text-white/22 transition hover:text-white/48 disabled:opacity-40 disabled:cursor-default"
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {subtopics.length} subtopic{subtopics.length !== 1 ? 's' : ''}
        </button>

        <button
          onClick={(e) => { e.preventDefault(); if (resumeInfo?.url) navigate(resumeInfo.url) }}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500/[0.10] px-2.5 py-1 text-[11px] font-medium text-indigo-400/80 ring-1 ring-indigo-500/15 transition hover:bg-indigo-500/[0.16] hover:text-indigo-300"
        >
          <Play size={9} />
          {resumeInfo?.label || 'Start'}
        </button>
      </div>

      {/* Expanded subtopics */}
      {expanded && subtopics.length > 0 && (
        <div className="border-t border-white/[0.05] px-4 pb-3 pt-2">
          {subtopics.slice(0, 5).map(s => (
            <SubtopicRow
              key={s.id}
              title={s.title}
              progress={subtopicProgress[s.id]?.progress || 0}
              isComplete={subtopicProgress[s.id]?.isComplete || false}
            />
          ))}
          {subtopics.length > 5 && (
            <Link
              to={`/dashboard/topics/${topic.id}`}
              className="block pt-2 text-center text-[10.5px] text-white/20 hover:text-white/42"
            >
              +{subtopics.length - 5} more subtopics
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
