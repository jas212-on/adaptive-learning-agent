import { createContext, useContext, useEffect, useMemo } from 'react'

const ThemeContext = createContext(null)

function applyThemeClass() {
  const root = document.documentElement
  root.classList.remove('light')
  root.classList.add('dark')
}

export function ThemeProvider({ children }) {
  // Always use dark theme
  const theme = 'dark'

  useEffect(() => {
    applyThemeClass()
  }, [])

  const value = useMemo(() => ({ theme }), [])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
