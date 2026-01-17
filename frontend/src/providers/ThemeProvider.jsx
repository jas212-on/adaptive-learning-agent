import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

const STORAGE_KEY = 'ala.theme'

function applyThemeClass(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const initial = stored === 'dark' || stored === 'light' ? stored : 'light'
    setTheme(initial)
    applyThemeClass(initial)
  }, [])

  const updateTheme = useCallback((next) => {
    setTheme(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyThemeClass(next)
  }, [])

  const toggleTheme = useCallback(() => {
    updateTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, updateTheme])

  const value = useMemo(
    () => ({ theme, setTheme: updateTheme, toggleTheme }),
    [theme, updateTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
