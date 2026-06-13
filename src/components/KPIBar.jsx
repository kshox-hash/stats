import { useState, useRef, useEffect } from 'react'

const AGGS = ['sum', 'avg', 'max', 'min', 'count']
const AGG_LABELS = { sum: 'Suma', avg: 'Prom', max: 'Máx', min: 'Mín', count: 'Cant' }
const AGG_FULL   = { sum: 'Suma', avg: 'Promedio', max: 'Máximo', min: 'Mínimo', count: 'Conteo' }

function compute(rows, col, agg) {
  const vals = rows.map(r => r[col]).filter(v => typeof v === 'number')
  if (!vals.length) return 0
  switch (agg) {
    case 'sum':   return vals.reduce((a, b) => a + b, 0)
    case 'avg':   return vals.reduce((a, b) => a + b, 0) / vals.length
    case 'max':   return Math.max(...vals)
    case 'min':   return Math.min(...vals)
    case 'count': return vals.length
    default:      return 0
  }
}

function fmt(n) {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

function KPIItem({ col, rows, allRows, agg, onAggChange, threshold, onThresholdChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const value    = compute(rows, col, agg)
  const allVal   = compute(allRows, col, agg)
  const filtered = rows.length < allRows.length
  const pct      = allVal !== 0 ? ((value / allVal) * 100).toFixed(0) : 100

  let alert = null
  if (threshold?.enabled && threshold?.value !== '' && threshold?.value != null) {
    const t = Number(threshold.value)
    if (isFinite(t))
      alert = threshold.direction === 'below' ? (value < t ? 'danger' : 'ok') : (value > t ? 'danger' : 'ok')
  }

  // Cerrar popover al clickear fuera
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className={`kpi-item${alert === 'danger' ? ' kpi-item-danger' : alert === 'ok' ? ' kpi-item-ok' : ''}`}>
      <span className="kpi-item-col">{col}</span>
      <span className="kpi-item-val">{fmt(value)}</span>

      <select className="kpi-item-agg" value={agg}
        onChange={e => onAggChange(col, e.target.value)}
        title={AGG_FULL[agg]}>
        {AGGS.map(a => <option key={a} value={a}>{AGG_LABELS[a]}</option>)}
      </select>

      {filtered && <span className="kpi-item-pct">{pct}%</span>}

      <button className={`kpi-item-bell${alert ? ' active' : ''}`}
        onClick={() => setOpen(v => !v)} title="Alerta">
        {alert === 'danger' ? '🔴' : alert === 'ok' ? '🟢' : '○'}
      </button>

      {open && (
        <div className="kpi-popover">
          <label className="kpi-pop-row">
            <input type="checkbox" checked={!!threshold?.enabled}
              onChange={e => onThresholdChange(col, { ...threshold, enabled: e.target.checked })} />
            Activar alerta
          </label>
          {threshold?.enabled && (
            <>
              <select className="kpi-pop-sel"
                value={threshold?.direction || 'below'}
                onChange={e => onThresholdChange(col, { ...threshold, direction: e.target.value })}>
                <option value="below">Si cae por debajo de</option>
                <option value="above">Si supera</option>
              </select>
              <input type="number" className="kpi-pop-input" placeholder="Umbral..."
                value={threshold?.value ?? ''}
                onChange={e => onThresholdChange(col, { ...threshold, value: e.target.value })} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function KPIBar({ rows, allRows, numericCols, aggs, onAggChange, thresholds = {}, onThresholdChange }) {
  return (
    <div className="kpi-nav">
      {numericCols.map(col => (
        <KPIItem key={col} col={col} rows={rows} allRows={allRows}
          agg={aggs[col] || 'sum'} onAggChange={onAggChange}
          threshold={thresholds[col]} onThresholdChange={onThresholdChange} />
      ))}
    </div>
  )
}
