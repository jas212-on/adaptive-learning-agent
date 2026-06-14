import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, TrendingDown } from 'lucide-react'
import * as api from '../../services/api'

/* Urgency: 0–1 → visual weight */
function UrgencyBar({ overdueDays }) {
  const intensity = Math.min(1, overdueDays / 7)
  const color =
    intensity > 0.7 ? 'bg-red-400/70' :
    intensity > 0.35 ? 'bg-amber-400/60' :
    'bg-indigo-400/45'
  return (
    <div className="h-full w-[3px] rounded-full bg-white/[0.04]">
      <div
        className={`w-full rounded-full ${color} transition-all duration-500`}
        style={{ height: `${Math.max(20, intensity * 100)}%` }}
      />
    </div>
  )
}

function ReviewItem({ item, index }) {
  const mastery = Math.round((item.decayedMastery ?? 0) * 100)
  const overdue = item.overdueDays || 0
  const urgencyText = overdue > 5 ? 'critical' : overdue > 2 ? 'overdue' : overdue > 0 ? 'due' : 'soon'
  const urgencyColor = overdue > 5 ? 'text-red-400/70' : overdue > 2 ? 'text-amber-400/60' : 'text-white/30'

  return (
    <div
      className="group flex items-stretch gap-4 border-b border-white/[0.04] py-5 animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Urgency bar */}
      <div className="flex w-[3px] shrink-0 items-stretch py-0.5">
        <UrgencyBar overdueDays={overdue} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-light text-white/72 transition-colors group-hover:text-white/88">
              {item.topicId}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-white/30">{item.subtopicId}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${urgencyColor}`}>
              {urgencyText}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-white/28">
              <TrendingDown size={9} className="text-white/20" />
              {mastery}%
            </span>
          </div>
        </div>
        {overdue > 0 && (
          <p className="mt-1 text-[11px] text-white/20">{overdue}d since last review</p>
        )}
      </div>

      {/* Action */}
      <Link
        to={`/dashboard/topics/${item.topicId}?module=${item.subtopicId}&step=quiz`}
        className="self-center shrink-0 rounded-xl bg-indigo-500/[0.10] px-4 py-2 text-[12px] font-medium text-indigo-300/80 ring-1 ring-indigo-500/15 transition hover:bg-indigo-500/[0.20] hover:text-indigo-200"
      >
        Review →
      </Link>
    </div>
  )
}

export default function ReviewQueue() {
  const [queue, setQueue] = useState(null)
  const [dailyProgress, setDailyProgress] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [q, dp] = await Promise.all([api.getReviewQueue(), api.getDailyProgress()])
        setQueue(q)
        setDailyProgress(dp)
      } catch { /* best-effort */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-2">
          <div className="skeleton h-2.5 w-28 rounded" />
          <div className="skeleton h-10 w-56 rounded" />
        </div>
        {[1,2,3,4].map(i => (
          <div key={i} className="flex gap-4 border-b border-white/[0.04] py-5">
            <div className="skeleton w-[3px] h-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const items = queue?.items || []
  const dp = dailyProgress
  const goalPct = dp?.progressPct || 0

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="mb-12">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Spaced Repetition</p>
        <h1 className="mt-1.5 text-[38px] font-extralight tracking-tight text-white/88">
          {items.length === 0 ? "You're all caught up." : `${items.length} item${items.length !== 1 ? 's' : ''} to review.`}
        </h1>
        {dp && (
          <p className="mt-2 text-[14px] font-light text-white/35">
            {dp.quizzesToday} of {dp.goalQuizzes} quizzes done today
            {dp.currentStreak > 0 && ` · ${dp.currentStreak}-day streak`}
          </p>
        )}
      </div>

      {/* Daily goal bar — thin, full width */}
      {dp && (
        <div className="mb-10">
          <div className="mb-2 flex justify-between text-[10px] text-white/20">
            <span>Daily goal</span>
            <span>{Math.round(goalPct)}%</span>
          </div>
          <div className="h-[2px] w-full rounded-full bg-white/[0.04]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${goalPct >= 100 ? 'bg-emerald-400/55' : 'bg-indigo-400/45'}`}
              style={{ width: `${Math.min(100, goalPct)}%` }}
            />
          </div>
          {/* Streak stats — minimal */}
          <div className="mt-6 flex items-center gap-6">
            {[
              { v: dp.currentStreak || 0, l: 'streak' },
              { v: dp.longestStreak || 0, l: 'best' },
              { v: dp.totalDaysStudied || 0, l: 'days studied' },
            ].map(({ v, l }) => (
              <div key={l}>
                <span className="text-[24px] font-extralight text-white/70">{v}</span>
                <span className="ml-1.5 text-[10px] text-white/25">{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/30 via-transparent to-indigo-950/20" />
          <div className="relative flex flex-col items-center py-20 text-center">
            <CheckCircle2 size={40} className="mb-4 text-emerald-400/40" />
            <p className="text-[15px] font-light text-white/40">
              All topics are up to date.
            </p>
            <p className="mt-2 text-[12px] text-white/22">
              Items will appear here as your memory fades. Keep studying!
            </p>
          </div>
        </div>
      )}

      {/* Review list */}
      {items.length > 0 && (
        <div>
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">
            Due for review
          </p>
          {items.map((item, i) => (
            <ReviewItem key={`${item.topicId}-${item.subtopicId}`} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
