import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../services/api'

const AuthContext = createContext(null)

const STORAGE_KEY = 'ala.session'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      setLoading(false)
      return
    }
    try {
      const parsed = JSON.parse(stored)
      setUser(parsed?.user ?? null)
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const res = await api.login({ email, password })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(res))
    setUser(res.user)
    return res.user
  }, [])

  const signup = useCallback(async ({ name, email, password }) => {
    const res = await api.signup({ name, email, password })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(res))
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: !!user, login, signup, logout }),
    [user, loading, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
