import { useEffect, useState } from 'react'
import { Activity, Clock, GraduationCap, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import * as api from '../../services/api'

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-xs font-light text-white/50">
        <Icon size={16} /> {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  )
}

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getAnalytics()
        if (mounted) setData(res)
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load analytics')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/60">
        <Spinner /> Loading analytics…
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-white">Analytics</div>
          <div className="text-sm font-light text-white/60">Topics, progress, time spent, and performance insights.</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat icon={TrendingUp} label="Streak" value={`${data.streakDays} days`} />
        <Stat icon={Clock} label="Time spent" value={`${data.timeSpentMinutes} min`} />
        <Stat icon={GraduationCap} label="Topics learned" value={data.topicsLearned} />
        <Stat icon={Activity} label="Avg score" value={`${data.avgScore}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By topic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.byTopic.map((t) => (
            <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{t.title}</div>
                  <div className="text-xs font-light text-white/50">{t.minutes} min • score {t.score}%</div>
                </div>
                <div className="text-sm font-medium text-white/80">{Math.round(t.progress * 100)}%</div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${Math.round(t.progress * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
