import { useMemo } from 'react'
import { Play, RefreshCw, Square } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { useDetector } from '../../features/detector/DetectorContext'
import { TopicCard } from '../../features/detector/TopicCard'

export default function DashboardHome() {
  const { running, runId, topics, loading, error, start, stop, refreshTopics } = useDetector()

  const title = useMemo(() => {
    if (running) return 'Detector is running'
    return 'Detector is stopped'
  }, [running])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-semibold">{title}</div>
          <div className="text-sm text-fg-muted">
            {runId ? `Run: ${runId}` : 'Start detection to capture topics from the user screen.'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!running ? (
            <Button onClick={start} disabled={loading}>
              {loading ? <Spinner /> : <Play size={18} />}
              Start detection
            </Button>
          ) : (
            <Button variant="danger" onClick={stop} disabled={loading}>
              {loading ? <Spinner /> : <Square size={18} />}
              Stop
            </Button>
          )}

          <Button variant="secondary" onClick={refreshTopics} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw size={18} />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detected topics</CardTitle>
          </CardHeader>
          <CardContent>
            {topics.length === 0 ? (
              <div className="text-sm text-fg-muted">No topics detected yet.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {topics.map((t) => (
                  <TopicCard key={t.id} topic={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggestion window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-fg-muted">
              This panel will be fed by the agent (for now: placeholder suggestions).
            </div>
            <div className="space-y-2">
              <div className="rounded-xl border bg-bg-muted p-3">
                <div className="text-sm font-medium">Reinforce prerequisites</div>
                <div className="text-xs text-fg-muted">Cover basics connected to today’s topics.</div>
              </div>
              <div className="rounded-xl border bg-bg-muted p-3">
                <div className="text-sm font-medium">Do a quick quiz</div>
                <div className="text-xs text-fg-muted">Identify weak areas and prioritize them.</div>
              </div>
              <div className="rounded-xl border bg-bg-muted p-3">
                <div className="text-sm font-medium">Generate a roadmap</div>
                <div className="text-xs text-fg-muted">Step-by-step mastery plan per topic.</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
