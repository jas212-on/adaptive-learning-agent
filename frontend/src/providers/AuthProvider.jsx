import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

function toAppUser(sbUser) {
  if (!sbUser) return null
  const name =
    sbUser.user_metadata?.full_name ||
    sbUser.user_metadata?.name ||
    (sbUser.email ? sbUser.email.split('@')[0] : 'Learner')
  return {
    id: sbUser.id,
    email: sbUser.email,
    name,
    supabaseUser: sbUser,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!isMounted) return
        setUser(toAppUser(data?.session?.user ?? null))
      } catch {
        if (!isMounted) return
        setUser(null)
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setUser(toAppUser(session?.user ?? null))
      setLoading(false)
    })

    return () => {
      isMounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const appUser = toAppUser(data?.user ?? data?.session?.user ?? null)
    setUser(appUser)
    return appUser
  }, [])

  const signup = useCallback(async ({ name, email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })
    if (error) throw error

    // If email confirmation is enabled, session may be null until confirmed.
    const appUser = toAppUser(data?.session?.user ?? data?.user ?? null)
    setUser(appUser)
    return { user: appUser, needsEmailConfirmation: !data?.session }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    return supabase.auth.signOut()
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
