import { Link } from 'react-router-dom'
import { Brain } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'

function levelVariant(level) {
  if (level === 'beginner') return 'success'
  if (level === 'intermediate') return 'primary'
  if (level === 'advanced') return 'warning'
  return 'neutral'
}

export function TopicCard({ topic }) {
  return (
    <Link to={`/dashboard/topics/${topic.id}`} className="block">
      <Card className="overflow-hidden transition hover:bg-bg-muted/50">
        <div className="flex items-start gap-4 p-5">
        <div className="mt-1 grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
          <Brain size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{topic.title}</div>
              <div className="mt-1 text-sm text-fg-muted">
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
              <Badge key={t} className="bg-bg-muted text-fg">
                {t}
              </Badge>
            ))}
          </div>
        </div>
        </div>
      </Card>
    </Link>
  )
}
