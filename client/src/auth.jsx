import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState({ loading: true, user: null, profile: null, unreadNotifications: 0 })

  const refresh = useCallback(async () => {
    try {
      const data = await api('/auth/me')
      setMe({ loading: false, ...data })
    } catch {
      setMe({ loading: false, user: null, profile: null, unreadNotifications: 0 })
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setMe({ loading: false, user: null, profile: null, unreadNotifications: 0 })
  }, [])

  return <AuthContext.Provider value={{ ...me, refresh, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
