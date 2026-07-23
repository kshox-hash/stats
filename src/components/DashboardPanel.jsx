import { useState, useEffect } from 'react'
import { apiUrl } from '../api'

export default function DashboardPanel({ currentConfig, onLoad, onClose }) {
  const [list, setList]     = useState([])
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')
  const [err, setErr]       = useState('')

  const load = async () => {
    try {
      const res = await fetch(apiUrl('/api/dashboards'), { credentials: 'include' })
      if (res.ok) setList(await res.json())
      else setErr('No se pudo cargar la lista de dashboards.')
    } catch {
      setErr('No se pudo conectar con el servidor.')
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!name.trim()) { setErr('Escribí un nombre para el dashboard.'); return }
    setSaving(true)
    setErr('')
    try {
      const res = await fetch(apiUrl('/api/dashboards'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), config: currentConfig }),
      })
      if (res.ok) {
        setName(''); setMsg('Guardado'); load(); setTimeout(() => setMsg(''), 2000)
      } else {
        const data = await res.json().catch(() => ({}))
        setErr(data.error || `No se pudo guardar (error ${res.status}).`)
      }
    } catch {
      setErr('No se pudo conectar con el servidor. Revisá tu conexión.')
    }
    setSaving(false)
  }

  const del = async (id) => {
    try {
      await fetch(apiUrl(`/api/dashboards/${id}`), { method: 'DELETE', credentials: 'include' })
      load()
    } catch {
      setErr('No se pudo borrar el dashboard.')
    }
  }

  const loadDash = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/dashboards/${id}`), { credentials: 'include' })
      if (res.ok) { const d = await res.json(); onLoad(d.config); onClose() }
      else setErr('No se pudo cargar ese dashboard.')
    } catch {
      setErr('No se pudo conectar con el servidor.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="card-title">💾 Dashboards guardados</span>
          <button className="action-btn close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Guardar actual */}
          <div className="dash-save-row">
            <input className="dash-input" placeholder="Nombre del dashboard..." value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()} />
            <button className="dash-save-btn" onClick={save} disabled={saving}>
              {saving ? '...' : 'Guardar'}
            </button>
          </div>
          {msg && <p style={{ fontSize: 12, color: 'var(--green)' }}>✓ {msg}</p>}
          {err && <p style={{ fontSize: 12, color: 'var(--red)' }}>⚠ {err}</p>}

          {/* Lista */}
          {list.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
              No hay dashboards guardados
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {list.map(d => (
                <div key={d.id} className="dash-item">
                  <div>
                    <p className="dash-name">{d.name}</p>
                    <p className="dash-date">{new Date(d.updated_at).toLocaleString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="action-btn" onClick={() => loadDash(d.id)}>Cargar</button>
                    <button className="action-btn close" onClick={() => del(d.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
