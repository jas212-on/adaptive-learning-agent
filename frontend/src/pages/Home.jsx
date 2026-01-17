import { useNavigate } from 'react-router-dom'
import DarkVeil from '../components/ui/DarkVeil'
import {
  Brain,
  ChartColumn,
  Network,
  BookOpen,
  Calendar,
  Lightbulb,
  Sparkles,
  Target,
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Real-Time Topic Detection',
    description: 'Automatically captures and identifies what you\'re learning from your screen in real-time using advanced OCR and AI.',
  },
  {
    icon: Network,
    title: 'Concept Dependency Graph',
    description: 'Visualize relationships between topics with an interactive graph showing prerequisites and connected concepts.',
  },
  {
    icon: BookOpen,
    title: 'Personalized Roadmaps',
    description: 'AI-generated learning paths tailored to your detected topics, guiding you through optimal learning sequences.',
  },
  {
    icon: Target,
    title: 'Curated Resources',
    description: 'Get the best videos, articles, and documentation for each topic, ranked by quality and relevance.',
  },
  {
    icon: Calendar,
    title: 'Smart Timetables',
    description: 'Deterministic scheduling algorithm creates optimal study plans based on your availability and topic priorities.',
  },
  {
    icon: ChartColumn,
    title: 'Learning Analytics',
    description: 'Track your progress, time spent, quiz performance, and identify weak areas that need attention.',
  },
  {
    icon: Sparkles,
    title: 'Intelligent Suggestions',
    description: 'Discover related topics and next steps based on what you\'ve learned and your learning patterns.',
  },
  {
    icon: Lightbulb,
    title: 'Interactive Quizzes',
    description: 'Test your understanding with AI-generated quizzes and get instant feedback on your knowledge gaps.',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="bg-black">
      <section className="relative w-full overflow-hidden">
        <div className="absolute inset-0 z-0">
          <DarkVeil />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-6 pb-24 pt-32 sm:gap-8 sm:pt-40 md:px-10 lg:px-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="text-xl font-bold tracking-tight text-white/100">Adaptive Learning Agent</span>
          </div>

          <div className="w-full flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="max-w-3xl text-left text-4xl font-extralight leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              Transform How You Learn with AI-Powered Intelligence
            </h1>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/signup')}
                className="rounded-2xl border border-white/10 bg-white/10 px-10 py-5 text-lg font-light tracking-tight text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Get Started Free
              </button>
              <button
                onClick={() => navigate('/login')}
                className="rounded-2xl border border-white/10 px-10 py-5 text-lg font-light tracking-tight text-white/80 transition-colors hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                Sign In
              </button>
            </div>
          </div>

          <p className="max-w-xl text-left text-base font-light leading-relaxed tracking-tight text-white/75 sm:text-lg">
            An adaptive learning agent that watches what you study, detects topics in real-time, builds concept graphs,
            generates personalized roadmaps, and creates optimized study schedules — all powered by advanced AI.
          </p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
      </section>

      {/* Features Section */}
      <section className="relative bg-gradient-to-b from-black via-gray-950 to-black py-18 mb-16">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16">
          <div className="mb-16 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-light tracking-tight text-white/70 mb-4">
              <Sparkles size={12} />
              Powerful Features
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-tight text-white mb-4">
              Everything you need to learn smarter
            </h2>
            <p className="max-w-2xl mx-auto text-base font-light text-white/60">
              A comprehensive suite of AI-powered tools designed to accelerate your learning journey and help you master any subject.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white/80 transition-colors group-hover:bg-white/15">
                  <feature.icon size={20} />
                </div>
                <h3 className="mb-2 text-base font-medium text-white">{feature.title}</h3>
                <p className="text-sm font-light leading-relaxed text-white/50">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
