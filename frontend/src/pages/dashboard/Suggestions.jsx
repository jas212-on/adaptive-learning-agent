import { useEffect, useState } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import * as api from '../../services/api'

const PRIORITY_LABEL = { high: 'urgent', medium: 'suggested', low: 'optional' }
const PRIORITY_SIZE = {
  high: 'text-[20px] md:text-[24px]',
  medium: 'text-[17px] md:text-[20px]',
  low: 'text-[14px] md:text-[16px]',
}
const PRIORITY_TITLE_COLOR = {
  high: 'text-white/88',
  medium: 'text-white/70',
  low: 'text-white/50',
}
const CATEGORY_COLOR = {
  prerequisite: 'text-sky-400/70',
  parallel: 'text-violet-400/70',
  advanced: 'text-indigo-400/70',
}
const CATEGORY_LABEL = {
  prerequisite: 'Learn first',
  parallel: 'Learn alongside',
  advanced: 'Next level',
}

function SuggestionItem({ suggestion, index }) {
  const p = suggestion.priority || 'medium'
  const c = suggestion.category || 'parallel'

  return (
    <div
      className="group border-b border-white/[0.04] py-7 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Meta line */}
      <div className="mb-3 flex items-center gap-3">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.16em] ${CATEGORY_COLOR[c] || 'text-white/25'}`}>
          {CATEGORY_LABEL[c] || c}
        </span>
        <span className="text-white/12">·</span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/20">
          {PRIORITY_LABEL[p] || p}
        </span>
      </div>

      {/* Title — sized by priority */}
      <h2 className={`font-light leading-snug tracking-tight ${PRIORITY_SIZE[p]} ${PRIORITY_TITLE_COLOR[p]}`}>
        {suggestion.title}
      </h2>

      {/* Reason */}
      <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-white/28">
        {suggestion.reason}
      </p>

      {/* Related topics */}
      {suggestion.relatedTo?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {suggestion.relatedTo.map((t, i) => (
            <span key={i} className="rounded-md bg-white/[0.03] px-2 py-0.5 text-[10.5px] text-white/28">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Suggestions() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function load(force = false) {
    force ? setRefreshing(true) : setLoading(true)
    setError(null)
    try { setData(await api.getSuggestions(force)) }
    catch (e) { setError(e?.message || 'Failed to load') }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  const suggestions = data?.suggestions || []
  const sorted = [...suggestions].sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 }
    return (ord[a.priority] ?? 1) - (ord[b.priority] ?? 1)
  })
  const basedOn = data?.basedOnTopics || []

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/18">AI</p>
          <h1 className="mt-1.5 text-[38px] font-extralight tracking-tight text-white/88">
            What to study next.
          </h1>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/22 transition hover:text-white/48 disabled:opacity-30"
        >
          <RefreshCw size={10} className={refreshing ? 'animate-spin' : ''} />
          Regenerate
        </button>
      </div>

      {/* Context — based on topics */}
      {basedOn.length > 0 && !loading && (
        <p className="mb-8 text-[12px] text-white/28">
          Based on: {basedOn.join(', ')}.
        </p>
      )}

      {/* Error */}
      {(error || data?.error) && (
        <div className="mb-8 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-[12px] text-amber-300/70">
          <AlertCircle size={13} />
          {error || data?.error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-8">
          {[80, 56, 44, 36].map((h, i) => (
            <div key={i} className="border-b border-white/[0.04] pb-7 space-y-3">
              <div className="skeleton h-2.5 w-20 rounded" />
              <div className={`skeleton rounded`} style={{ height: `${h * 0.6}px`, width: `${40 + i * 10}%` }} />
              <div className="skeleton h-3 w-3/4 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Suggestions as editorial list */}
      {!loading && sorted.length > 0 && (
        <div>
          {sorted.map((s, i) => (
            <SuggestionItem key={s.id} suggestion={s} index={i} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && sorted.length === 0 && !error && (
        <div className="relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/30 via-transparent to-violet-950/20" />
          <div className="relative py-24 text-center">
            <p className="text-[28px] font-extralight text-white/25">No suggestions yet.</p>
            <p className="mt-3 text-[13px] text-white/18">
              Detect topics and complete quizzes to get personalized recommendations.
            </p>
          </div>
        </div>
      )}

      {data?.generatedAt && (
        <p className="mt-10 text-[10px] text-white/14">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}
