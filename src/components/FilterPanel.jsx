import { useMemo, useState } from 'react'

function fmt(n) {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

const DATE_PRESETS = [
  { label: 'Hoy',         get: () => { const t = today(); return { from: t, to: t } } },
  { label: 'Esta semana', get: () => {
    const t = new Date(); const day = t.getDay() || 7
    const mon = new Date(t); mon.setDate(t.getDate() - day + 1)
    return { from: isoDate(mon), to: today() }
  }},
  { label: 'Este mes',    get: () => { const t = new Date(); return { from: `${t.getFullYear()}-${pad(t.getMonth()+1)}-01`, to: today() } } },
  { label: 'Este año',    get: () => ({ from: `${new Date().getFullYear()}-01-01`, to: today() }) },
]
function today()     { return isoDate(new Date()) }
function isoDate(d)  { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function pad(n)      { return String(n).padStart(2,'0') }

export default function FilterPanel({
  rows, categoricalCols, numericCols = [], dateCols = [],
  slicerFilters, rangeFilters = {}, dateFilters = {},
  onToggleSlicer, onRangeChange, onDateChange,
  onClearAll, clickFilter, onClearClick,
}) {
  const uniqueValues = useMemo(() => {
    const result = {}
    categoricalCols.forEach(col => {
      result[col] = [...new Set(rows.map(r => String(r[col])))].filter(Boolean).sort()
    })
    return result
  }, [rows, categoricalCols])

  const colStats = useMemo(() => {
    const result = {}
    numericCols.forEach(col => {
      const vals = rows.map(r => Number(r[col])).filter(isFinite)
      if (vals.length) result[col] = { min: Math.min(...vals), max: Math.max(...vals) }
    })
    return result
  }, [rows, numericCols])

  const [search, setSearch] = useState({}) // { col: término de búsqueda }

  const hasAnyFilter = clickFilter
    || Object.values(slicerFilters).some(v => v?.length)
    || Object.values(rangeFilters).some(Boolean)
    || Object.values(dateFilters).some(v => v?.from || v?.to)

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <span>Filtros</span>
        {hasAnyFilter && <button className="fp-clear-all" onClick={onClearAll}>Limpiar todo</button>}
      </div>

      {/* Selección de gráfico */}
      {clickFilter && (
        <div className="fp-section">
          <p className="fp-section-title">Selección de gráfico</p>
          <div className="fp-click-filter">
            <span>{clickFilter.col}: <strong>{clickFilter.values.join(', ')}</strong></span>
            <button onClick={onClearClick}>✕</button>
          </div>
        </div>
      )}

      {/* Filtros de rango numérico */}
      {numericCols.map(col => {
        const stats = colStats[col]
        if (!stats || stats.min === stats.max) return null
        const range  = rangeFilters[col]
        const lo     = range?.min ?? stats.min
        const hi     = range?.max ?? stats.max
        const step   = (stats.max - stats.min) / 100

        return (
          <div key={col} className="fp-section">
            <div className="fp-section-header">
              <p className="fp-section-title">{col}</p>
              {range && <button className="fp-clear-col" onClick={() => onRangeChange(col, null)}>limpiar</button>}
            </div>
            <div className="fp-range-dual">
              <div className="fp-range-row">
                <span className="fp-range-lbl">Desde</span>
                <input type="range" className="fp-slider"
                  min={stats.min} max={stats.max} step={step} value={lo}
                  onChange={e => onRangeChange(col, { min: +e.target.value, max: Math.max(+e.target.value, hi) })} />
                <span className="fp-range-val">{fmt(lo)}</span>
              </div>
              <div className="fp-range-row">
                <span className="fp-range-lbl">Hasta</span>
                <input type="range" className="fp-slider"
                  min={stats.min} max={stats.max} step={step} value={hi}
                  onChange={e => onRangeChange(col, { min: Math.min(lo, +e.target.value), max: +e.target.value })} />
                <span className="fp-range-val">{fmt(hi)}</span>
              </div>
            </div>
          </div>
        )
      })}

      {/* Filtros de fecha */}
      {dateCols.map(col => {
        const df       = dateFilters[col] || {}
        const isActive = df.from || df.to

        return (
          <div key={col} className="fp-section">
            <div className="fp-section-header">
              <p className="fp-section-title">{col}</p>
              {isActive && <button className="fp-clear-col" onClick={() => onDateChange(col, {})}>limpiar</button>}
            </div>
            <div className="fp-date-presets">
              {DATE_PRESETS.map(p => (
                <button key={p.label} className="fp-preset-btn" onClick={() => onDateChange(col, p.get())}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="fp-date-inputs">
              <div className="fp-date-field">
                <label className="fp-date-label">Desde</label>
                <input type="date" className="fp-date-input"
                  value={df.from || ''}
                  onChange={e => onDateChange(col, { ...df, from: e.target.value })} />
              </div>
              <div className="fp-date-field">
                <label className="fp-date-label">Hasta</label>
                <input type="date" className="fp-date-input"
                  value={df.to || ''}
                  onChange={e => onDateChange(col, { ...df, to: e.target.value })} />
              </div>
            </div>
          </div>
        )
      })}

      {/* Slicers categóricos */}
      {categoricalCols.map(col => {
        const selected = slicerFilters[col] || []
        const values   = uniqueValues[col]  || []
        const term     = (search[col] || '').trim().toLowerCase()
        const filtered = term ? values.filter(v => v.toLowerCase().includes(term)) : values
        return (
          <div key={col} className="fp-section">
            <div className="fp-section-header">
              <p className="fp-section-title">{col}</p>
              {selected.length > 0 && (
                <button className="fp-clear-col" onClick={() => onToggleSlicer(col, null)}>limpiar</button>
              )}
            </div>
            {values.length > 8 && (
              <input type="text" className="fp-search" placeholder="Buscar..."
                value={search[col] || ''}
                onChange={e => setSearch(prev => ({ ...prev, [col]: e.target.value }))} />
            )}
            <div className="fp-checkboxes">
              {filtered.slice(0, 30).map(val => (
                <label key={val} className="fp-check">
                  <input type="checkbox"
                    checked={selected.includes(val)}
                    onChange={() => onToggleSlicer(col, val)} />
                  <span>{val}</span>
                </label>
              ))}
              {filtered.length === 0 && <p className="fp-more">Sin coincidencias</p>}
              {filtered.length > 30 && <p className="fp-more">+{filtered.length - 30} valores</p>}
            </div>
          </div>
        )
      })}

      {categoricalCols.length === 0 && numericCols.length === 0 && dateCols.length === 0 && !clickFilter && (
        <p className="fp-empty">Cargá datos para ver los filtros disponibles.</p>
      )}
    </div>
  )
}
