import { useOutletContext } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'

export default function DetectedInfo() {
  const { topic } = useOutletContext()

  return (
    <div className="space-y-4">
      <div className="text-sm text-fg-muted">
        What the detector saw (snippets will come from your real screen-reader backend later).
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(topic.snippets || []).map((s, idx) => (
          <div key={idx} className="rounded-xl border bg-bg-muted p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{s.where}</div>
              <Badge className="bg-card text-card-fg">{s.strength}</Badge>
            </div>
            <div className="mt-2 text-sm text-fg-muted">{s.text}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-sm font-semibold">Detected sub-concepts</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(topic.detectedConcepts || []).map((c) => (
            <div key={c.label} className="rounded-xl border bg-card p-3">
              <div className="text-sm font-medium">{c.label}</div>
              <div className="mt-1 text-xs text-fg-muted">Signal: {Math.round((c.score || 0) * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
