import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Scan, ArrowUpRight, Clock, Lightbulb, ChevronRight, Zap } from 'lucide-react'
import { useDetector } from '../../features/detector/DetectorContext'
import { useAuth } from '../../providers/AuthProvider'
import { getRoadmapProgress, moduleCompletion, ensureModule } from '../../features/roadmap/progress'

/* ─── helpers ─────────────────────────────────────────────── */
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function overallProgress(topic) {
  const subs = Array.isArray(topic?.subtopics) ? topic.subtopics : []
  if (!subs.length) return 0
  const progress = getRoadmapProgress(topic.id)
  const total = subs.reduce((sum, t, i) => {
    const id = slugify(t) || `sub-${i}`
    return sum + moduleCompletion(ensureModule(progress, id))
  }, 0)
  return total / subs.length
}

function relativeTime(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ─── Radial progress arc ─────────────────────────────────── */
function Arc({ pct, size = 48, stroke = 3, color = 'rgba(129,140,248,0.6)' }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ─── Empty hero ──────────────────────────────────────────── */
function EmptyHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl">
      {/* Aurora */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/60 via-[#09090b] to-violet-950/40" />
      <div className="absolute -top-1/2 left-1/4 h-[300px] w-[300px] rounded-full bg-indigo-600/10 blur-[80px]" />
      <div className="absolute -bottom-1/3 right-1/4 h-[200px] w-[200px] rounded-full bg-violet-600/08 blur-[80px]" />

      <div className="relative flex flex-col items-center py-20 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.08]">
          <Zap size={22} className="text-indigo-400" />
        </div>
        <h2 className="text-[32px] font-extralight tracking-tight text-white/70">
          Nothing detected yet.
        </h2>
        <p className="mt-3 max-w-sm text-[14px] text-white/30">
          The AI watches your screen and automatically discovers topics as you study. Start detection to begin.
        </p>
        <Link
          to="/detection"
          className="mt-8 inline-flex items-center gap-2.5 rounded-xl bg-indigo-500 px-6 py-3 text-[13px] font-medium text-white shadow-glow transition hover:bg-indigo-400"
        >
          <Scan size={14} />
          Start Screen Detection
          <ArrowUpRight size={13} className="opacity-60" />
        </Link>
      </div>
    </section>
  )
}

/* ─── Main component ──────────────────────────────────────── */
export default function DashboardHome() {
  const { topics, loading, refreshTopics } = useDetector()
  const { user } = useAuth()

  useEffect(() => {
    if (topics.length === 0) refreshTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const primary = topics[0]
  const rest = topics.slice(1, 5)

  const primaryPct = useMemo(() => primary ? Math.round(overallProgress(primary) * 100) : 0, [primary])

  if (loading && !topics.length) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="skeleton h-[280px] rounded-3xl" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!topics.length) return <div className="animate-fade-in"><EmptyHero /></div>

  return (
    <div className="animate-fade-in space-y-0">

      {/* ── Hero: current focus ─────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl">
        {/* Atmospheric gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/70 via-[#09090b]/80 to-violet-950/50" />
        <div className="absolute -top-[60%] -left-[10%] h-[500px] w-[500px] rounded-full bg-indigo-700/[0.12] blur-[100px]" />
        <div className="absolute -bottom-[40%] right-[5%] h-[300px] w-[300px] rounded-full bg-violet-700/[0.08] blur-[80px]" />

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-8 pt-8">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              AI active · {topics.length} topic{topics.length !== 1 ? 's' : ''} tracked
            </span>
          </div>
          <Link
            to="/detection"
            className="flex items-center gap-1.5 text-[11px] text-white/28 transition hover:text-white/55"
          >
            <Scan size={11} />
            Detection
          </Link>
        </div>

        {/* Main content */}
        <div className="relative grid grid-cols-1 gap-0 px-8 pb-8 pt-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-400/60">
              Currently studying
            </p>
            <h1 className="mt-2 text-[42px] font-extralight leading-[1.1] tracking-tight text-white/92 md:text-[52px]">
              {primary.title}
            </h1>
            {primary.summary && (
              <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-white/35">
                {primary.summary}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                to={`/dashboard/topics/${primary.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.08] px-5 py-2.5 text-[13px] font-medium text-white/75 ring-1 ring-white/10 transition hover:bg-white/[0.12] hover:text-white/90"
              >
                Open topic
                <ArrowUpRight size={12} />
              </Link>
              <Link
                to={`/dashboard/learning/${primary.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500/[0.15] px-5 py-2.5 text-[13px] font-medium text-indigo-300 ring-1 ring-indigo-500/25 transition hover:bg-indigo-500/[0.22]"
              >
                Start learning
              </Link>
            </div>
          </div>

          {/* Radial */}
          <div className="mt-8 flex shrink-0 flex-col items-center gap-2 md:mt-0">
            <div className="relative">
              <Arc pct={primaryPct} size={88} stroke={4} color="rgba(129,140,248,0.7)" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[20px] font-light text-white/80">{primaryPct}%</span>
              </div>
            </div>
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white/22">
              Progress
            </span>
          </div>
        </div>
      </section>

      {/* ── Spacer ─────────────────────────────────────── */}
      <div className="h-10" />

      {/* ── More topics: activity timeline ─────────────── */}
      {rest.length > 0 && (
        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/22">
              Also tracking
            </h2>
            <Link
              to="/dashboard/topics"
              className="flex items-center gap-1 text-[11px] text-white/22 transition hover:text-indigo-400"
            >
              All topics
              <ChevronRight size={10} />
            </Link>
          </div>

          {/* Vertical timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.05] to-transparent" />

            <div className="space-y-0">
              {rest.map((topic, i) => {
                const pct = Math.round(overallProgress(topic) * 100)
                return (
                  <Link
                    key={topic.id}
                    to={`/dashboard/topics/${topic.id}`}
                    className="group relative flex items-start gap-5 py-4 pl-2 transition-all"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-1 shrink-0">
                      <div className="relative h-[9px] w-[9px] rounded-full bg-white/[0.12] ring-2 ring-[#09090b] transition-colors group-hover:bg-indigo-400/60">
                        <div className="absolute inset-[2px] rounded-full bg-white/20" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="truncate text-[14px] font-medium text-white/65 transition-colors group-hover:text-white/88">
                          {topic.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-2.5">
                          <span className="text-[11px] text-white/22">{pct}%</span>
                          <Arc pct={pct} size={22} stroke={2} />
                        </div>
                      </div>
                      {topic.subtopics?.length > 0 && (
                        <p className="mt-0.5 truncate text-[11.5px] text-white/22">
                          {topic.subtopics.slice(0, 4).join(' · ')}
                          {topic.subtopics.length > 4 ? ` +${topic.subtopics.length - 4}` : ''}
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom strip: quick actions ─────────────────── */}
      <div className="mt-10 grid grid-cols-1 gap-3 border-t border-white/[0.05] pt-8 sm:grid-cols-3">
        {[
          {
            to: '/dashboard/review',
            icon: Clock,
            label: 'Review Queue',
            desc: 'Items due for spaced repetition',
            accent: 'text-amber-400',
          },
          {
            to: '/dashboard/suggestions',
            icon: Lightbulb,
            label: 'AI Suggestions',
            desc: 'Personalized next steps',
            accent: 'text-violet-400',
          },
          {
            to: '/dashboard/analytics',
            icon: Zap,
            label: 'Analytics',
            desc: 'Mastery across all topics',
            accent: 'text-indigo-400',
          },
        ].map(({ to, icon: Icon, label, desc, accent }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:bg-white/[0.03]"
          >
            <Icon size={14} className={`shrink-0 ${accent} opacity-60 group-hover:opacity-90 transition-opacity`} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-white/55 group-hover:text-white/78 transition-colors">{label}</p>
              <p className="truncate text-[11px] text-white/20">{desc}</p>
            </div>
            <ChevronRight size={11} className="ml-auto shrink-0 text-white/12 transition group-hover:text-white/32 group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  )
}
