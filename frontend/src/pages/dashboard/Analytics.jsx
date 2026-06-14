import { useEffect, useState, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { Skeleton } from '../../components/ui/Skeleton'
import * as api from '../../services/api'

/* ─── Animated counter ────────────────────────────────────── */
function useCountUp(target, ms = 1200) {
  const [v, setV] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!target) { setV(0); return }
    const start = performance.now()
    const tick = now => {
      const t = Math.min(1, (now - start) / ms)
      const ease = 1 - Math.pow(1 - t, 4)
      setV(Math.round(ease * target))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, ms])
  return v
}

/* ─── Large radial ────────────────────────────────────────── */
function MasteryDial({ pct }) {
  const r = 68
  const circ = 2 * Math.PI * r
  const gap = circ * 0.25
  const arc = (circ - gap) * (pct / 100)
  const dashOffset = circ - arc - gap / 2

  return (
    <div className="relative">
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
        {/* Track */}
        <circle
          cx="90" cy="90" r={r}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6"
          strokeDasharray={`${circ - gap} ${gap}`}
          strokeDashoffset={-(gap / 2)}
          strokeLinecap="round"
        />
        {/* Value */}
        <circle
          cx="90" cy="90" r={r}
          fill="none"
          stroke="url(#dialGrad)"
          strokeWidth="6"
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(129,140,248,0.9)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0.7)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[44px] font-extralight leading-none text-white/88">{pct}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/25">mastery</span>
      </div>
    </div>
  )
}

/* ─── Score color ──────────────────────────────────────── */
function scoreColor(s) {
  if (s >= 80) return 'text-emerald-400'
  if (s >= 55) return 'text-amber-400'
  return 'text-red-400/80'
}

function barFill(s) {
  if (s >= 80) return 'bg-emerald-400/45'
  if (s >= 55) return 'bg-amber-400/40'
  return 'bg-red-400/40'
}

/* ─── Topic leaderboard row ───────────────────────────────── */
function TopicStrip({ topic, max, rank }) {
  const pct = Math.round(topic.progress * 100)
  const relWidth = max > 0 ? (topic.score / max) * 100 : 0
  return (
    <div className="group flex items-center gap-4 py-3.5">
      <span className="w-4 shrink-0 font-mono text-[10px] text-white/18">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <p className="truncate text-[13px] font-medium text-white/72">{topic.title}</p>
          <span className={`shrink-0 text-[14px] font-semibold ${scoreColor(topic.score)}`}>
            {topic.score}<span className="text-[10px] text-white/25">%</span>
          </span>
        </div>
        {/* Relative bar */}
        <div className="h-[2px] w-full rounded-full bg-white/[0.04]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barFill(topic.score)}`}
            style={{ width: `${relWidth}%` }}
          />
        </div>
      </div>
      {topic.minutes > 0 && (
        <span className="shrink-0 text-[10.5px] text-white/18">{topic.minutes}m</span>
      )}
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────── */
export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try { setData(await api.getAnalytics()) }
    catch (e) { setError(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const animScore = useCountUp(data?.avgScore ?? 0)
  const animTime = useCountUp(data?.timeSpentMinutes ?? 0)

  if (loading) {
    return (
      <div className="animate-fade-in space-y-12">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-10 w-64 rounded" />
          <Skeleton className="h-4 w-80 rounded mt-2" />
        </div>
        <div className="flex justify-center">
          <Skeleton className="h-[180px] w-[180px] rounded-full" />
        </div>
        <div className="space-y-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      </div>
    )
  }

  if (error) return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-5 text-[13px] text-red-400/80">
      {error}
    </div>
  )

  const best = [...(data.byTopic || [])].sort((a, b) => b.score - a.score)[0]
  const worst = [...(data.byTopic || [])].sort((a, b) => a.score - b.score)[0]
  const maxScore = Math.max(...(data.byTopic || []).map(t => t.score), 1)

  return (
    <div className="animate-fade-in">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Learning</p>
          <h1 className="mt-1.5 text-[38px] font-extralight tracking-tight text-white/88">Analytics</h1>
        </div>
        <button
          onClick={load}
          className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/22 transition hover:text-white/48"
        >
          <RefreshCw size={10} />
          Refresh
        </button>
      </div>

      {/* ── Narrative + Dial ─────────────────────────────── */}
      <div className="mb-14 grid grid-cols-1 gap-10 md:grid-cols-[1fr_auto] md:items-center">

        {/* Prose narrative */}
        <div className="space-y-4">
          <p className="text-[22px] font-extralight leading-relaxed text-white/75">
            You've studied{' '}
            <span className="text-white/92">{data.byTopic?.length ?? 0} topic{data.byTopic?.length !== 1 ? 's' : ''}</span>
            {' '}over{' '}
            <span className="text-white/92">{animTime} minutes</span>.
          </p>
          {best && worst && best.id !== worst.id && (
            <p className="text-[15px] font-light leading-relaxed text-white/40">
              Strongest in{' '}
              <span className="text-emerald-400/80">{best.title}</span>
              {' '}at {best.score}%.
              {' '}Needs work:{' '}
              <span className="text-amber-400/70">{worst.title}</span>
              {' '}at {worst.score}%.
            </p>
          )}
          {data.streakDays > 0 && (
            <p className="text-[13px] text-white/28">
              {data.streakDays}-day streak · keep going.
            </p>
          )}
        </div>

        {/* Dial */}
        <div className="flex justify-center md:justify-end">
          <MasteryDial pct={animScore} />
        </div>
      </div>

      {/* ── Divider ─────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-white/[0.05]" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">
          By Topic
        </span>
        <div className="h-px flex-1 bg-white/[0.05]" />
      </div>

      {/* ── Topic list ──────────────────────────────────── */}
      {data.byTopic?.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-white/25">
          Complete quizzes to see topic breakdown.
        </p>
      ) : (
        <div>
          {(data.byTopic || []).map((t, i) => (
            <div key={t.id} className={i > 0 ? 'border-t border-white/[0.04]' : ''}>
              <TopicStrip topic={t} max={maxScore} rank={i + 1} />
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
