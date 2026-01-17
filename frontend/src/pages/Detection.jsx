import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Clock, LogOut, Power, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../providers/AuthProvider'
import { useDetector } from '../features/detector/DetectorContext'
import MagicBento from '../components/ui/MagicBento'

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function Detection() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { running, startedAt, topics, loading, error, start, stop, refreshTopics } = useDetector()
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
    <div className="relative min-h-screen bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_10%,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_80%_0%,rgba(99,102,241,0.18),transparent_45%)]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10 lg:px-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white">
              <Power size={16} className={running ? 'text-emerald-200' : 'text-white/70'} />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Adaptive Learning Agent</div>
              <div className="text-xs font-light tracking-tight text-white/55">Detection</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-light tracking-tight text-white/80 transition-colors hover:bg-white/10 sm:inline-flex"
            >
              Dashboard
            </Link>
            <Button
              variant="secondary"
              className="rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-10 md:px-10 lg:px-16">
        <MagicBento
          textAutoHide={true}
          enableStars={true}
          enableSpotlight={true}
          enableBorderGlow={true}
          enableTilt={true}
          enableMagnetism={true}
          clickEffect={true}
          spotlightRadius={300}
          particleCount={12}
          glowColor="132, 0, 255"
        >
          <div className="w-full">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card card--border-glow particle-container relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium tracking-tight text-white">Detector control</div>
                <div className="mt-2 text-sm font-light leading-relaxed text-white/60">
                  {running
                    ? 'Detection is active. Click the power button to stop.'
                    : 'Detection is currently off. Click the power button to start.'}
                </div>
              </div>
              <button
                type="button"
                onClick={toggle}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-light tracking-tight text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Working…' : 'Toggle'}
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center">
              <button
                type="button"
                onClick={toggle}
                disabled={loading}
                className="group relative transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                <div
                  className={
                    running
                      ? 'relative h-56 w-56 rounded-full bg-gradient-to-br from-emerald-500/90 to-emerald-400/60 shadow-2xl shadow-emerald-500/25 transition-all group-hover:shadow-emerald-500/35'
                      : 'relative h-56 w-56 rounded-full bg-gradient-to-br from-white/18 to-white/8 shadow-2xl shadow-black/40 transition-all group-hover:bg-white/20'
                  }
                >
                  <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
                  <div className="grid h-full w-full place-items-center text-white">
                    {loading ? (
                      <Spinner className="h-20 w-20 border-8 border-white/25 border-t-white" />
                    ) : (
                      <Power size={88} strokeWidth={2} className={running ? 'text-white' : 'text-white/90'} />
                    )}
                  </div>
                </div>
              </button>
            </div>

            {error ? (
              <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-light text-red-200">
                {error}
              </div>
            ) : null}
          </div>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="card card--border-glow particle-container relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <div className="text-xs font-light tracking-tight text-white/60">Status</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{running ? 'Running' : 'Stopped'}</div>
                <div className="mt-2 text-xs font-light leading-relaxed text-white/50">
                  {running ? 'Polling for new topics every few seconds.' : 'Start detection to begin topic capture.'}
                </div>
              </div>
                  <div className="card card--border-glow particle-container relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
                <div className="text-xs font-light tracking-tight text-white/60">Detection time</div>
                <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white">{elapsedLabel}</div>
                <div className="mt-2 text-xs font-light leading-relaxed text-white/50">
                  Session timer resets when you stop and start.
                </div>
              </div>
            </div>

                <div className="card card--border-glow particle-container relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium tracking-tight text-white">Recently detected</div>
                  <div className="mt-1 text-xs font-light tracking-tight text-white/55">
                    {running ? 'Updates automatically while running.' : 'Start detection to populate this list.'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={refreshTopics}
                  disabled={loading}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-light tracking-tight text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 max-h-52 space-y-3 overflow-y-auto pr-1">
                {topics?.length ? (
                  topics.map((t) => (
                    <div key={t.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-sm font-medium tracking-tight text-white">{t.title}</div>
                      <div className="mt-1 text-xs font-light text-white/50">ID: {t.id}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm font-light text-white/55">
                    No topics yet.
                  </div>
                )}
              </div>

              <div className="mt-5">
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-light text-white/70 hover:text-white">
                  Go to Dashboard <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
          </div>
        </MagicBento>
      </main>
    </div>
  )
}
