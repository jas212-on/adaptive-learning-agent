import { Link } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'

function levelVariant(level) {
  if (level === 'beginner') return 'success'
  if (level === 'intermediate') return 'primary'
  if (level === 'advanced') return 'warning'
  return 'neutral'
}

export function TopicCard({ topic }) {
  return (
    <Link to={`/dashboard/topics/${topic.id}`} className="block">
      <div className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]">
        <div className="flex items-start gap-4 p-5">
        <div className="mt-1 grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400">
          <Brain size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{topic.title}</div>
              <div className="mt-1 text-sm font-light text-white/50">
                Confidence:{' '}
                {topic.confidence === null || topic.confidence === undefined
                  ? '—'
                  : `${Math.round(topic.confidence * 100)}%`}
              </div>
            </div>
            <Badge variant={levelVariant(topic.level)} className="shrink-0">
              {topic.level}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(topic.tags || []).slice(0, 4).map((t) => (
              <Badge key={t} className="border border-white/10 bg-white/5 text-white/70">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        </div>
      </div>
    </Link>
  )
}
