import { useState, useRef, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { saveAs } from 'file-saver'
import { useAuth } from './AuthContext'
import LightPanel from './LightPanel'
import KPIBar from './components/KPIBar'
import BarChartSVG from './components/BarChartSVG'
import ScatterChartSVG from './components/ScatterChartSVG'
import LineChartSVG from './components/LineChartSVG'
import AreaChartSVG from './components/AreaChartSVG'
import PieChartSVG from './components/PieChartSVG'
import WaterfallChartSVG from './components/WaterfallChartSVG'
import FunnelChartSVG from './components/FunnelChartSVG'
import TreemapSVG from './components/TreemapSVG'
import GaugeSVG from './components/GaugeSVG'
import TabBar from './components/TabBar'
import FilterPanel from './components/FilterPanel'
import './App.css'

// ── Paleta ──────────────────────────────────────────────────────────────────
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']

// ── Tipos de gráfico agrupados ───────────────────────────────────────────────
const CHART_GROUPS = [
  { label: 'Comparación', ids: ['bar', 'waterfall'] },
  { label: 'Tendencia',   ids: ['line', 'area'] },
  { label: 'Proporción',  ids: ['pie', 'funnel', 'treemap'] },
  { label: 'Relación',    ids: ['scatter'] },
  { label: 'KPI',         ids: ['gauge'] },
]
const CHART_META = {
  bar:       'Barras',
  waterfall: 'Cascada',
  line:      'Líneas',
  area:      'Área',
  pie:       'Torta',
  funnel:    'Embudo',
  treemap:   'Treemap',
  scatter:   'Dispersión',
  gauge:     'Gauge',
}

// ── Utilidades ───────────────────────────────────────────────────────────────
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function isDateLike(v) {
  if (!v || typeof v !== 'string' || v.length < 6) return false
  return /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(v) && !isNaN(Date.parse(v))
}

function detectColumns(rows) {
  if (!rows.length) return { labelCol: null, numericCols: [], categoricalCols: [], dateCols: [] }
  const keys     = Object.keys(rows[0])
  const numeric  = keys.filter(k => rows.some(r => typeof r[k] === 'number'))
  const dateCols = keys.filter(k => !numeric.includes(k) && rows.some(r => isDateLike(r[k])))
  const categ    = keys.filter(k => !numeric.includes(k) && !dateCols.includes(k))
  const label    = categ[0] ?? keys[0]
  return { labelCol: label, numericCols: numeric.filter(k => k !== label), categoricalCols: categ, dateCols }
}

function fmt(n) {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

// Agrupa por labelCol, suma numéricos, limita a `limit` categorías + "Otros"
function aggregateRows(rows, labelCol, numericCols, limit) {
  const map = new Map()
  for (const row of rows) {
    const key = String(row[labelCol] ?? '')
    if (!map.has(key)) {
      const obj = { [labelCol]: key }
      for (const col of numericCols) obj[col] = 0
      map.set(key, obj)
    }
    const agg = map.get(key)
    for (const col of numericCols) agg[col] += Number(row[col]) || 0
  }
  let result = [...map.values()]
  if (limit && result.length > limit) {
    const sorted = [...result].sort((a, b) => (b[numericCols[0]] || 0) - (a[numericCols[0]] || 0))
    const top    = sorted.slice(0, limit)
    const rest   = sorted.slice(limit)
    const otros  = { [labelCol]: `Otros (${rest.length})` }
    for (const col of numericCols) otros[col] = rest.reduce((s, r) => s + (r[col] || 0), 0)
    top.push(otros)
    return top
  }
  return result
}


// ── Estado inicial de página ─────────────────────────────────────────────────
const freshPage = () => ({ charts: [] })

let pageCounter = 1

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { user, logout } = useAuth()

  // Datos
  const [rows, setRows]         = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError]       = useState('')
  const [dragging, setDragging] = useState(false)

  // Páginas
  const [pages, setPages]           = useState([{ id: 'p1', name: 'Página 1' }])
  const [activePage, setActivePage] = useState('p1')
  const [pageData, setPageData]     = useState({ p1: freshPage() })

  // Posiciones y z-order de paneles flotantes
  const [panelPos, setPanelPos] = useState({})
  const [zOrder, setZOrder]     = useState([])
  const bringToFront = (id) => setZOrder(prev => [...prev.filter(x => x !== id), id])
  const getZIndex    = (id) => { const i = zOrder.indexOf(id); return i === -1 ? 200 : 200 + i }

  // Filtros
  const [clickFilter, setClickFilter]     = useState(null)  // { col, value }
  const [slicerFilters, setSlicerFilters] = useState({})    // { col: string[] }
  const [rangeFilters, setRangeFilters]   = useState({})    // { col: { min, max } }
  const [dateFilters, setDateFilters]     = useState({})    // { col: { from, to } }

  // KPI
  const [kpiAgg, setKpiAgg]               = useState({})   // { col: 'sum'|'avg'|'max'|'min'|'count' }
  const [kpiThresholds, setKpiThresholds] = useState({})   // { col: { enabled, value, direction } }

  // UI
  const [expanded, setExpanded]           = useState(null)
  const [showFilters, setShowFilters]     = useState(false)
  const fileInputRef = useRef(null)
  const chartRefs    = useRef({})
  const mainRef      = useRef(null)

  // ── Página actual ──────────────────────────────────────────────────────────
  const pg = pageData[activePage] ?? freshPage()

  const updatePg = (fn) => setPageData(prev => ({
    ...prev,
    [activePage]: fn(prev[activePage] ?? freshPage())
  }))

  // ── Datos filtrados ────────────────────────────────────────────────────────
  const { labelCol, numericCols, categoricalCols, dateCols } = useMemo(() => detectColumns(rows), [rows])
  const columns = rows.length ? Object.keys(rows[0]) : []

  // Filas filtradas por slicers/rangos/fechas — SIN clickFilter (base para los gráficos)
  const chartRows = useMemo(() => {
    let r = rows
    for (const [col, vals] of Object.entries(slicerFilters)) {
      if (vals?.length) r = r.filter(row => vals.includes(String(row[col])))
    }
    for (const [col, range] of Object.entries(rangeFilters)) {
      if (range) r = r.filter(row => {
        const v = Number(row[col])
        return (range.min == null || v >= range.min) && (range.max == null || v <= range.max)
      })
    }
    for (const [col, range] of Object.entries(dateFilters)) {
      if (range?.from || range?.to) r = r.filter(row => {
        const d = new Date(row[col])
        if (isNaN(d)) return true
        if (range.from && d < new Date(range.from)) return false
        if (range.to   && d > new Date(range.to + 'T23:59:59')) return false
        return true
      })
    }
    return r
  }, [rows, slicerFilters, rangeFilters, dateFilters])

  // Filas para la tabla — CON clickFilter aplicado
  const filteredRows = useMemo(() => {
    if (!clickFilter) return chartRows
    return chartRows.filter(row => String(row[clickFilter.col]) === clickFilter.value)
  }, [chartRows, clickFilter])

  const isFiltered = filteredRows.length < rows.length

  // ── Acciones de datos ──────────────────────────────────────────────────────
  const loadFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx','xls','csv'].includes(ext)) { setError('Formato no soportado.'); return }
    setError('')
    setFileName(file.name)
    const data = await parseFile(file)
    setRows(data)
    setClickFilter(null)
    setSlicerFilters({})
    setRangeFilters({})
    setDateFilters({})
    setKpiAgg({})
    updatePg(pg => ({ ...pg, charts: [] }))
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0])
  }, [])

  // ── Gráficos ───────────────────────────────────────────────────────────────
  const toggleChart = (id) => updatePg(pg => ({
    ...pg,
    charts: pg.charts.includes(id) ? pg.charts.filter(c => c !== id) : [...pg.charts, id],
  }))

  // ── Filtros ────────────────────────────────────────────────────────────────
  const applyFilter = (value) =>
    setClickFilter(prev => prev?.value === String(value) ? null : { col: labelCol, value: String(value) })

  const toggleSlicer = (col, val) => {
    if (val === null) { setSlicerFilters(prev => ({ ...prev, [col]: [] })); return }
    setSlicerFilters(prev => {
      const curr = prev[col] || []
      return { ...prev, [col]: curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val] }
    })
  }

  const clearAllFilters = () => { setClickFilter(null); setSlicerFilters({}); setRangeFilters({}); setDateFilters({}) }

  // ── Páginas ────────────────────────────────────────────────────────────────
  const addPage = () => {
    pageCounter++
    const id   = `p${pageCounter}`
    const name = `Página ${pageCounter}`
    setPages(prev => [...prev, { id, name }])
    setPageData(prev => ({ ...prev, [id]: freshPage() }))
    setActivePage(id)
  }

  const removePage = (id) => {
    if (pages.length === 1) return
    const idx  = pages.findIndex(p => p.id === id)
    const next = pages[idx === 0 ? 1 : idx - 1]
    setPages(prev => prev.filter(p => p.id !== id))
    setPageData(prev => { const n = { ...prev }; delete n[id]; return n })
    if (activePage === id) setActivePage(next.id)
  }

  const renamePage = (id, name) =>
    setPages(prev => prev.map(p => p.id === id ? { ...p, name } : p))

  // ── Exportar ───────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filteredRows), 'Datos')
    XLSX.writeFile(wb, `datos-${Date.now()}.xlsx`)
  }

  const exportPDF = async () => {
    if (!mainRef.current) return
    const canvas  = await html2canvas(mainRef.current, { scale: 1.5, backgroundColor: '#f2f2f8' })
    const imgData = canvas.toDataURL('image/png')
    const pdf     = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
    pdf.save('dashboard.pdf')
  }

  const downloadChart = async (refKey) => {
    const el = chartRefs.current[refKey]
    if (!el) return
    const canvas = await html2canvas(el, { backgroundColor: '#fff', scale: 2 })
    canvas.toBlob(blob => saveAs(blob, `grafico-${refKey}.png`))
  }

  // ── Construir gráfico ──────────────────────────────────────────────────────
  function buildChart(id, fullscreen = false) {

    const aggNote = (original, agg) => original > agg.length
      ? <span className="agg-note">Agrupado por {labelCol} · {agg.length} categorías de {original} filas</span>
      : null

    switch (id) {

      case 'bar': {
        const agg = aggregateRows(chartRows, labelCol, numericCols, 60)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <BarChartSVG data={agg} labelCol={labelCol} numericCols={numericCols}
                clickFilter={clickFilter} onBarClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'waterfall': {
        const col = numericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = aggregateRows(chartRows, labelCol, [col], 60)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <WaterfallChartSVG data={agg} labelCol={labelCol} valueCol={col}
                clickFilter={clickFilter} onBarClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'line': {
        const agg = aggregateRows(chartRows, labelCol, numericCols, 80)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <LineChartSVG data={agg} labelCol={labelCol} numericCols={numericCols}
                clickFilter={clickFilter} onPointClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'area': {
        const agg = aggregateRows(chartRows, labelCol, numericCols, 80)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <AreaChartSVG data={agg} labelCol={labelCol} numericCols={numericCols}
                clickFilter={clickFilter} onPointClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'pie': {
        const col = numericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = aggregateRows(chartRows, labelCol, [col], 12)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <PieChartSVG data={agg} labelCol={labelCol} valueCol={col}
                clickFilter={clickFilter} onSliceClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'funnel': {
        const col = numericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = aggregateRows(chartRows, labelCol, [col], 10)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <FunnelChartSVG data={agg} labelCol={labelCol} valueCol={col}
                clickFilter={clickFilter} onSliceClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'treemap': {
        const col = numericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = aggregateRows(chartRows, labelCol, [col], 30)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <TreemapSVG data={agg} labelCol={labelCol} valueCol={col}
                clickFilter={clickFilter} onCellClick={applyFilter} />
            </div>
          </div>
        )
      }

      case 'scatter': {
        if (!numericCols.length) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        return (
          <ScatterChartSVG data={chartRows} labelCol={labelCol} numericCols={numericCols}
            clickFilter={clickFilter} onPointClick={applyFilter} />
        )
      }

      case 'gauge': {
        const col      = numericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const value    = filteredRows.reduce((s, r) => s + (Number(r[col]) || 0), 0)
        const maxValue = rows.reduce((s, r) => s + (Number(r[col]) || 0), 0)
        return <GaugeSVG value={value} maxValue={maxValue} col={col} />
      }

      default: return null
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totalFilters = (clickFilter ? 1 : 0)
    + Object.values(slicerFilters).filter(v => v?.length).length
    + Object.values(rangeFilters).filter(Boolean).length
    + Object.values(dateFilters).filter(v => v?.from || v?.to).length

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-logo">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="1" y="11" width="4" height="10" rx="1" fill="#F2C811"/>
            <rect x="7" y="7"  width="4" height="14" rx="1" fill="#0078D4"/>
            <rect x="13" y="3" width="4" height="18" rx="1" fill="#47A85C"/>
            <rect x="19" y="1" width="2" height="20" rx="1" fill="#E04837"/>
          </svg>
          DataViz Pro
        </div>
        {fileName && <span className="header-file">{fileName}</span>}

        {rows.length > 0 && (
          <div className="header-actions">
            <button className="hbtn" onClick={exportExcel} title="Exportar datos a Excel">↓ Excel</button>
            <button className="hbtn" onClick={exportPDF}   title="Exportar dashboard a PDF">↓ PDF</button>
            <button className={`hbtn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}>
              Filtros {totalFilters > 0 && <span className="filter-count">{totalFilters}</span>}
            </button>
          </div>
        )}

        <div className="header-user">
          <span>{user?.name}</span>
          <button className="btn-logout" onClick={logout}>Salir</button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="body">

        {/* Sidebar de visualizaciones */}
        <aside className="viz-sidebar">
          {CHART_GROUPS.map(group => (
            <div key={group.label} className="viz-group">
              <p className="viz-group-label">{group.label}</p>
              <div className="viz-grid">
                {group.ids.map(id => {
                  const active = pg.charts.includes(id)
                  return (
                    <button key={id}
                      className={`viz-btn ${active ? 'active' : ''} ${!rows.length ? 'locked' : ''}`}
                      onClick={() => rows.length && toggleChart(id)}
                      title={CHART_META[id]}>
                      <span className="viz-icon"><ChartIcon type={id} active={active} size={20} /></span>
                      <span className="viz-name">{CHART_META[id]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {rows.length > 0 && (
            <button className="viz-change"
              onClick={() => { setRows([]); setFileName(''); setClickFilter(null); setSlicerFilters({}) }}>
              ↩ Cambiar archivo
            </button>
          )}
        </aside>

        {/* Área principal */}
        <main className="content" ref={mainRef}>
          {!rows.length ? (
            <div className={`dropzone ${dragging ? 'over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
              <UploadIcon />
              <h2>Subir archivo de datos</h2>
              <p>Arrastrá y soltá un Excel o CSV<br />o hacé click para seleccionar</p>
              {error && <span className="error-msg">{error}</span>}
              <div className="formats">.xlsx &nbsp;·&nbsp; .xls &nbsp;·&nbsp; .csv</div>
            </div>
          ) : (
            <div className="dash-content">
              {/* KPI Bar */}
              {numericCols.length > 0 && (
                <KPIBar rows={filteredRows} allRows={rows}
                  numericCols={numericCols} aggs={kpiAgg}
                  onAggChange={(col, agg) => setKpiAgg(prev => ({ ...prev, [col]: agg }))}
                  thresholds={kpiThresholds}
                  onThresholdChange={(col, t) => setKpiThresholds(prev => ({ ...prev, [col]: t }))} />
              )}

              {/* Tabla */}
              <div className="sheet-wrap">
                <div className="sheet-bar">
                  <span className="sheet-info">
                    {isFiltered
                      ? <><span className="row-count filtered">{filteredRows.length}</span> de {rows.length} filas</>
                      : <>{rows.length} filas · {columns.length} columnas</>
                    }
                  </span>
                  {isFiltered && (
                    <div className="filter-badge">
                      <span>{clickFilter ? `${clickFilter.col}: ${clickFilter.value}` : 'Filtros activos'}</span>
                      <button onClick={clearAllFilters}>✕</button>
                    </div>
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {filteredRows.slice(0, 500).map((row, i) => (
                        <tr key={i}>{columns.map(c => <td key={c}>{row[c]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRows.length === 0 && <p className="table-more">Sin resultados</p>}
                  {filteredRows.length > 500 && <p className="table-more">Mostrando 500 de {filteredRows.length}</p>}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Panel de filtros (derecha) */}
        {showFilters && (
          <FilterPanel
            rows={rows}
            categoricalCols={categoricalCols}
            numericCols={numericCols}
            dateCols={dateCols}
            slicerFilters={slicerFilters}
            rangeFilters={rangeFilters}
            dateFilters={dateFilters}
            onToggleSlicer={toggleSlicer}
            onRangeChange={(col, range) => setRangeFilters(prev => ({ ...prev, [col]: range }))}
            onDateChange={(col, range) => setDateFilters(prev => ({ ...prev, [col]: range }))}
            onClearAll={clearAllFilters}
            clickFilter={clickFilter}
            onClearClick={() => setClickFilter(null)}
          />
        )}
      </div>

      {/* ── Tab Bar ── */}
      <TabBar pages={pages} activePage={activePage}
        onSelect={setActivePage} onAdd={addPage}
        onRemove={removePage} onRename={renamePage} />

      {/* ── Paneles ligeros flotantes ── */}
      {pg.charts.map(id => (
        <LightPanel key={id} title={CHART_META[id]}
          icon={<ChartIcon type={id} active size={14} />}
          onClose={() => toggleChart(id)}
          onExpand={() => setExpanded(id)}
          initialPos={panelPos[id]}
          onDragEnd={p => setPanelPos(prev => ({ ...prev, [id]: p }))}
          zIndex={getZIndex(id)}
          onFocus={() => bringToFront(id)}>
          <div ref={el => chartRefs.current[id] = el} style={{ height: '100%' }}>
            {buildChart(id, false)}
          </div>
        </LightPanel>
      ))}

      {/* ── Modal fullscreen ── */}
      {expanded && (
        <div className="modal-overlay" onClick={() => setExpanded(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="card-title">
                <ChartIcon type={expanded} active size={16} />
                {CHART_META[expanded]}
                {clickFilter && <span className="filter-pill">{clickFilter.value}</span>}
              </span>
              <div className="card-actions">
                <button className="action-btn" onClick={() => downloadChart(expanded)}>↓ PNG</button>
                <button className="action-btn close" onClick={() => setExpanded(null)}>✕</button>
              </div>
            </div>
            <div className="modal-chart" ref={el => chartRefs.current[`${expanded}-modal`] = el}>
              {buildChart(expanded, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Íconos ───────────────────────────────────────────────────────────────────
function UploadIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 56 56" fill="none" style={{ opacity: 0.5 }}>
      <rect x="8" y="20" width="40" height="30" rx="4" stroke="#999" strokeWidth="2"/>
      <path d="M20 20V16a8 8 0 0116 0v4" stroke="#999" strokeWidth="2"/>
      <path d="M28 30v12M22 36l6-6 6 6" stroke="#0078D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ChartIcon({ type, active, size = 15 }) {
  const c = active ? '#0078D4' : 'currentColor'
  switch (type) {
    case 'bar':       return <svg width={size} height={size} viewBox="0 0 18 18" fill={c}><rect x="1" y="10" width="3" height="7" rx="0.5"/><rect x="6" y="6" width="3" height="11" rx="0.5"/><rect x="11" y="3" width="3" height="14" rx="0.5"/><rect x="16" y="7" width="1.5" height="10" rx="0.5"/></svg>
    case 'waterfall': return <svg width={size} height={size} viewBox="0 0 18 18" fill="none"><rect x="1" y="12" width="3" height="5" rx="0.5" fill={c}/><rect x="6" y="5" width="3" height="7" rx="0.5" fill={c} opacity="0.5"/><rect x="11" y="7" width="3" height="5" rx="0.5" fill={c}/><rect x="16" y="3" width="1.5" height="9" rx="0.5" fill={c} opacity="0.7"/></svg>
    case 'line':      return <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="1,15 5,9 9,12 13,5 17,3"/></svg>
    case 'area':      return <svg width={size} height={size} viewBox="0 0 18 18" fill={c}><path d="M1 15 L5 9 L9 12 L13 5 L17 3 L17 15 Z" opacity="0.85"/></svg>
    case 'pie':       return <svg width={size} height={size} viewBox="0 0 18 18" fill={c}><path d="M9 2 A7 7 0 0 1 16 9 L9 9 Z"/><path d="M16 9 A7 7 0 0 1 3.7 13.7 L9 9 Z" opacity="0.7"/><path d="M3.7 13.7 A7 7 0 0 1 9 2 L9 9 Z" opacity="0.4"/></svg>
    case 'funnel':    return <svg width={size} height={size} viewBox="0 0 18 18" fill={c}><path d="M2 3h14l-5 6v5l-4-2V9Z" opacity="0.85"/></svg>
    case 'treemap':   return <svg width={size} height={size} viewBox="0 0 18 18" fill={c}><rect x="1" y="1" width="9" height="9" rx="1" opacity="0.9"/><rect x="12" y="1" width="5" height="4" rx="1" opacity="0.7"/><rect x="12" y="7" width="5" height="3" rx="1" opacity="0.5"/><rect x="1" y="12" width="5" height="5" rx="1" opacity="0.6"/><rect x="8" y="12" width="9" height="5" rx="1" opacity="0.4"/></svg>
    case 'scatter':   return <svg width={size} height={size} viewBox="0 0 18 18" fill={c}><circle cx="3" cy="14" r="1.5"/><circle cx="7" cy="10" r="1.5"/><circle cx="10" cy="12" r="1.5"/><circle cx="13" cy="6" r="1.5"/><circle cx="16" cy="4" r="1.5"/><circle cx="8" cy="5" r="1.5"/></svg>
    case 'gauge':     return <svg width={size} height={size} viewBox="0 0 18 18" fill="none"><path d="M2 13 A7 7 0 0 1 16 13" stroke={c} strokeWidth="2.5" strokeLinecap="round"/><path d="M9 13 L12 7" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><circle cx="9" cy="13" r="1.5" fill={c}/></svg>
    default:          return null
  }
}
