import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import {
  Activity,
  Brain,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Network,
  Scan,
  Sparkles,
  GraduationCap,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth } from '../providers/AuthProvider'
import { Button } from '../components/ui/Button'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/detection', label: 'Detection', icon: Scan },
  { to: '/dashboard/analytics', label: 'Analytics', icon: Activity },
  { to: '/dashboard/timetable', label: 'Exam Timetable', icon: CalendarDays },
  { to: '/dashboard/dependency-graph', label: 'Concept Graph', icon: Network },
  { to: '/dashboard/topics', label: 'Topics', icon: Brain },
  { to: '/dashboard/suggestions', label: 'Suggestions', icon: Sparkles },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_0%_0%,rgba(99,102,241,0.12),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(600px_circle_at_100%_100%,rgba(132,0,255,0.08),transparent_40%)]" />
      </div>

      <div className="relative flex">
        {/* Sidebar */}
        <aside className="hidden h-screen w-72 flex-col border-r border-white/10 bg-black/40 backdrop-blur-xl md:flex">
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
            <Link to="/" className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white">
                <GraduationCap size={18} />
              </span>
              <span className="text-sm font-semibold tracking-tight">Adaptive Learning Agent</span>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-light tracking-tight transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white/90',
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="mb-3">
              <div className="text-sm font-medium text-white">{user?.name}</div>
              <div className="text-xs font-light text-white/50">{user?.email}</div>
            </div>
            <Button
              variant="secondary"
              className="w-full justify-start rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl md:hidden">
            <div className="flex h-16 items-center justify-between px-4">
              <Link to="/" className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 text-white">
                  <GraduationCap size={16} />
                </span>
                <span className="text-sm font-semibold tracking-tight">Adaptive Learning</span>
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
              </Button>
            </div>
          </header>

          <main className="relative mx-auto max-w-7xl px-6 py-8 md:px-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
