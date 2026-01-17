import { Link, Outlet } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b bg-bg/80 backdrop-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-fg">
              <GraduationCap size={18} />
            </span>
            <span>Adaptive Learning Agent</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/login"
              className="rounded-xl px-3 py-2 text-sm font-medium text-fg hover:bg-bg-muted"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="container-page py-10">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="container-page py-6 text-sm text-fg-muted">
          Prototype UI with mocked endpoints (backend will plug in later).
        </div>
      </footer>
    </div>
  )
}
