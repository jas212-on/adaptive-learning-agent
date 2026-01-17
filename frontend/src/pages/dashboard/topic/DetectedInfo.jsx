import { useOutletContext } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function DetectedInfo() {
  const { topic } = useOutletContext()

  return (
    <div className="space-y-4">
      <div className="text-sm font-light text-white/50">Summary (generated from captured content)</div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        {topic.summary ? (
          <div className="text-sm text-white/80 leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: (props) => <p className="mb-2 last:mb-0" {...props} />,
                ul: (props) => <ul className="my-2 list-disc pl-5" {...props} />,
                ol: (props) => <ol className="my-2 list-decimal pl-5" {...props} />,
                li: (props) => <li className="my-1" {...props} />,
                strong: (props) => <strong className="font-semibold text-white" {...props} />,
                em: (props) => <em className="italic" {...props} />,
                code: (props) => (
                  <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-white/90" {...props} />
                ),
                pre: (props) => (
                  <pre className="overflow-auto rounded bg-white/10 p-3 font-mono text-[0.85em]" {...props} />
                ),
              }}
            >
              {topic.summary}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-sm font-light text-white/40">No summary yet — start detection and capture some content.</div>
        )}
      </div>

      <div className="text-sm font-medium text-white">Captured snippets</div>

      <div className="grid gap-3 md:grid-cols-2">
        {(topic.snippets || []).map((s, idx) => (
          <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-white">{s.where}</div>
              <Badge className="border border-white/10 bg-white/5 text-white/70">{s.strength}</Badge>
            </div>
            <div className="mt-2 text-sm font-light text-white/60">{s.text}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
