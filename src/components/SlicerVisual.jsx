import { useMemo, useState } from 'react'

function fmt(n) {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Slicer como visual en el canvas (igual que en Power BI): se ancla a UNA columna y
// filtra el dashboard entero al interactuar. El tipo de control depende del tipo de dato.
export default function SlicerVisual({ col, rows, kind, slicerValue, onToggleSlicer, dateValue, onDateChange, rangeValue, onRangeChange }) {
  if (!col) return <p className="chart-msg">Elegí un campo en ⚙ para este slicer.</p>
  if (kind === 'date')    return <TimelineSlicer col={col} rows={rows} value={dateValue} onChange={onDateChange} />
  if (kind === 'numeric') return <RangeSlicer col={col} rows={rows} value={rangeValue} onChange={onRangeChange} />
  return <CategoricalSlicer col={col} rows={rows} value={slicerValue} onToggle={onToggleSlicer} />
}

function CategoricalSlicer({ col, rows, value = [], onToggle }) {
  const [search, setSearch] = useState('')
  const values = useMemo(() => [...new Set(rows.map(r => String(r[col])))].filter(Boolean).sort(), [rows, col])
  const term = search.trim().toLowerCase()
  const filtered = term ? values.filter(v => v.toLowerCase().includes(term)) : values
  return (
    <div className="slicer-visual">
      {values.length > 8 && (
        <input type="text" className="fp-search" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
      )}
      <div className="fp-checkboxes">
        {filtered.slice(0, 50).map(val => (
          <label key={val} className="fp-check">
            <input type="checkbox" checked={value.includes(val)} onChange={() => onToggle(val)} />
            <span>{val}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="fp-more">Sin coincidencias</p>}
        {filtered.length > 50 && <p className="fp-more">+{filtered.length - 50} valores</p>}
      </div>
    </div>
  )
}

function RangeSlicer({ col, rows, value, onChange }) {
  const stats = useMemo(() => {
    const vals = rows.map(r => Number(r[col])).filter(isFinite)
    return vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null
  }, [rows, col])
  if (!stats || stats.min === stats.max) return <p className="chart-msg">Sin variación numérica para filtrar.</p>
  const lo = value?.min ?? stats.min
  const hi = value?.max ?? stats.max
  const step = (stats.max - stats.min) / 100
  return (
    <div className="slicer-visual fp-range-dual">
      <div className="fp-range-row">
        <span className="fp-range-lbl">Desde</span>
        <input type="range" className="fp-slider" min={stats.min} max={stats.max} step={step} value={lo}
          onChange={e => onChange({ min: +e.target.value, max: Math.max(+e.target.value, hi) })} />
        <span className="fp-range-val">{fmt(lo)}</span>
      </div>
      <div className="fp-range-row">
        <span className="fp-range-lbl">Hasta</span>
        <input type="range" className="fp-slider" min={stats.min} max={stats.max} step={step} value={hi}
          onChange={e => onChange({ min: Math.min(lo, +e.target.value), max: +e.target.value })} />
        <span className="fp-range-val">{fmt(hi)}</span>
      </div>
    </div>
  )
}

function monthKey(d)      { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function parseMonthKey(k) { const [y, m] = k.split('-').map(Number); return { y, m } }
function firstDayOfMonth(k) { const { y, m } = parseMonthKey(k); return `${y}-${String(m).padStart(2, '0')}-01` }
function lastDayOfMonth(k)  { const { y, m } = parseMonthKey(k); const d = new Date(y, m, 0); return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Barra de tiempo tipo Excel/Power BI: click selecciona un mes, click+arrastre selecciona
// un rango continuo (esto es lo que da la vista "acumulado hasta tal mes" sin lógica especial:
// arrastrar desde el primer mes con datos hasta el mes elegido produce ese rango).
function TimelineSlicer({ col, rows, value = {}, onChange }) {
  const months = useMemo(() => {
    const keys = new Set()
    for (const r of rows) {
      const d = new Date(r[col])
      if (!isNaN(d)) keys.add(monthKey(d))
    }
    return [...keys].sort()
  }, [rows, col])

  const [drag, setDrag] = useState(null) // { startIdx, endIdx } mientras se arrastra

  const selectedRange = useMemo(() => {
    if (!value.from && !value.to) return null
    let startIdx = 0, endIdx = months.length - 1
    if (value.from) { const i = months.indexOf(value.from.slice(0, 7)); if (i !== -1) startIdx = i }
    if (value.to)   { const i = months.indexOf(value.to.slice(0, 7));   if (i !== -1) endIdx = i }
    return { startIdx, endIdx }
  }, [value, months])

  if (!months.length) return <p className="chart-msg">Sin fechas válidas en esta columna.</p>

  const activeRange = drag || selectedRange

  const commit = (a, b) => {
    const [start, end] = a <= b ? [a, b] : [b, a]
    onChange({ from: firstDayOfMonth(months[start]), to: lastDayOfMonth(months[end]) })
  }

  const onMouseDownMonth = (idx) => {
    setDrag({ startIdx: idx, endIdx: idx })
    const move = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const target = el?.closest?.('[data-month-idx]')
      if (target) {
        const i = Number(target.dataset.monthIdx)
        setDrag(prev => prev ? { startIdx: prev.startIdx, endIdx: i } : { startIdx: idx, endIdx: i })
      }
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setDrag(curr => { if (curr) commit(curr.startIdx, curr.endIdx); return null })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div className="slicer-timeline">
      {selectedRange && !drag && (
        <button className="slicer-timeline-clear" onClick={() => onChange({})} title="Limpiar selección">✕ Limpiar</button>
      )}
      <div className="slicer-timeline-track">
        {months.map((k, i) => {
          const { y, m } = parseMonthKey(k)
          const inRange = activeRange && i >= Math.min(activeRange.startIdx, activeRange.endIdx) && i <= Math.max(activeRange.startIdx, activeRange.endIdx)
          return (
            <div key={k} data-month-idx={i}
              className={`slicer-month ${inRange ? 'active' : ''}`}
              onMouseDown={() => onMouseDownMonth(i)}>
              {MONTH_NAMES[m - 1]} {String(y).slice(2)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
