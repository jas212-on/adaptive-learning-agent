import { Link, NavLink, Outlet } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10 lg:px-16">
          <Link to="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white">
              <GraduationCap size={18} />
            </span>
            <span className="tracking-tight">Adaptive Learning Agent</span>
          </Link>

          

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl px-3 py-2 text-sm font-light tracking-tight text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-light tracking-tight text-white transition-colors hover:bg-white/20"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex min-h-screen flex-col">
        <div className="flex-1">
          <Outlet />
        </div>

        <footer className="border-t border-white/10 bg-black">
          <div className="mx-auto max-w-7xl px-6 py-10 md:px-10 lg:px-16">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-light tracking-tight text-white/45">
                  © {new Date().getFullYear()} Adaptive Learning Agent. Powered by VioniX.
                </p>
                <p className="mt-2 max-w-xl text-xs font-light leading-relaxed text-white/35">
                  Build better learning momentum with real-time topic detection, dependency graphs, and AI-driven roadmaps.
                </p>
              </div>

              <div className="flex items-center gap-6">
                <Link
                  to="/privacy"
                  className="text-xs font-light tracking-tight text-white/45 transition-colors hover:text-white/70"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="text-xs font-light tracking-tight text-white/45 transition-colors hover:text-white/70"
                >
                  Terms
                </Link>
                <Link
                  to="/signup"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-light tracking-tight text-white/80 transition-colors hover:bg-white/10"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
