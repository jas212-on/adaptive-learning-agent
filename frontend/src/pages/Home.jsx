import { Link } from 'react-router-dom'
import { ArrowRight, Brain, ChartColumn, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm">
            <Sparkles size={16} />
            Adaptive Learning Agent (Desktop UI)
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Learn faster from what you’re already doing.
          </h1>
          <p className="text-fg-muted">
            Start the detector, see detected topics as cards, drill down into what was detected, then
            explore explainers, roadmaps, resources, quizzes, and performance analytics.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg">
                Get started
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                I already have an account
              </Button>
            </Link>
          </div>

          <div className="text-xs text-fg-muted">
            Note: Backend endpoints are mocked for now.
          </div>
        </div>

        <div className="card card-pad">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-bg-muted p-4">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Brain size={18} />
              </div>
              <div className="font-medium">Topic Detection</div>
              <div className="text-sm text-fg-muted">Cards, confidence, and detected snippets.</div>
            </div>
            <div className="rounded-xl border bg-bg-muted p-4">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <ChartColumn size={18} />
              </div>
              <div className="font-medium">Analytics</div>
              <div className="text-sm text-fg-muted">Progress, time spent, performance insights.</div>
            </div>
            <div className="rounded-xl border bg-bg-muted p-4">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <Sparkles size={18} />
              </div>
              <div className="font-medium">Smart Suggestions</div>
              <div className="text-sm text-fg-muted">Next topics connected to what you learned.</div>
            </div>
            <div className="rounded-xl border bg-bg-muted p-4">
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <ShieldCheck size={18} />
              </div>
              <div className="font-medium">Personalization</div>
              <div className="text-sm text-fg-muted">Weak areas from quizzes and difficulty.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Detector workflow</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            Click “Start detection” → topics appear as cards → click a card to explore detected
            content and learning tools.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Professional structure</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            Clean routing, layouts, UI components, and a mock API layer you can swap with real
            endpoints later.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ready for backend</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-fg-muted">
            All pages are wired with placeholder calls; replace functions in <code>src/services/api.js</code>.
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
