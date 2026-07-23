import { createContext, useContext, useEffect, useState } from 'react'
import { apiUrl } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = cargando
  const [loading, setLoading] = useState(true)

  // Login desactivado a pedido del usuario: no lo necesita y evita tener que
  // andar reconfigurando CORS/FRONTEND_URL cada vez que cambia la URL del
  // frontend. Para reactivarlo, volver a llamar /api/auth/me acá (ver git log).
  useEffect(() => {
    setUser({ name: 'Demo', email: 'demo@demo.com' })
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión')
    setUser(data)
  }

  const logout = async () => {
    await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
