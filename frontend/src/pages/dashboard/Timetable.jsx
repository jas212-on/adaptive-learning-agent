import { useState } from 'react'
import { CalendarDays, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import * as api from '../../services/api'

export default function Timetable() {
  const [syllabus, setSyllabus] = useState('Unit 1: Basics\nUnit 2: Intermediate\nUnit 3: Advanced')
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const syllabusLines = syllabus
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const res = await api.generateTimetable({ syllabusLines, days })
      setData(res)
    } catch (err) {
      setError(err?.message || 'Failed to generate timetable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays size={18} /> Personalized Exam Timetable Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Syllabus (one topic per line)</label>
              <textarea
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                className="mt-2 min-h-40 w-full rounded-xl border bg-card px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Days before exam</label>
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                min={1}
                className="mt-2 h-10 w-full rounded-xl border bg-card px-3 text-sm"
              />

              <Button className="mt-3 w-full" onClick={run} disabled={loading}>
                {loading ? <Spinner /> : <Wand2 size={18} />}
                Generate plan
              </Button>

              <div className="mt-3 text-xs text-fg-muted">
                Later: prioritize by detected weak areas + importance.
              </div>
            </div>
          </div>

          {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div> : null}

          {data ? (
            <div className="grid gap-3 md:grid-cols-2">
              {data.plan.map((d) => (
                <div key={d.day} className="rounded-xl border bg-bg-muted p-4">
                  <div className="text-sm font-semibold">Day {d.day}</div>
                  <ul className="mt-2 space-y-1 text-sm text-fg-muted">
                    {d.items.map((it, idx) => (
                      <li key={idx}>• {it.topic} — {it.task}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
