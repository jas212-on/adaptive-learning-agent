import { useEffect, useState, useMemo } from 'react'
import { Scan, Search, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDetector } from '../../features/detector/DetectorContext'
import { getRoadmapProgress, moduleCompletion, ensureModule } from '../../features/roadmap/progress'

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function topicProgress(topic) {
  const subs = Array.isArray(topic?.subtopics) ? topic.subtopics : []
  if (!subs.length) return 0
  const progress = getRoadmapProgress(topic.id)
  const total = subs.reduce((sum, t, i) => {
    const id = slugify(t) || `sub-${i}`
    return sum + moduleCompletion(ensureModule(progress, id))
  }, 0)
  return total / subs.length
}

const LEVEL_COLOR = {
  beginner: 'text-emerald-400/60',
  intermediate: 'text-indigo-400/60',
  advanced: 'text-amber-400/60',
}

function TopicRow({ topic, index }) {
  const pct = Math.round(topicProgress(topic) * 100)
  const confidence = Math.round((topic.confidence ?? 0) * 100)
  const filledDots = Math.round((pct / 100) * 5)

  return (
    <Link
      to={`/dashboard/topics/${topic.id}`}
      className="group block animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start gap-6 border-b border-white/[0.04] py-6 transition-colors duration-150 hover:border-white/[0.07]">
        {/* Index number */}
        <span className="w-8 shrink-0 pt-1 text-right font-mono text-[11px] text-white/18 tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[18px] font-light leading-tight text-white/80 transition-colors group-hover:text-white/95">
              {topic.title}
            </h2>
            <ArrowUpRight
              size={14}
              className="mt-1 shrink-0 text-white/12 transition-all group-hover:text-indigo-400/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </div>

          {/* Meta row */}
          <div className="mt-1.5 flex items-center gap-3">
            <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${LEVEL_COLOR[topic.level] || 'text-white/25'}`}>
              {topic.level || 'beginner'}
            </span>
            {topic.subtopics?.length > 0 && (
              <>
                <span className="text-white/12">·</span>
                <span className="text-[11px] text-white/25">
                  {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}
                </span>
              </>
            )}
            {confidence > 0 && (
              <>
                <span className="text-white/12">·</span>
                <span className="text-[11px] text-white/25">{confidence}% confidence</span>
              </>
            )}
          </div>

          {/* Subtopics as pills */}
          {topic.subtopics?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topic.subtopics.slice(0, 6).map((s, i) => (
                <span
                  key={i}
                  className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-white/30"
                >
                  {s}
                </span>
              ))}
              {topic.subtopics.length > 6 && (
                <span className="rounded-md bg-white/[0.02] px-2 py-0.5 text-[10.5px] text-white/18">
                  +{topic.subtopics.length - 6} more
                </span>
              )}
            </div>
          )}

          {/* Progress dots */}
          {pct > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 w-4 rounded-full transition-all ${
                      i < filledDots
                        ? 'bg-indigo-400/55'
                        : 'bg-white/[0.06]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-white/22">{pct}%</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function TopicsIndex() {
  const { topics, loading, refreshTopics } = useDetector()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (topics.length === 0) refreshTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() =>
    query
      ? topics.filter(t =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.subtopics?.some(s => s.toLowerCase().includes(query.toLowerCase()))
        )
      : topics,
    [topics, query]
  )

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between pb-8">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">Your Knowledge</p>
          <h1 className="mt-1.5 text-[38px] font-extralight tracking-tight text-white/88">
            Topics
            {topics.length > 0 && (
              <span className="ml-3 text-[20px] text-white/22">{topics.length}</span>
            )}
          </h1>
        </div>
        <button
          onClick={refreshTopics}
          disabled={loading}
          className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/22 transition hover:text-white/48 disabled:opacity-30"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search — only when there are topics */}
      {topics.length > 0 && (
        <div className="relative mb-8">
          <Search size={12} className="absolute left-0 top-1/2 -translate-y-1/2 text-white/18" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search topics or subtopics…"
            className="w-full border-b border-white/[0.07] bg-transparent py-2.5 pl-6 pr-4 text-[13px] text-white/65 placeholder:text-white/18 focus:border-white/[0.15] focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* Empty */}
      {!loading && topics.length === 0 && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/50 via-[#09090b] to-violet-950/30" />
          <div className="absolute -top-1/2 left-1/3 h-[200px] w-[200px] rounded-full bg-indigo-700/[0.08] blur-[80px]" />
          <div className="relative flex flex-col items-center py-24 text-center">
            <p className="text-[32px] font-extralight text-white/30">Nothing here yet.</p>
            <p className="mt-3 text-[13px] text-white/20">
              Run detection to start capturing topics from your screen.
            </p>
            <Link
              to="/detection"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-3 text-[13px] font-medium text-white shadow-glow transition hover:bg-indigo-400"
            >
              <Scan size={13} />
              Start Detection
            </Link>
          </div>
        </div>
      )}

      {/* No results for search */}
      {!loading && topics.length > 0 && filtered.length === 0 && (
        <p className="py-12 text-center text-[13px] text-white/25">
          No topics match <span className="text-white/40">"{query}"</span>
        </p>
      )}

      {/* Topic index list */}
      {filtered.length > 0 && (
        <div>
          {filtered.map((t, i) => (
            <TopicRow key={t.id} topic={t} index={i} />
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && topics.length === 0 && (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-6 border-b border-white/[0.04] py-6">
              <div className="skeleton h-3.5 w-6 rounded" />
              <div className="flex-1 space-y-3">
                <div className="skeleton h-5 w-48 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
                <div className="flex gap-1.5">
                  {[1, 2, 3].map(j => <div key={j} className="skeleton h-5 w-16 rounded-md" />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
