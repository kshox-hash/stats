import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import Login from './Login.jsx'
import { useAuth } from './AuthContext.jsx'
import EmbedView from './EmbedView.jsx'

function AuthedApp() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Cargando...</div>
  return user ? <App /> : <Login />
}

// /embed/:id es una página pública aparte — nunca pide login, ni carga el AuthProvider,
// para que se pueda incrustar en cualquier otro sitio sin depender de una sesión.
const embedMatch = window.location.pathname.match(/^\/embed\/([^/]+)/)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {embedMatch ? (
      <EmbedView id={embedMatch[1]} />
    ) : (
      <AuthProvider>
        <AuthedApp />
      </AuthProvider>
    )}
  </StrictMode>,
)
