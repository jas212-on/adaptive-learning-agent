import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

/**
 * Breadcrumb component for navigation path display
 * @param {Object} props
 * @param {Array<{label: string, href?: string}>} props.items - Breadcrumb items
 */
export function Breadcrumb({ items = [] }) {
  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link
        to="/dashboard"
        className="flex items-center gap-1 text-white/50 transition hover:text-white/80"
      >
        <Home size={14} />
        <span className="hidden sm:inline">Dashboard</span>
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={index} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-white/30" />
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="max-w-[150px] truncate text-white/50 transition hover:text-white/80"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`max-w-[200px] truncate ${
                  isLast ? 'font-medium text-white' : 'text-white/50'
                }`}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default Breadcrumb
