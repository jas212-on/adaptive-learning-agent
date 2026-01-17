import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, UserPlus, Wand2 } from 'lucide-react'
import { useAuth } from '../providers/AuthProvider'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import DarkVeil from '../components/ui/DarkVeil'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('Demo User')
  const [email, setEmail] = useState('demo@adaptive.ai')
  const [password, setPassword] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signup({ name, email, password })
      navigate('/detection')
    } catch (err) {
      setError(err?.message || 'Signup failed')
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
            <span className="text-xs font-light tracking-tight text-white/70">Get started in minutes</span>
          </div>

          <h1 className="mt-4 text-3xl font-extralight tracking-tight sm:text-4xl md:text-5xl">
            Create your account
          </h1>
          <p className="mt-4 text-sm font-light leading-relaxed text-white/65 sm:text-base">
            Build personalized roadmaps, visualize concept dependencies, and generate timetables tailored to how you
            actually study.
          </p>

          <div className="mt-8 grid gap-3 text-sm font-light text-white/60">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <Wand2 size={16} className="text-white/70" />
              </span>
              <span>AI-powered plans based on detected topics.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <UserPlus size={16} className="text-white/70" />
              </span>
              <span>Access your dashboard from anywhere.</span>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <CardHeader className="border-white/10">
              <CardTitle className="flex items-center gap-2 text-white">
                <UserPlus size={18} /> Sign up
              </CardTitle>
              <p className="mt-2 text-xs font-light leading-relaxed text-white/55">
                Create an account to unlock roadmaps, analytics, quizzes, and timetables.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-light tracking-tight text-white/70">Name</label>
                  <Input
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-white/25"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

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
                  {loading ? <Spinner /> : <UserPlus size={18} />}
                  {loading ? 'Creating account…' : 'Create account'}
                </Button>

                <div className="flex flex-col gap-2 pt-1 text-xs font-light text-white/55">
                  <div>
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium text-white/80 hover:text-white">
                      Login
                    </Link>
                  </div>
                  <div className="text-[11px] leading-relaxed text-white/45">
                    By creating an account, you agree to our{' '}
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
