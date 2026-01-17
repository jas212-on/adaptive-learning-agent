import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import * as api from '../../services/api'

export default function Suggestions() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getSuggestions()
        if (mounted) setData(res)
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load suggestions')
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
        <Spinner /> Loading suggestions…
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={18} /> Suggestions window
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm font-light text-white/50">
          The agent suggests connected topics and what to learn next.
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.suggestions.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">{s.title}</div>
              <div className="mt-1 text-sm font-light text-white/60">{s.reason}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
