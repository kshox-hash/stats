import { useState } from 'react'

// Como el Navigator de Power BI: se pueden tildar varias hojas para cargarlas
// todas como tablas separadas (si son 2+, después se relacionan entre sí).
export default function SheetSelector({ sheets, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(() => new Set([sheets[0]]))

  const toggle = (sheet) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(sheet)) next.delete(sheet)
      else next.add(sheet)
      return next
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="card-title">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Seleccioná las hojas a cargar
          </span>
          <button className="action-btn close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            El archivo tiene {sheets.length} hojas. Tildá una o varias — si elegís más de una, después las vas a poder relacionar entre sí.
          </p>
          {sheets.map(sheet => (
            <label key={sheet} className="sheet-check-row">
              <input type="checkbox" checked={selected.has(sheet)} onChange={() => toggle(sheet)} />
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="3" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth="1"/>
                <line x1="3" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1"/>
              </svg>
              {sheet}
            </label>
          ))}
          <button className="dash-save-btn" style={{ marginTop: 8, alignSelf: 'flex-end' }}
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}>
            Cargar seleccionadas ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
