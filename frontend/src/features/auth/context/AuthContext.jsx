import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '@lib/supabase'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const hadUser = useRef(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        hadUser.current = !!session?.user
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        // Pass user_metadata so backend can pick up name even on listener-triggered syncs
        const meta = session.user.user_metadata ?? {}
        authService.syncProfile({ name: meta.name }).catch(() => {})
        if (!hadUser.current) toast.success('Welcome', `Signed in as ${meta.name || session.user.email}`)
        hadUser.current = true
      }
      if (event === 'SIGNED_OUT') {
        hadUser.current = false
        toast.info('Signed out', 'You have been logged out')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
