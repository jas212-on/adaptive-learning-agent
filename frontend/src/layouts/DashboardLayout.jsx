import { useState } from 'react'
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Scan, BookOpen, Network, Clock,
  BarChart3, Lightbulb, FileText, CalendarDays, Users,
  LogOut, Menu, X, GraduationCap,
} from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth } from '../providers/AuthProvider'

const NAV_SECTIONS = [
  {
    items: [
      { to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true },
      { to: '/detection', label: 'Detection', icon: Scan },
    ],
  },
  {
    group: 'Learn',
    items: [
      { to: '/dashboard/topics', label: 'Topics', icon: BookOpen },
      { to: '/dashboard/dependency-graph', label: 'Concept Map', icon: Network },
      { to: '/dashboard/review', label: 'Review Queue', icon: Clock },
    ],
  },
  {
    group: 'Insights',
    items: [
      { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/dashboard/suggestions', label: 'Suggestions', icon: Lightbulb },
      { to: '/dashboard/report', label: 'Report', icon: FileText },
    ],
  },
  {
    group: 'Plan',
    items: [
      { to: '/dashboard/timetable', label: 'Timetable', icon: CalendarDays },
      { to: '/dashboard/classrooms', label: 'Classrooms', icon: Users },
    ],
  },
]

function NavItem({ item, onNavigate }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition-all duration-150 select-none',
          isActive
            ? 'text-white/90 font-medium'
            : 'text-white/32 font-normal hover:text-white/62',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator */}
          {isActive && (
            <span className="absolute left-0 top-1/2 h-[18px] w-[2px] -translate-y-1/2 rounded-r-full bg-indigo-400/70" />
          )}
          {/* Active bg */}
          {isActive && (
            <span className="absolute inset-0 rounded-lg bg-indigo-500/[0.07]" />
          )}
          {/* Hover bg */}
          <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-white/[0.035]" />

          <item.icon
            size={14}
            className={cn(
              'relative shrink-0 transition-colors duration-150',
              isActive ? 'text-indigo-400' : 'text-white/28 group-hover:text-white/52',
            )}
          />
          <span className="relative leading-none">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?'

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[52px] shrink-0 items-center px-4 border-b border-white/[0.05]">
        <Link to="/" onClick={onNavigate} className="group flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 rounded-md bg-indigo-500/20 blur-[6px]" />
            <div className="relative flex h-[26px] w-[26px] items-center justify-center rounded-md bg-gradient-to-br from-indigo-500/20 to-violet-500/10 ring-1 ring-white/10">
              <GraduationCap size={13} className="text-indigo-300" />
            </div>
          </div>
          <div className="leading-none">
            <div className="text-[12px] font-semibold tracking-tight text-white/75">adaptive</div>
            <div className="text-[8.5px] font-medium uppercase tracking-[0.14em] text-white/22 mt-0.5">
              learning
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.group && (
              <p className="mb-1.5 px-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/18">
                {section.group}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.to} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="shrink-0 border-t border-white/[0.05] p-3">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] transition-all duration-150 hover:bg-white/[0.04]"
        >
          <div className="relative grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-semibold text-white/45">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.03] ring-1 ring-white/[0.08]" />
            <span className="relative">{initials}</span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[11.5px] font-medium leading-none text-white/48">
              {user?.name || user?.email}
            </p>
          </div>
          <LogOut
            size={12}
            className="shrink-0 text-white/18 transition-colors duration-150 group-hover:text-white/42"
          />
        </button>
      </div>
    </div>
  )
}

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#09090b] text-white">

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] border-r border-white/[0.05] bg-[#09090b] md:flex md:flex-col">
        <Sidebar onNavigate={undefined} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[220px] border-r border-white/[0.05] bg-[#09090b] transition-transform duration-200 ease-spring md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Page content */}
      <div className="relative flex flex-col md:pl-[220px]">
        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#09090b]/92 px-4 backdrop-blur-xl md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.04] transition hover:bg-white/[0.07]"
            aria-label="Open navigation"
          >
            <Menu size={14} className="text-white/55" />
          </button>

          <div className="flex items-center gap-2">
            <GraduationCap size={13} className="text-indigo-400" />
            <span className="text-[13px] font-medium text-white/60">adaptive</span>
          </div>

          <div className="w-8" />
        </header>

        {/* Main content */}
        <main className="relative z-10 flex-1">
          <div className="mx-auto max-w-[820px] px-6 py-10 md:px-12 md:py-14">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
