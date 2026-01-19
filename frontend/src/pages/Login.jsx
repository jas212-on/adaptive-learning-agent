import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, LogIn, Sparkles } from 'lucide-react'
import { useAuth } from '../providers/AuthProvider'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import DarkVeil from '../components/ui/DarkVeil'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login({ email, password })
      const from = location?.state?.from
      navigate(typeof from === 'string' && from ? from : '/detection', { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="pointer-events-none absolute inset-0">
        <DarkVeil />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 pb-20 pt-28 md:px-10 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-16">
        <div className="max-w-xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-light tracking-tight text-white/80 transition-colors hover:bg-white/10"
          >
            <ArrowLeft size={14} />
            Back to Home
          </Link>

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
            <Sparkles size={14} className="text-white/70" />
            <span className="text-xs font-light tracking-tight text-white/70">Secure access</span>
          </div>

          <h1 className="mt-4 text-3xl font-extralight tracking-tight sm:text-4xl md:text-5xl">
            Welcome back
          </h1>
          <p className="mt-4 text-sm font-light leading-relaxed text-white/65 sm:text-base">
            Login to continue your learning session, generate roadmaps, and track progress across detected topics.
          </p>

          <div className="mt-8 grid gap-3 text-sm font-light text-white/60">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <LockKeyhole size={16} className="text-white/70" />
              </span>
              <span>Private by default, designed for focused learning.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <LogIn size={16} className="text-white/70" />
              </span>
              <span>Continue where you left off in seconds.</span>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <CardHeader className="border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <LogIn size={18} /> Login
              </CardTitle>
              <p className="mt-2 text-xs font-light leading-relaxed text-white/55">
                Use your email and password to access your dashboard.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-light tracking-tight text-white/70">Email</label>
                  <Input
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-white/25"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-light tracking-tight text-white/70">Password</label>
                  <Input
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-white/25"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    required
                  />
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-light text-red-200">
                    {error}
                  </div>
                ) : null}

                <Button
                  className="h-11 w-full rounded-2xl bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/30"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <Spinner /> : <LogIn size={18} />}
                  {loading ? 'Logging in…' : 'Login'}
                </Button>

                <div className="flex flex-col gap-2 pt-1 text-xs font-light text-white/55">
                  <div>
                    Don’t have an account?{' '}
                    <Link to="/signup" className="font-medium text-white/80 hover:text-white">
                      Sign up
                    </Link>
                  </div>
                  <div className="text-[11px] leading-relaxed text-white/45">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="text-white/70 hover:text-white">
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-white/70 hover:text-white">
                      Privacy Policy
                    </Link>
                    .
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
