import { useOutletContext } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function DetectedInfo() {
  const { topic } = useOutletContext()

  return (
    <div className="space-y-4">
      <div className="text-sm text-fg-muted">Summary (generated from captured content)</div>

      <div className="rounded-xl border bg-card p-4">
        {topic.summary ? (
          <div className="text-sm text-fg leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                ul: (props) => <ul className="my-2 list-disc pl-5" {...props} />,
                ol: (props) => <ol className="my-2 list-decimal pl-5" {...props} />,
                li: (props) => <li className="my-1" {...props} />,
                strong: (props) => <strong className="font-semibold" {...props} />,
                em: (props) => <em className="italic" {...props} />,
                code: (props) => (
                  <code className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
                ),
                pre: (props) => (
                  <pre className="overflow-auto rounded bg-bg-muted p-3 font-mono text-[0.85em]" {...props} />
                ),
              }}
            >
              {topic.summary}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm text-fg-muted">No summary yet — start detection and capture some content.</div>
        )}
      </div>

      <div className="text-sm font-medium">Captured snippets</div>

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
    </div>
  )
}
