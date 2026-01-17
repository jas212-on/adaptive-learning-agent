import { useEffect } from 'react'
import { useDetector } from '../../features/detector/DetectorContext'
import { TopicCard } from '../../features/detector/TopicCard'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

export default function TopicsIndex() {
  const { topics, refreshTopics } = useDetector()

  useEffect(() => {
    if (topics.length === 0) refreshTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>All detected topics</CardTitle>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <div className="text-sm font-light text-white/50">No topics detected yet.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
