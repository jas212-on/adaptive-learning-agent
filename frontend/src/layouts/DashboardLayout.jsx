import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  Brain,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Network,
  Sparkles,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth } from '../providers/AuthProvider'
import { ThemeToggle } from '../components/ThemeToggle'
import { Button } from '../components/ui/Button'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/analytics', label: 'Analytics', icon: Activity },
  { to: '/dashboard/suggestions', label: 'Suggestions', icon: Sparkles },
  { to: '/dashboard/timetable', label: 'Exam Timetable', icon: CalendarDays },
  { to: '/dashboard/dependency-graph', label: 'Concept Graph', icon: Network },
  { to: '/dashboard/topics', label: 'Topics', icon: Brain },
]

export function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex">
        <aside className="hidden h-screen w-72 flex-col border-r bg-bg/80 backdrop-blur md:flex">
          <div className="flex h-16 items-center justify-between px-4">
            <div className="text-sm font-semibold">Adaptive Learning Agent</div>
            <ThemeToggle variant="ghost" />
          </div>

          <nav className="flex-1 px-3 py-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-fg hover:bg-bg-muted',
                    isActive && 'bg-bg-muted',
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="border-t p-4">
            <div className="mb-3">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-xs text-fg-muted">{user?.email}</div>
            </div>
            <Button
              variant="secondary"
              className="w-full justify-start"
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

        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b bg-bg/80 backdrop-blur">
            <div className="container-page flex h-16 items-center justify-between">
              <div className="text-sm font-semibold md:hidden">Adaptive Learning Agent</div>
              <div className="flex items-center gap-2 md:hidden">
                <ThemeToggle />
                <Button
                  variant="secondary"
                  onClick={() => {
                    logout()
                    navigate('/login')
                  }}
                >
                  <LogOut size={18} />
                </Button>
              </div>
              <div className="hidden md:block" />
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" onClick={() => navigate('/dashboard/suggestions')}>
                  <Sparkles size={18} />
                  Agent Suggestions
                </Button>
              </div>
            </div>
          </header>

          <main className="container-page py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
