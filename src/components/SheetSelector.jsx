export default function SheetSelector({ sheets, onSelect, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="card-title">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            Seleccioná una hoja
          </span>
          <button className="action-btn close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            El archivo tiene {sheets.length} hojas. ¿Cuál querés cargar?
          </p>
          {sheets.map(sheet => (
            <button key={sheet} className="sheet-btn" onClick={() => onSelect(sheet)}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="3" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth="1"/>
                <line x1="3" y1="9.5" x2="9" y2="9.5" stroke="currentColor" strokeWidth="1"/>
              </svg>
              {sheet}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
