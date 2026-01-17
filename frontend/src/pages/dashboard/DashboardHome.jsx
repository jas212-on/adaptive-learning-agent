import { useEffect } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { useDetector } from '../../features/detector/DetectorContext'
import { TopicCard } from '../../features/detector/TopicCard'

export default function DashboardHome() {
  const { topics, loading, error, refreshTopics } = useDetector()

  useEffect(() => {
    if (topics.length === 0) refreshTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-semibold">Dashboard</div>
          <div className="text-sm text-fg-muted">Detected topics and learning progress.</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/detection">
            <Button>
              Go to Detection
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Button variant="secondary" onClick={refreshTopics} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw size={18} />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Detected topics</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <div className="text-sm text-fg-muted">No topics detected yet. Start the detector from the Detection page.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topics.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
