import { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '@services/auth.service'
import { toast } from '@components/common/Toaster'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('user_token')
    if (!token) { setLoading(false); return }

    authService.getMe()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('user_token'))
      .finally(() => setLoading(false))
  }, [])

  function loginSuccess({ token, user: loggedInUser }) {
    localStorage.setItem('user_token', token)
    setUser(loggedInUser)
    toast.success('Welcome', `Signed in as ${loggedInUser.name || loggedInUser.email}`)
  }

  function signOut() {
    localStorage.removeItem('user_token')
    setUser(null)
    toast.info('Signed out', 'You have been logged out')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut, loginSuccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
