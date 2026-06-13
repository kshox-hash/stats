import { useState } from 'react'
import { useAuth } from './AuthContext'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="11" width="4" height="10" rx="1" fill="#F2C811"/>
            <rect x="7" y="7"  width="4" height="14" rx="1" fill="#0078D4"/>
            <rect x="13" y="3" width="4" height="18" rx="1" fill="#47A85C"/>
            <rect x="19" y="1" width="2" height="20" rx="1" fill="#E04837"/>
          </svg>
          <span>DataViz Pro</span>
        </div>

        <h1>Iniciar sesión</h1>
        <p className="login-sub">Ingresá con tu cuenta para continuar</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
