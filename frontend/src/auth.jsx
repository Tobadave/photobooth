import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [signup, setSignup] = useState(null) // pending Google signup (needs name + username)
  const [loading, setLoading] = useState(!!getToken())

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/me')
      setUser(user)
    } catch {
      setToken(null)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (getToken()) refresh()
  }, [refresh])

  const loginWithGoogle = async (credential) => {
    const res = await api.post('/auth/google', { credential })
    if (res.needs_signup) {
      setSignup(res)
      return res
    }
    setToken(res.token)
    setUser(res.user)
    return res
  }

  const completeSignup = async ({ name, username }) => {
    const res = await api.post('/auth/signup', {
      signup_token: signup.signup_token,
      name,
      username,
    })
    setToken(res.token)
    setUser(res.user)
    setSignup(null)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
  }

  return (
    <Ctx.Provider value={{ user, setUser, signup, loading, loginWithGoogle, completeSignup, logout }}>
      {children}
    </Ctx.Provider>
  )
}
