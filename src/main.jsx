import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'
import Login from './Login.jsx'
import { useAuth } from './AuthContext.jsx'

function Root() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-loading">Cargando...</div>
  return user ? <App /> : <Login />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
