import { useState, useEffect } from 'react'

export default function DashboardPanel({ currentConfig, onLoad, onClose }) {
  const [list, setList]     = useState([])
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState('')

  const load = async () => {
    const res = await fetch('/api/dashboards', { credentials: 'include' })
    if (res.ok) setList(await res.json())
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/dashboards', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), config: currentConfig }),
    })
    setSaving(false)
    if (res.ok) { setName(''); setMsg('Guardado'); load(); setTimeout(() => setMsg(''), 2000) }
  }

  const del = async (id) => {
    await fetch(`/api/dashboards/${id}`, { method: 'DELETE', credentials: 'include' })
    load()
  }

  const loadDash = async (id) => {
    const res = await fetch(`/api/dashboards/${id}`, { credentials: 'include' })
    if (res.ok) { const d = await res.json(); onLoad(d.config); onClose() }
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
            <button className="dash-save-btn" onClick={save} disabled={saving || !name.trim()}>
              {saving ? '...' : 'Guardar'}
            </button>
          </div>
          {msg && <p style={{ fontSize: 12, color: 'var(--green)' }}>✓ {msg}</p>}

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
