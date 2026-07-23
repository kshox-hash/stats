import { useState, useRef, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { toPng } from 'html-to-image'
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
import ChartConfig, { PALETTES } from './components/ChartConfig'
import ColumnReview from './components/ColumnReview'
import SheetSelector from './components/SheetSelector'
import DashboardPanel from './components/DashboardPanel'
import PinnedChart from './components/PinnedChart'
import PinnedPanel from './components/PinnedPanel'
import { apiUrl } from './api'
import './App.css'

// ── Paleta ──────────────────────────────────────────────────────────────────
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']

// ── Tipos de gráfico agrupados ───────────────────────────────────────────────
const CHART_GROUPS = [
  { label: 'Comparación', ids: ['bar', 'waterfall'] },
  { label: 'Tendencia',   ids: ['line', 'area'] },
  { label: 'Proporción',  ids: ['pie', 'funnel', 'treemap'] },
  { label: 'Relación',    ids: ['scatter'] },
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
function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        resolve(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function sheetToRows(wb, sheetName) {
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' })
}

function isDateLike(v) {
  if (!v || typeof v !== 'string' || v.length < 6) return false
  return /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(v) && !isNaN(Date.parse(v))
}

// Números guardados como texto en el Excel (columna con formato "Texto") también cuentan como numéricos
function isNumericLike(v) {
  if (typeof v === 'number') return isFinite(v)
  if (typeof v !== 'string') return false
  const s = v.trim()
  return s !== '' && isFinite(Number(s))
}

// SheetJS nombra "__EMPTY", "__EMPTY_1"... a las columnas cuyo encabezado venía vacío en el Excel.
// Le ponemos un nombre más claro basado en la posición real de la columna (como hace Power BI con "Column2").
function renameEmptyHeaders(rows) {
  if (!rows.length) return { rows, autoNamed: [] }
  const keys    = Object.keys(rows[0])
  const mapping = {}
  const autoNamed = []
  keys.forEach((k, i) => {
    if (/^__EMPTY(_\d+)?$/.test(k)) {
      const newName = `Columna ${i + 1}`
      mapping[k] = newName
      autoNamed.push(newName)
    }
  })
  if (!autoNamed.length) return { rows, autoNamed: [] }
  const renamedRows = rows.map(row => {
    const obj = {}
    for (const k of keys) obj[mapping[k] ?? k] = row[k]
    return obj
  })
  return { rows: renamedRows, autoNamed }
}

function detectColumns(rows) {
  if (!rows.length) return { labelCol: null, numericCols: [], categoricalCols: [], dateCols: [] }
  const keys    = Object.keys(rows[0])
  const numeric = keys.filter(k => {
    const vals = rows.map(r => r[k]).filter(v => v !== '' && v != null)
    return vals.length > 0 && vals.every(isNumericLike)
  })
  const dateCols = keys.filter(k => !numeric.includes(k) && rows.some(r => isDateLike(r[k])))
  const categ    = keys.filter(k => !numeric.includes(k) && !dateCols.includes(k))

  // Columna de agrupación por defecto: preferir la de menor cardinalidad.
  // Evita elegir automáticamente una columna tipo ID (Nº de orden, folio, etc.)
  // donde casi todos los valores son distintos y agrupar por ella no sirve de nada.
  let label = categ[0] ?? keys[0]
  if (categ.length > 1 && rows.length >= 20) {
    const uniqueRatio = col => new Set(rows.map(r => r[col])).size / rows.length
    if (uniqueRatio(label) > 0.5) {
      const better = categ
        .map(c => ({ c, ratio: uniqueRatio(c) }))
        .sort((a, b) => a.ratio - b.ratio)[0]
      if (better && better.ratio < uniqueRatio(label)) label = better.c
    }
  }

  return { labelCol: label, numericCols: numeric.filter(k => k !== label), categoricalCols: categ, dateCols }
}

function fmt(n) {
  if (!isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

const AGG_FNS = {
  sum:   vals => vals.reduce((a, b) => a + b, 0),
  avg:   vals => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
  max:   vals => vals.length ? Math.max(...vals) : 0,
  min:   vals => vals.length ? Math.min(...vals) : 0,
  count: vals => vals.length,
}

// Agrupa por labelCol, agrega numéricos con la función elegida (sum/avg/max/min/count),
// limita a `limit` categorías + "Otros"
function aggregateRows(rows, labelCol, numericCols, limit, agg = 'sum') {
  const fn = AGG_FNS[agg] || AGG_FNS.sum
  const groups = new Map()
  for (const row of rows) {
    const key = String(row[labelCol] ?? '')
    if (!groups.has(key)) groups.set(key, { key, vals: new Map(numericCols.map(c => [c, []])) })
    const g = groups.get(key)
    for (const col of numericCols) g.vals.get(col).push(Number(row[col]) || 0)
  }

  const toRow = g => {
    const obj = { [labelCol]: g.key }
    for (const col of numericCols) obj[col] = fn(g.vals.get(col))
    return obj
  }

  const groupList = [...groups.values()]
  if (limit && groupList.length > limit) {
    const sorted = [...groupList].sort((a, b) => fn(b.vals.get(numericCols[0]) || []) - fn(a.vals.get(numericCols[0]) || []))
    const top    = sorted.slice(0, limit)
    const rest   = sorted.slice(limit)
    const otrosVals = new Map(numericCols.map(c => [c, rest.flatMap(g => g.vals.get(c))]))
    const otros = { [labelCol]: `Otros (${rest.length})` }
    for (const col of numericCols) otros[col] = fn(otrosVals.get(col))
    return [...top.map(toRow), otros]
  }
  return groupList.map(toRow)
}

// Muestreo uniforme por índice (determinístico, no cambia entre renders) para
// gráficos que dibujan un punto por fila y no aguantan decenas de miles de puntos
function sampleRows(rows, max) {
  if (rows.length <= max) return rows
  const step = rows.length / max
  const sampled = []
  for (let i = 0; i < max; i++) sampled.push(rows[Math.floor(i * step)])
  return sampled
}

// Ordena un array de filas agregadas (o no) según la elección del usuario
function sortAggRows(rows, labelCol, valueCol, sortBy) {
  if (!sortBy || sortBy === 'none') return rows
  const arr = [...rows]
  if (sortBy === 'value_desc') arr.sort((a, b) => (b[valueCol] || 0) - (a[valueCol] || 0))
  else if (sortBy === 'value_asc') arr.sort((a, b) => (a[valueCol] || 0) - (b[valueCol] || 0))
  else if (sortBy === 'name_asc') arr.sort((a, b) => String(a[labelCol]).localeCompare(String(b[labelCol])))
  else if (sortBy === 'name_desc') arr.sort((a, b) => String(b[labelCol]).localeCompare(String(a[labelCol])))
  return arr
}

// Renombra una clave dentro de un objeto plano (filtros/KPIs por columna), preservando el resto
function renameKey(obj, oldKey, newKey) {
  if (!(oldKey in obj)) return obj
  const { [oldKey]: val, ...rest } = obj
  return { ...rest, [newKey]: val }
}

// ── Estado inicial de página ─────────────────────────────────────────────────
const freshPage = () => ({ charts: [], chartTypes: {}, chartConfigs: {} })

let pageCounter = 1
let instanceCounter = 1
let pinCounter = 1

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { user, logout } = useAuth()

  // Datos
  const [rows, setRows]         = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError]       = useState('')
  const [dragging, setDragging] = useState(false)
  const [pendingReview, setPendingReview]   = useState(null) // { rows, columns, autoNamed } — revisión de columnas sin título
  const [pendingSheets, setPendingSheets]   = useState(null) // { wb } — elegir pestaña cuando el archivo tiene más de una

  // Edición de la tabla (doble clic en encabezado o celda)
  const [editingHeader, setEditingHeader] = useState(null) // nombre de columna que se está renombrando
  const [headerDraft, setHeaderDraft]     = useState('')
  const [editingCell, setEditingCell]     = useState(null) // { row, col } — row es la referencia real dentro de `rows`
  const [cellDraft, setCellDraft]         = useState('')
  const [tableMsg, setTableMsg]           = useState('')

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
  const [configOpen, setConfigOpen]       = useState(null) // id del gráfico cuya config está abierta
  const [showFilters, setShowFilters]     = useState(false)
  const [showDashPanel, setShowDashPanel] = useState(false)
  const [globalTheme, setGlobalTheme]     = useState('default') // tema de color aplicado a todos los gráficos que no tengan paleta propia
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [pinnedCharts, setPinnedCharts] = useState([]) // gráficos "anclados": foto congelada con el filtro de cuando se anclaron
  const [showPinned, setShowPinned]     = useState(false)
  const [tableCollapsed, setTableCollapsed] = useState(false)
  const fileInputRef = useRef(null)
  const chartRefs    = useRef({})
  const mainRef      = useRef(null)

  // ── Página actual ──────────────────────────────────────────────────────────
  const pg = pageData[activePage] ?? freshPage()

  const updatePg = (fn) => setPageData(prev => ({
    ...prev,
    [activePage]: fn(prev[activePage] ?? freshPage())
  }))

  // ── Config por gráfico (eje, series, paleta, etiquetas, tendencia) ──────────
  const updateChartConfig = (id, patch) => updatePg(pg => ({
    ...pg,
    chartConfigs: { ...pg.chartConfigs, [id]: { ...(pg.chartConfigs?.[id] || {}), ...patch } },
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
    return chartRows.filter(row => clickFilter.values.includes(String(row[clickFilter.col])))
  }, [chartRows, clickFilter])

  const isFiltered = filteredRows.length < rows.length

  // ── Edición de la tabla (encabezados y celdas) ──────────────────────────────
  const showTableMsg = (msg) => { setTableMsg(msg); setTimeout(() => setTableMsg(''), 3000) }

  const renameColumn = (oldName, newName) => {
    setRows(prev => prev.map(row => {
      const obj = {}
      for (const [k, v] of Object.entries(row)) obj[k === oldName ? newName : k] = v
      return obj
    }))
    setSlicerFilters(prev => renameKey(prev, oldName, newName))
    setRangeFilters(prev => renameKey(prev, oldName, newName))
    setDateFilters(prev => renameKey(prev, oldName, newName))
    setKpiAgg(prev => renameKey(prev, oldName, newName))
    setKpiThresholds(prev => renameKey(prev, oldName, newName))
    setClickFilter(prev => (prev && prev.col === oldName) ? { ...prev, col: newName } : prev)
    setPageData(prev => {
      const next = {}
      for (const [pid, page] of Object.entries(prev)) {
        const chartConfigs = {}
        for (const [cid, cfg] of Object.entries(page.chartConfigs || {})) {
          const newCfg = { ...cfg }
          if (newCfg.xCol === oldName) newCfg.xCol = newName
          if (Array.isArray(newCfg.yCols)) newCfg.yCols = newCfg.yCols.map(c => c === oldName ? newName : c)
          chartConfigs[cid] = newCfg
        }
        next[pid] = { ...page, chartConfigs }
      }
      return next
    })
  }

  const startEditHeader = (col) => { setEditingHeader(col); setHeaderDraft(col) }

  const commitHeaderEdit = (oldName) => {
    const newName = headerDraft.trim()
    setEditingHeader(null)
    if (!newName || newName === oldName) return
    if (columns.includes(newName)) { showTableMsg(`Ya existe una columna llamada "${newName}".`); return }
    renameColumn(oldName, newName)
  }

  const startEditCell = (row, col) => { setEditingCell({ row, col }); setCellDraft(String(row[col] ?? '')) }

  const commitCellEdit = () => {
    if (!editingCell) return
    const { row, col } = editingCell
    const idx = rows.indexOf(row)
    setEditingCell(null)
    if (idx === -1) return
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [col]: cellDraft }
      return next
    })
  }

  // ── Acciones de datos ──────────────────────────────────────────────────────
  const applyLoadedRows = (data) => {
    setRows(data)
    setClickFilter(null)
    setSlicerFilters({})
    setRangeFilters({})
    setDateFilters({})
    setKpiAgg({})
    updatePg(pg => ({ ...pg, charts: [] }))
  }

  const loadSheet = (wb, sheetName) => {
    const raw = sheetToRows(wb, sheetName)
    const { rows: data, autoNamed } = renameEmptyHeaders(raw)
    if (autoNamed.length > 0) {
      setPendingReview({ rows: data, columns: data.length ? Object.keys(data[0]) : [], autoNamed })
    } else {
      applyLoadedRows(data)
    }
  }

  const loadFile = async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx','xls','csv'].includes(ext)) { setError('Formato no soportado.'); return }
    setError('')
    setFileName(file.name)
    const wb = await readWorkbook(file)
    if (wb.SheetNames.length > 1) {
      setPendingSheets({ wb })
    } else {
      loadSheet(wb, wb.SheetNames[0])
    }
  }

  const selectSheet = (sheetName) => {
    const wb = pendingSheets.wb
    setPendingSheets(null)
    loadSheet(wb, sheetName)
  }

  // ── Guardar / cargar dashboard completo ─────────────────────────────────────
  const currentDashboardConfig = () => ({
    rows, fileName, pages, pageData, activePage, kpiAgg, kpiThresholds, globalTheme, pinnedCharts,
  })

  const loadDashboardConfig = (config) => {
    const loadedPages = config.pages?.length ? config.pages : [{ id: 'p1', name: 'Página 1' }]
    const maxNum = Math.max(1, ...loadedPages.map(p => parseInt(String(p.id).replace(/^p/, ''), 10) || 1))
    pageCounter = maxNum

    // Los IDs de instancia de gráfico (ej. "bar-12") ya vienen únicos guardados;
    // seguimos el contador desde ahí para que los próximos que se agreguen no choquen.
    const allInstanceIds = Object.values(config.pageData || {}).flatMap(pg => pg.charts || [])
    const maxInstance = Math.max(0, ...allInstanceIds.map(id => parseInt(String(id).split('-').pop(), 10) || 0))
    instanceCounter = maxInstance + 1

    setRows(config.rows || [])
    setFileName(config.fileName || '')
    setPages(loadedPages)
    setPageData(config.pageData || { [loadedPages[0].id]: freshPage() })
    setActivePage(config.activePage && loadedPages.some(p => p.id === config.activePage) ? config.activePage : loadedPages[0].id)
    setKpiAgg(config.kpiAgg || {})
    setKpiThresholds(config.kpiThresholds || {})
    setGlobalTheme(config.globalTheme || 'default')
    setPinnedCharts(config.pinnedCharts || [])
    const maxPin = Math.max(0, ...(config.pinnedCharts || []).map(p => parseInt(String(p.id).split('-').pop(), 10) || 0))
    pinCounter = maxPin + 1
    setClickFilter(null)
    setSlicerFilters({})
    setRangeFilters({})
    setDateFilters({})
    setPanelPos({})
    setZOrder([])
  }

  const cancelSheetSelect = () => {
    setPendingSheets(null)
    setFileName('')
  }

  const confirmColumnReview = (nameMap) => {
    const renamedRows = pendingReview.rows.map(row => {
      const obj = {}
      for (const [k, v] of Object.entries(row)) obj[nameMap[k] ?? k] = v
      return obj
    })
    setPendingReview(null)
    applyLoadedRows(renamedRows)
  }

  const skipColumnReview = () => {
    applyLoadedRows(pendingReview.rows)
    setPendingReview(null)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0])
  }, [])

  // ── Gráficos ───────────────────────────────────────────────────────────────
  // Cada gráfico agregado es una instancia propia (instanceId) — se puede tener
  // más de un gráfico del mismo tipo en la misma página, cada uno con su config.
  const addChart = (type) => {
    const instanceId = `${type}-${instanceCounter++}`
    const idx = pg.charts.length
    updatePg(pg => ({
      ...pg,
      charts: [...pg.charts, instanceId],
      chartTypes: { ...pg.chartTypes, [instanceId]: type },
    }))
    setPanelPos(prev => {
      if (prev[instanceId]) return prev
      // Grilla de 2 columnas — los paneles nuevos no se solapan con los ya abiertos
      const PANEL_W = 620, PANEL_H = 380, GAP = 24, COLS = 2, ROWS = 4
      const i = idx % (COLS * ROWS)
      const col = i % COLS
      const row = Math.floor(i / COLS)
      return { ...prev, [instanceId]: { x: 40 + col * (PANEL_W + GAP), y: 60 + row * (PANEL_H + GAP) } }
    })
  }

  const removeChart = (instanceId) => {
    updatePg(pg => {
      const chartTypes   = { ...pg.chartTypes };   delete chartTypes[instanceId]
      const chartConfigs = { ...pg.chartConfigs }; delete chartConfigs[instanceId]
      return { ...pg, charts: pg.charts.filter(c => c !== instanceId), chartTypes, chartConfigs }
    })
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  // additive = true (ctrl/cmd+click) suma o saca ese valor de la selección actual;
  // sin additive, un click selecciona solo ese valor (o lo deselecciona si ya era el único elegido)
  const applyFilter = (col, value, additive) => {
    const strVal = String(value)
    setClickFilter(prev => {
      if (prev?.col === col) {
        if (additive) {
          const has = prev.values.includes(strVal)
          const next = has ? prev.values.filter(v => v !== strVal) : [...prev.values, strVal]
          return next.length ? { col, values: next } : null
        }
        if (prev.values.length === 1 && prev.values[0] === strVal) return null
      }
      return { col, values: [strVal] }
    })
  }

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
    const dataUrl = await toPng(document.body, { pixelRatio: 1.5, backgroundColor: '#f2f2f8' })
    const img = new Image()
    img.onload = () => {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [img.width, img.height] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height)
      pdf.save('dashboard.pdf')
    }
    img.src = dataUrl
  }

  const downloadChart = async (refKey) => {
    const el = chartRefs.current[refKey]
    if (!el) return
    const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: '#fff' })
    saveAs(dataUrl, `grafico-${refKey}.png`)
  }

  // ── Construir gráfico ──────────────────────────────────────────────────────
  // instanceId identifica un gráfico puntual en la página (puede haber varios del mismo tipo)
  function buildChart(instanceId, fullscreen = false) {
    const chartType = pg.chartTypes?.[instanceId]
    // Config propia del gráfico (eje/series/paleta/etiquetas/tendencia/orden/formato/leyenda/título)
    const cfg               = pg.chartConfigs?.[instanceId] || {}
    const chartLabelCol     = (cfg.xCol && columns.includes(cfg.xCol)) ? cfg.xCol : labelCol
    const cfgYCols          = (cfg.yCols || []).filter(c => numericCols.includes(c))
    const chartNumericCols  = cfgYCols.length ? cfgYCols : numericCols
    const palette           = (cfg.palette && cfg.palette !== 'default') ? PALETTES[cfg.palette]
                              : (globalTheme !== 'default' ? PALETTES[globalTheme] : undefined)
    const showLabels        = !!cfg.showLabels
    const trendLine         = !!cfg.trendLine
    const showLegend        = cfg.showLegend !== false
    const format            = cfg.format || 'auto'
    const scale              = cfg.scale === 'log' ? 'log' : 'linear'
    const chartAgg          = cfg.agg || 'sum'
    const defaultSort       = ['pie', 'funnel', 'treemap'].includes(chartType) ? 'value_desc' : 'none'
    const sortBy            = cfg.sort || defaultSort
    const onClick           = (value, additive) => applyFilter(chartLabelCol, value, additive)

    const aggNote = (original, agg) => original > agg.length
      ? <span className="agg-note">Agrupado por {chartLabelCol} · {agg.length} categorías de {original} filas</span>
      : null

    switch (chartType) {

      case 'bar': {
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, chartNumericCols, 60, chartAgg), chartLabelCol, chartNumericCols[0], sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <BarChartSVG data={agg} labelCol={chartLabelCol} numericCols={chartNumericCols}
                palette={palette} showLabels={showLabels} showLegend={showLegend} format={format} scale={scale}
                clickFilter={clickFilter} onBarClick={onClick} />
            </div>
          </div>
        )
      }

      case 'waterfall': {
        const col = chartNumericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, [col], 60, chartAgg), chartLabelCol, col, sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <WaterfallChartSVG data={agg} labelCol={chartLabelCol} valueCol={col}
                palette={palette} showLabels={showLabels} format={format}
                clickFilter={clickFilter} onBarClick={onClick} />
            </div>
          </div>
        )
      }

      case 'line': {
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, chartNumericCols, 80, chartAgg), chartLabelCol, chartNumericCols[0], sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <LineChartSVG data={agg} labelCol={chartLabelCol} numericCols={chartNumericCols}
                palette={palette} showLabels={showLabels} trendLine={trendLine} showLegend={showLegend} format={format} scale={scale}
                clickFilter={clickFilter} onPointClick={onClick} />
            </div>
          </div>
        )
      }

      case 'area': {
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, chartNumericCols, 80, chartAgg), chartLabelCol, chartNumericCols[0], sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <AreaChartSVG data={agg} labelCol={chartLabelCol} numericCols={chartNumericCols}
                palette={palette} showLabels={showLabels} trendLine={trendLine} showLegend={showLegend} format={format} scale={scale}
                clickFilter={clickFilter} onPointClick={onClick} />
            </div>
          </div>
        )
      }

      case 'pie': {
        const col = chartNumericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, [col], 12, chartAgg), chartLabelCol, col, sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <PieChartSVG data={agg} labelCol={chartLabelCol} valueCol={col}
                palette={palette} showLegend={showLegend} format={format}
                clickFilter={clickFilter} onSliceClick={onClick} />
            </div>
          </div>
        )
      }

      case 'funnel': {
        const col = chartNumericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, [col], 10, chartAgg), chartLabelCol, col, sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <FunnelChartSVG data={agg} labelCol={chartLabelCol} valueCol={col}
                palette={palette} format={format}
                clickFilter={clickFilter} onSliceClick={onClick} />
            </div>
          </div>
        )
      }

      case 'treemap': {
        const col = chartNumericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const agg = sortAggRows(aggregateRows(chartRows, chartLabelCol, [col], 30, chartAgg), chartLabelCol, col, sortBy)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {aggNote(chartRows.length, agg)}
            <div style={{ flex: 1, minHeight: 0 }}>
              <TreemapSVG data={agg} labelCol={chartLabelCol} valueCol={col}
                palette={palette} format={format}
                clickFilter={clickFilter} onCellClick={onClick} />
            </div>
          </div>
        )
      }

      case 'scatter': {
        if (!chartNumericCols.length) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const MAX_SCATTER = 2000
        const scatterData = sampleRows(chartRows, MAX_SCATTER)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {chartRows.length > MAX_SCATTER && (
              <span className="agg-note">Muestra de {scatterData.length.toLocaleString()} de {chartRows.length.toLocaleString()} filas</span>
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <ScatterChartSVG data={scatterData} labelCol={chartLabelCol} numericCols={chartNumericCols}
                palette={palette} trendLine={trendLine} format={format}
                clickFilter={clickFilter} onPointClick={onClick} />
            </div>
          </div>
        )
      }

      case 'gauge': {
        const col      = chartNumericCols[0]
        if (!col) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
        const value    = filteredRows.reduce((s, r) => s + (Number(r[col]) || 0), 0)
        const maxValue = rows.reduce((s, r) => s + (Number(r[col]) || 0), 0)
        return <GaugeSVG value={value} maxValue={maxValue} col={col} />
      }

      default: return null
    }
  }

  // Datos "en bruto" de un gráfico puntual (para exportar/compartir) — misma lógica que buildChart pero sin JSX
  function getChartSnapshot(instanceId) {
    const chartType = pg.chartTypes?.[instanceId]
    const cfg              = pg.chartConfigs?.[instanceId] || {}
    const chartLabelCol    = (cfg.xCol && columns.includes(cfg.xCol)) ? cfg.xCol : labelCol
    const cfgYCols         = (cfg.yCols || []).filter(c => numericCols.includes(c))
    const chartNumericCols = cfgYCols.length ? cfgYCols : numericCols
    const chartAgg         = cfg.agg || 'sum'
    const defaultSort      = ['pie', 'funnel', 'treemap'].includes(chartType) ? 'value_desc' : 'none'
    const sortBy           = cfg.sort || defaultSort

    if (chartType === 'scatter') {
      return { chartType, cfg, labelCol: chartLabelCol, numericCols: chartNumericCols, valueCol: chartNumericCols[0], data: sampleRows(chartRows, 2000) }
    }
    const limits = { bar: 60, waterfall: 60, line: 80, area: 80, pie: 12, funnel: 10, treemap: 30 }
    if (!(chartType in limits)) return { chartType, cfg, labelCol: chartLabelCol, numericCols: chartNumericCols, valueCol: chartNumericCols[0], data: [] }
    const cols = ['bar', 'line', 'area'].includes(chartType) ? chartNumericCols : [chartNumericCols[0]]
    const data = cols[0]
      ? sortAggRows(aggregateRows(chartRows, chartLabelCol, cols, limits[chartType], chartAgg), chartLabelCol, cols[0], sortBy)
      : []
    return { chartType, cfg, labelCol: chartLabelCol, numericCols: chartNumericCols, valueCol: cols[0], data }
  }

  const exportChartData = (instanceId) => {
    const { data } = getChartSnapshot(instanceId)
    if (!data.length) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Datos')
    XLSX.writeFile(wb, `grafico-${instanceId}.xlsx`)
  }

  // ── Anclar un gráfico (foto congelada con el filtro actual, no reacciona a filtros nuevos) ──
  const pinChart = (instanceId) => {
    const { chartType, cfg, labelCol: lc, numericCols: ncs, valueCol, data } = getChartSnapshot(instanceId)
    if (!data.length) return
    const id = `pin-${pinCounter++}`
    const title = cfg.title || CHART_META[chartType]
    setPinnedCharts(prev => [...prev, { id, chartType, cfg, labelCol: lc, numericCols: ncs, valueCol, data, title }])
    setShowPinned(true)
  }

  const unpinChart = (id) => setPinnedCharts(prev => prev.filter(p => p.id !== id))

  // ── Compartir / incrustar un gráfico ────────────────────────────────────────
  const [shareState, setShareState] = useState(null) // { loading, error, url }

  const shareChart = async (instanceId) => {
    const { chartType, cfg, labelCol: lc, numericCols: ncs, valueCol, data } = getChartSnapshot(instanceId)
    if (!data.length) return
    setShareState({ loading: true, error: '', url: '' })
    const payload = {
      chartType, data, labelCol: lc, valueCol, numericCols: ncs,
      title: cfg.title || CHART_META[chartType],
      config: {
        palette: cfg.palette, format: cfg.format, showLabels: cfg.showLabels,
        showLegend: cfg.showLegend, trendLine: cfg.trendLine, scale: cfg.scale,
      },
    }
    try {
      const res = await fetch(apiUrl('/api/embeds'), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      if (!res.ok) {
        setShareState({ loading: false, error: 'Necesitás haber iniciado sesión para compartir un gráfico.', url: '' })
        return
      }
      const { id } = await res.json()
      setShareState({ loading: false, error: '', url: `${window.location.origin}/embed/${id}` })
    } catch {
      setShareState({ loading: false, error: 'No se pudo generar el link. Probá de nuevo.', url: '' })
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

        <div className="header-actions">
          <button className="hbtn" onClick={() => setShowDashPanel(true)} title="Guardar o cargar un dashboard">💾 Dashboards</button>
          <button className={`hbtn ${showPinned ? 'active' : ''}`} onClick={() => setShowPinned(v => !v)} title="Gráficos anclados (fotos congeladas con su filtro)">
            📌 Anclados {pinnedCharts.length > 0 && <span className="filter-count">{pinnedCharts.length}</span>}
          </button>
          {rows.length > 0 && (
            <>
              <div style={{ position: 'relative' }}>
                <button className="hbtn" onClick={() => setShowThemePicker(v => !v)} title="Tema de color del dashboard">🎨 Tema</button>
                {showThemePicker && (
                  <div className="theme-picker">
                    {Object.entries(PALETTES).map(([name, colors]) => (
                      <button key={name} title={name}
                        className={`cc-pal ${globalTheme === name ? 'active' : ''}`}
                        onClick={() => { setGlobalTheme(name); setShowThemePicker(false) }}>
                        {colors.slice(0, 5).map((c, i) => <span key={i} style={{ background: c, flex: 1, height: '100%' }} />)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="hbtn" onClick={exportExcel} title="Exportar datos a Excel">↓ Excel</button>
              <button className="hbtn" onClick={exportPDF}   title="Exportar dashboard a PDF">↓ PDF</button>
              <button className={`hbtn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}>
                Filtros {totalFilters > 0 && <span className="filter-count">{totalFilters}</span>}
              </button>
            </>
          )}
        </div>

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
                  const count = pg.charts.filter(c => pg.chartTypes?.[c] === id).length
                  return (
                    <button key={id}
                      className={`viz-btn ${count > 0 ? 'active' : ''} ${!rows.length ? 'locked' : ''}`}
                      onClick={() => rows.length && addChart(id)}
                      title={`Agregar ${CHART_META[id]}`}>
                      <span className="viz-icon"><ChartIcon type={id} active={count > 0} size={20} /></span>
                      <span className="viz-name">{CHART_META[id]}{count > 1 && <span className="viz-count">×{count}</span>}</span>
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
                  <button className="table-collapse-btn" onClick={() => setTableCollapsed(v => !v)}
                    title={tableCollapsed ? 'Mostrar tabla' : 'Ocultar tabla'}>
                    {tableCollapsed ? '▸' : '▾'}
                  </button>
                  <span className="sheet-info">
                    {isFiltered
                      ? <><span className="row-count filtered">{filteredRows.length}</span> de {rows.length} filas</>
                      : <>{rows.length} filas · {columns.length} columnas</>
                    }
                    {!tableCollapsed && <span className="sheet-hint">Doble clic en un encabezado o celda para editar</span>}
                  </span>
                  {tableMsg && <span className="table-msg-inline">{tableMsg}</span>}
                  {isFiltered && (
                    <div className="filter-badge">
                      <span>{clickFilter ? `${clickFilter.col}: ${clickFilter.values.join(', ')}` : 'Filtros activos'}</span>
                      <button onClick={clearAllFilters}>✕</button>
                    </div>
                  )}
                </div>
                {!tableCollapsed && <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {columns.map(c => (
                          <th key={c} onDoubleClick={() => startEditHeader(c)}>
                            {editingHeader === c ? (
                              <input autoFocus className="cell-edit-input" value={headerDraft}
                                onChange={e => setHeaderDraft(e.target.value)}
                                onClick={e => e.stopPropagation()}
                                onBlur={() => commitHeaderEdit(c)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') commitHeaderEdit(c)
                                  if (e.key === 'Escape') setEditingHeader(null)
                                }} />
                            ) : c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.slice(0, 500).map((row, i) => (
                        <tr key={i}>
                          {columns.map(c => (
                            <td key={c} onDoubleClick={() => startEditCell(row, c)}>
                              {editingCell?.row === row && editingCell.col === c ? (
                                <input autoFocus className="cell-edit-input" value={cellDraft}
                                  onChange={e => setCellDraft(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  onBlur={commitCellEdit}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') commitCellEdit()
                                    if (e.key === 'Escape') setEditingCell(null)
                                  }} />
                              ) : String(row[c] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredRows.length === 0 && <p className="table-more">Sin resultados</p>}
                  {filteredRows.length > 500 && <p className="table-more">Mostrando 500 de {filteredRows.length}</p>}
                </div>}
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

        {/* Panel de gráficos anclados (fotos congeladas) */}
        {showPinned && (
          <PinnedPanel pinned={pinnedCharts} onUnpin={unpinChart} onClose={() => setShowPinned(false)} />
        )}
      </div>

      {/* ── Tab Bar ── */}
      <TabBar pages={pages} activePage={activePage}
        onSelect={setActivePage} onAdd={addPage}
        onRemove={removePage} onRename={renamePage} />

      {/* ── Paneles ligeros flotantes ── */}
      {pg.charts.map(instanceId => {
        const chartType = pg.chartTypes?.[instanceId]
        const title = pg.chartConfigs?.[instanceId]?.title || CHART_META[chartType]
        return (
          <LightPanel key={instanceId} title={title}
            icon={<ChartIcon type={chartType} active size={14} />}
            onClose={() => removeChart(instanceId)}
            onExpand={() => setExpanded(instanceId)}
            onConfig={() => setConfigOpen(instanceId)}
            onPin={() => pinChart(instanceId)}
            initialPos={panelPos[instanceId]}
            onDragEnd={p => setPanelPos(prev => ({ ...prev, [instanceId]: p }))}
            zIndex={getZIndex(instanceId)}
            onFocus={() => bringToFront(instanceId)}>
            <div ref={el => chartRefs.current[instanceId] = el} style={{ height: '100%' }}>
              {buildChart(instanceId, false)}
            </div>
          </LightPanel>
        )
      })}

      {/* ── Modal de configuración de gráfico (eje, series, paleta, etiquetas, tendencia, orden, título, formato, leyenda) ── */}
      {configOpen && (
        <div className="modal-overlay" onClick={() => setConfigOpen(null)}>
          <div className="modal-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="card-title">
                <ChartIcon type={pg.chartTypes?.[configOpen]} active size={16} />
                Configurar {pg.chartConfigs?.[configOpen]?.title || CHART_META[pg.chartTypes?.[configOpen]]}
              </span>
              <button className="action-btn close" onClick={() => setConfigOpen(null)}>✕</button>
            </div>
            <ChartConfig
              chartId={pg.chartTypes?.[configOpen]}
              config={pg.chartConfigs?.[configOpen] || {}}
              columns={columns}
              numericCols={numericCols}
              onChange={patch => updateChartConfig(configOpen, patch)}
            />
          </div>
        </div>
      )}

      {/* ── Guardar / cargar dashboards ── */}
      {showDashPanel && (
        <DashboardPanel
          currentConfig={currentDashboardConfig()}
          onLoad={loadDashboardConfig}
          onClose={() => setShowDashPanel(false)}
        />
      )}

      {/* ── Selección de pestaña cuando el archivo tiene más de una ── */}
      {pendingSheets && (
        <SheetSelector
          sheets={pendingSheets.wb.SheetNames}
          onSelect={selectSheet}
          onCancel={cancelSheetSelect}
        />
      )}

      {/* ── Revisión de columnas sin título al subir un archivo ── */}
      {pendingReview && (
        <ColumnReview
          columns={pendingReview.columns}
          autoNamed={pendingReview.autoNamed}
          onConfirm={confirmColumnReview}
          onSkip={skipColumnReview}
        />
      )}

      {/* ── Modal fullscreen ── */}
      {expanded && (
        <div className="modal-overlay" onClick={() => setExpanded(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="card-title">
                <ChartIcon type={pg.chartTypes?.[expanded]} active size={16} />
                {pg.chartConfigs?.[expanded]?.title || CHART_META[pg.chartTypes?.[expanded]]}
                {clickFilter && <span className="filter-pill">{clickFilter.values.join(', ')}</span>}
              </span>
              <div className="card-actions">
                <button className="action-btn" onClick={() => downloadChart(expanded)}>↓ PNG</button>
                <button className="action-btn" onClick={() => exportChartData(expanded)}>↓ Datos</button>
                <button className="action-btn" onClick={() => pinChart(expanded)}>📌 Anclar</button>
                <button className="action-btn" onClick={() => shareChart(expanded)}>🔗 Compartir</button>
                <button className="action-btn close" onClick={() => setExpanded(null)}>✕</button>
              </div>
            </div>
            <div className="modal-chart" ref={el => chartRefs.current[`${expanded}-modal`] = el}>
              {buildChart(expanded, true)}
            </div>
          </div>
        </div>
      )}

      {/* ── Resultado de "Compartir" (link + código para incrustar) ── */}
      {shareState && (
        <div className="modal-overlay" onClick={() => setShareState(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="card-title">🔗 Compartir gráfico</span>
              <button className="action-btn close" onClick={() => setShareState(null)}>✕</button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {shareState.loading && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Generando link…</p>}
              {shareState.error && <p style={{ fontSize: 13, color: 'var(--red)' }}>{shareState.error}</p>}
              {shareState.url && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Esta es una foto de los datos de ahora — si tus datos cambian después, tenés que volver a compartir.
                    Cualquiera con este link lo puede ver, sin iniciar sesión.
                  </p>
                  <div className="cc-row">
                    <label className="cc-label">Link</label>
                    <div className="dash-save-row">
                      <input className="dash-input" readOnly value={shareState.url} onFocus={e => e.target.select()} />
                      <button className="dash-save-btn" onClick={() => navigator.clipboard.writeText(shareState.url)}>Copiar</button>
                    </div>
                  </div>
                  <div className="cc-row">
                    <label className="cc-label">Código para incrustar (iframe)</label>
                    <div className="dash-save-row">
                      <input className="dash-input" readOnly
                        value={`<iframe src="${shareState.url}" width="600" height="400" frameborder="0"></iframe>`}
                        onFocus={e => e.target.select()} />
                      <button className="dash-save-btn"
                        onClick={() => navigator.clipboard.writeText(`<iframe src="${shareState.url}" width="600" height="400" frameborder="0"></iframe>`)}>
                        Copiar
                      </button>
                    </div>
                  </div>
                </>
              )}
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
