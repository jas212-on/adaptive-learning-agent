import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../providers/ThemeProvider'
import { Button } from './ui/Button'

export function ThemeToggle({ variant = 'ghost' }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button variant={variant} onClick={toggleTheme} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </Button>
  )
}
