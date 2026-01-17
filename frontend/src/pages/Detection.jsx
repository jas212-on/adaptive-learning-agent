import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Power } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../providers/AuthProvider'
import { useDetector } from '../features/detector/DetectorContext'

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function Detection() {
  const { user, logout } = useAuth()
  const { running, startedAt, loading, error, start, stop } = useDetector()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [running])

  const elapsedLabel = useMemo(() => {
    if (!running || !startedAt) return '00:00:00'
    return formatDuration(now - startedAt)
  }, [running, startedAt, now])

  const toggle = async () => {
    if (running) await stop()
    else await start()
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b bg-bg/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <div className="text-sm font-semibold">Adaptive Learning Agent</div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container-page py-3">
        <div className="mx-auto w-full max-w-4xl space-y-3">

          {/* Huge Power Button */}
          <div className="flex flex-col items-center justify-center py-8">
            <button
              type="button"
              onClick={toggle}
              disabled={loading}
              className="group relative transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              <div
                className={
                  running
                    ? 'h-64 w-64 rounded-full bg-gradient-to-br from-red-600 to-red-500 shadow-2xl shadow-red-500/50 transition-all group-hover:shadow-red-500/60'
                    : 'h-64 w-64 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 shadow-2xl shadow-emerald-500/50 transition-all group-hover:shadow-emerald-500/60'
                }
              >
                <div className="grid h-full w-full place-items-center text-white">
                  {loading ? (
                    <Spinner className="h-24 w-24 border-8 border-t-white" />
                  ) : (
                    <Power size={96} strokeWidth={2} />
                  )}
                </div>
              </div>
            </button>

            <div className="mt-8 text-center">
              <div className="text-3xl font-bold">
                {running ? 'Detector Running' : 'Detector Stopped'}
              </div>
              <div className="mt-2 text-lg text-fg-muted">
                {running
                  ? 'Click to shutdown and stop screen reading'
                  : 'Click to start reading the screen'}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-bg-muted p-6 text-center">
              <div className="text-sm text-fg-muted">Status</div>
              <div className="mt-2 text-2xl font-semibold">{running ? 'Running' : 'Stopped'}</div>
            </div>
            <div className="rounded-2xl border bg-bg-muted p-6 text-center">
              <div className="text-sm text-fg-muted">Detection Time</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{elapsedLabel}</div>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm">
              {error}
            </div>
          ) : null}

          <div className="pt-6">
            <Link to="/dashboard" className="block">
              <Button className="w-full" size="lg">
                Go to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
