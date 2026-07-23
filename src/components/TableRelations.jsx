import { useState } from 'react'

// Como el Model view de Power BI, pero con un formulario simple en vez de un
// diagrama arrastrable: elegís la tabla principal y armás relaciones
// Tabla A.Columna ↔ Tabla B.Columna. Al combinar, se hace un lookup (tipo
// VLOOKUP) que agrega las columnas de las tablas relacionadas a la principal.
export default function TableRelations({ tables, onConfirm, onCancel }) {
  const names = Object.keys(tables)
  const biggest = names.reduce((a, b) => (tables[b].length > tables[a].length ? b : a), names[0])

  const [principal, setPrincipal] = useState(biggest)
  const [relations, setRelations] = useState([])
  const [draft, setDraft] = useState({
    tableA: names[0], colA: Object.keys(tables[names[0]][0] || {})[0] || '',
    tableB: names[1] || names[0], colB: Object.keys(tables[names[1] || names[0]][0] || {})[0] || '',
  })

  const colsOf = (table) => (tables[table]?.length ? Object.keys(tables[table][0]) : [])

  const addRelation = () => {
    if (draft.tableA === draft.tableB) return
    setRelations(prev => [...prev, { ...draft }])
  }
  const removeRelation = (idx) => setRelations(prev => prev.filter((_, i) => i !== idx))

  // Chequeo simple de conectividad, solo para avisar antes de combinar
  const reachable = (() => {
    const seen = new Set([principal])
    let changed = true
    while (changed) {
      changed = false
      for (const r of relations) {
        if (seen.has(r.tableA) && !seen.has(r.tableB)) { seen.add(r.tableB); changed = true }
        if (seen.has(r.tableB) && !seen.has(r.tableA)) { seen.add(r.tableA); changed = true }
      }
    }
    return seen
  })()
  const unreachable = names.filter(n => !reachable.has(n))

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="card-title">🔗 Relacionar tablas</span>
          <button className="action-btn close" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Cargaste {names.length} tablas: {names.map(n => `${n} (${tables[n].length} filas)`).join(', ')}.
            Elegí la tabla principal y relacioná las demás por una columna en común.
          </p>

          <div className="cc-row">
            <label className="cc-label">Tabla principal</label>
            <select className="cc-select" value={principal} onChange={e => setPrincipal(e.target.value)}>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="cc-row">
            <label className="cc-label">Nueva relación</label>
            <div className="rel-form">
              <select className="cc-select" value={draft.tableA} onChange={e => setDraft(d => ({ ...d, tableA: e.target.value, colA: colsOf(e.target.value)[0] || '' }))}>
                {names.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select className="cc-select" value={draft.colA} onChange={e => setDraft(d => ({ ...d, colA: e.target.value }))}>
                {colsOf(draft.tableA).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="rel-arrow">↔</span>
              <select className="cc-select" value={draft.tableB} onChange={e => setDraft(d => ({ ...d, tableB: e.target.value, colB: colsOf(e.target.value)[0] || '' }))}>
                {names.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <select className="cc-select" value={draft.colB} onChange={e => setDraft(d => ({ ...d, colB: e.target.value }))}>
                {colsOf(draft.tableB).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="dash-save-btn" style={{ alignSelf: 'flex-start' }}
              disabled={draft.tableA === draft.tableB} onClick={addRelation}>
              + Agregar relación
            </button>
          </div>

          {relations.length > 0 && (
            <div className="cc-row">
              <label className="cc-label">Relaciones definidas</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {relations.map((r, i) => (
                  <div key={i} className="rel-item">
                    <span>{r.tableA}.{r.colA} ↔ {r.tableB}.{r.colB}</span>
                    <button onClick={() => removeRelation(i)} title="Quitar">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unreachable.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--red)' }}>
              ⚠ {unreachable.join(', ')} no {unreachable.length > 1 ? 'están relacionadas' : 'está relacionada'} con "{principal}" — no {unreachable.length > 1 ? 'se van a incluir' : 'se va a incluir'} al combinar.
            </p>
          )}

          <button className="dash-save-btn" onClick={() => onConfirm({ principal, relations })}>
            Combinar y cargar
          </button>
        </div>
      </div>
    </div>
  )
}
