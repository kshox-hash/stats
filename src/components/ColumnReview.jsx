import { useState } from 'react'

export default function ColumnReview({ columns, autoNamed, onConfirm, onSkip }) {
  const [names, setNames] = useState(() => Object.fromEntries(columns.map(c => [c, c])))

  const setName = (col, val) => setNames(prev => ({ ...prev, [col]: val }))

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="card-title">📝 Revisá los nombres de columna</span>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '55vh', overflowY: 'auto' }}>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            {autoNamed.length === 1
              ? 'Esta columna no tenía título en el Excel original — le pusimos un nombre provisorio, podés cambiarlo:'
              : `${autoNamed.length} columnas no tenían título en el Excel original — les pusimos un nombre provisorio, podés cambiarlos:`}
          </p>
          {columns.map(col => {
            const isAuto = autoNamed.includes(col)
            return (
              <div key={col} className="cr-row">
                <input
                  className={`cr-input${isAuto ? ' cr-input-auto' : ''}`}
                  value={names[col]}
                  onChange={e => setName(col, e.target.value)}
                />
                {isAuto && <span className="cr-badge">sin título</span>}
              </div>
            )
          })}
        </div>

        <div className="cr-footer">
          <button className="action-btn" onClick={onSkip}>Omitir</button>
          <button className="cr-continue" onClick={() => onConfirm(names)}>Continuar</button>
        </div>
      </div>
    </div>
  )
}
