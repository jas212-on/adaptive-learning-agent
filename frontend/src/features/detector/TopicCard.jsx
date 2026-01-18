import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  Play,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { getRoadmapProgress, ensureModule, moduleCompletion } from '../roadmap/progress'
import { getResumeLearningInfo } from '../../services/api'

function levelVariant(level) {
  if (level === 'beginner') return 'success'
  if (level === 'intermediate') return 'primary'
  if (level === 'advanced') return 'warning'
  return 'neutral'
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Mini progress bar for subtopics
function MiniProgressBar({ progress }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-1 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-white/40">{pct}%</span>
    </div>
  )
}

// Subtopic preview item
function SubtopicPreview({ title, progress, isComplete }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {isComplete ? (
          <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
        ) : (
          <CircleDashed size={14} className="shrink-0 text-white/30" />
        )}
        <span className="truncate text-xs text-white/70">{title}</span>
      </div>
      <MiniProgressBar progress={progress} />
    </div>
  )
}

export function TopicCard({ topic }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

  // Compute subtopics and progress
  const { subtopics, overallProgress, subtopicProgress } = useMemo(() => {
    const items = Array.isArray(topic?.subtopics) ? topic.subtopics : []
    const subs = items.map((t, idx) => ({
      id: slugify(t) || `subtopic-${idx + 1}`,
      title: t,
    }))

    const progress = getRoadmapProgress(topic?.id)
    const progMap = {}
    let total = 0

    subs.forEach((s) => {
      const state = ensureModule(progress, s.id)
      const pct = moduleCompletion(state)
      progMap[s.id] = { progress: pct, isComplete: pct >= 1 }
      total += pct
    })

    return {
      subtopics: subs,
      overallProgress: subs.length ? total / subs.length : 0,
      subtopicProgress: progMap,
    }
  }, [topic?.id, topic?.subtopics])

  // Resume learning info
  const resumeInfo = useMemo(() => {
    if (!topic?.id) return null
    const progress = getRoadmapProgress(topic.id)
    return getResumeLearningInfo(topic.id, topic, progress)
  }, [topic])

  const handleQuickStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (resumeInfo?.url) {
      navigate(resumeInfo.url)
    }
  }

  const handleToggleExpand = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  // Snippet count and last updated
  const snippetCount = topic?.snippets?.length || topic?.snippet_count || 0
  const lastUpdated = topic?.updated_at || topic?.last_updated

  return (
    <div className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
      {/* Main card content - clickable to go to topic */}
      <Link to={`/dashboard/topics/${topic.id}`} className="block">
        <div className="flex items-start gap-4 p-5">
          <div className="mt-1 grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Brain size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{topic.title}</div>
                <div className="mt-1 flex items-center gap-3 text-sm font-light text-white/50">
                  <span>
                    Confidence:{' '}
                    {topic.confidence === null || topic.confidence === undefined
                      ? '—'
                      : `${Math.round(topic.confidence * 100)}%`}
                  </span>
                  {snippetCount > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText size={12} />
                      {snippetCount} snippets
                    </span>
                  )}
                  {lastUpdated && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(lastUpdated).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={levelVariant(topic.level)} className="shrink-0">
                {topic.level}
              </Badge>
            </div>

            {/* Overall progress bar */}
            {subtopics.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-white/40">Overall Progress</span>
                  <span className="text-xs font-medium text-white/60">
                    {Math.round(overallProgress * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all"
                    style={{ width: `${Math.round(overallProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-2">
              {(topic.tags || []).slice(0, 4).map((t) => (
                <Badge key={t} className="border border-white/10 bg-white/5 text-white/70">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Link>

      {/* Action bar with expand toggle and quick start */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 bg-white/[0.02]">
        <button
          onClick={handleToggleExpand}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {subtopics.length} subtopics
        </button>

        <Button
          onClick={handleQuickStart}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
        >
          <Play size={12} />
          {resumeInfo?.label || 'Start Learning'}
        </Button>
      </div>

      {/* Expandable subtopics preview */}
      {isExpanded && subtopics.length > 0 && (
        <div className="border-t border-white/10 p-4 space-y-2 bg-white/[0.01]">
          {subtopics.slice(0, 4).map((sub) => (
            <SubtopicPreview
              key={sub.id}
              title={sub.title}
              progress={subtopicProgress[sub.id]?.progress || 0}
              isComplete={subtopicProgress[sub.id]?.isComplete || false}
            />
          ))}
          {subtopics.length > 4 && (
            <Link
              to={`/dashboard/topics/${topic.id}`}
              className="block text-center text-xs text-white/40 hover:text-white/60 py-2"
            >
              +{subtopics.length - 4} more subtopics
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

