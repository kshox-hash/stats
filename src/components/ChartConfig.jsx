export const PALETTES = {
  default: ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB'],
  warm:    ['#E04837','#E67E22','#F2C811','#FF5722','#E91E63','#FF9800','#c0392b','#d35400'],
  cool:    ['#1ABC9C','#00BCD4','#3498DB','#9B59B6','#673AB7','#0078D4','#2980b9','#16a085'],
  mono:    ['#1a1a2e','#3d3d6b','#6a6a9a','#8a8aba','#aaaacc','#c0c0d8','#2e2e5a','#4a4a7a'],
  nature:  ['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2','#1b4332','#b7e4c7','#d8f3dc'],
}

const TREND_CHARTS  = ['line', 'area', 'scatter']
const LABEL_CHARTS  = ['bar', 'line', 'area', 'waterfall']
const AGG_CHARTS    = ['bar', 'waterfall', 'line', 'area', 'pie', 'funnel', 'treemap']
const SORT_CHARTS   = ['bar', 'waterfall', 'line', 'area', 'pie', 'funnel', 'treemap']
const LEGEND_CHARTS = ['bar', 'line', 'area', 'pie']

const AGGS = [
  { value: 'sum',   label: 'Suma' },
  { value: 'avg',   label: 'Promedio' },
  { value: 'max',   label: 'Máximo' },
  { value: 'min',   label: 'Mínimo' },
  { value: 'count', label: 'Conteo' },
]

const SORTS = [
  { value: 'none',       label: 'Original' },
  { value: 'value_desc', label: 'Valor (mayor a menor)' },
  { value: 'value_asc',  label: 'Valor (menor a mayor)' },
  { value: 'name_asc',   label: 'Nombre (A-Z)' },
  { value: 'name_desc',  label: 'Nombre (Z-A)' },
]

const FORMATS = [
  { value: 'auto',     label: 'Automático (K/M)' },
  { value: 'plain',    label: 'Número completo' },
  { value: 'currency', label: 'Moneda ($)' },
  { value: 'percent',  label: 'Porcentaje (%)' },
]

export default function ChartConfig({ chartId, config, columns, numericCols, onChange }) {
  const yCols = config.yCols || numericCols
  const defaultSort = ['pie', 'funnel', 'treemap'].includes(chartId) ? 'value_desc' : 'none'

  const toggleYCol = (col) => {
    const next = yCols.includes(col) ? yCols.filter(c => c !== col) : [...yCols, col]
    onChange({ yCols: next.length ? next : [col] })
  }

  return (
    <div className="chart-config">
      {/* Título */}
      <div className="cc-row">
        <label className="cc-label">Título</label>
        <input className="cc-select" type="text" placeholder="(nombre por defecto)"
          value={config.title || ''} onChange={e => onChange({ title: e.target.value })} />
      </div>

      {/* Eje X */}
      <div className="cc-row">
        <label className="cc-label">Eje X / Categoría</label>
        <select className="cc-select" value={config.xCol || columns[0] || ''}
          onChange={e => onChange({ xCol: e.target.value })}>
          {columns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Series Y */}
      {numericCols.length > 0 && (
        <div className="cc-row">
          <label className="cc-label">Series</label>
          <div className="cc-checklist">
            {numericCols.map(col => (
              <label key={col} className="cc-check">
                <input type="checkbox" checked={yCols.includes(col)} onChange={() => toggleYCol(col)} />
                <span>{col}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Agregación */}
      {AGG_CHARTS.includes(chartId) && (
        <div className="cc-row">
          <label className="cc-label">Agregación</label>
          <select className="cc-select" value={config.agg || 'sum'}
            onChange={e => onChange({ agg: e.target.value })}>
            {AGGS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
      )}

      {/* Orden */}
      {SORT_CHARTS.includes(chartId) && (
        <div className="cc-row">
          <label className="cc-label">Orden</label>
          <select className="cc-select" value={config.sort || defaultSort}
            onChange={e => onChange({ sort: e.target.value })}>
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      {/* Formato de número */}
      <div className="cc-row">
        <label className="cc-label">Formato de número</label>
        <select className="cc-select" value={config.format || 'auto'}
          onChange={e => onChange({ format: e.target.value })}>
          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      {/* Etiquetas */}
      {LABEL_CHARTS.includes(chartId) && (
        <div className="cc-row cc-toggle">
          <label className="cc-label">Etiquetas de datos</label>
          <input type="checkbox" checked={!!config.showLabels} onChange={e => onChange({ showLabels: e.target.checked })} />
        </div>
      )}

      {/* Leyenda */}
      {LEGEND_CHARTS.includes(chartId) && (
        <div className="cc-row cc-toggle">
          <label className="cc-label">Mostrar leyenda</label>
          <input type="checkbox" checked={config.showLegend !== false} onChange={e => onChange({ showLegend: e.target.checked })} />
        </div>
      )}

      {/* Tendencia */}
      {TREND_CHARTS.includes(chartId) && (
        <div className="cc-row cc-toggle">
          <label className="cc-label">Línea de tendencia</label>
          <input type="checkbox" checked={!!config.trendLine} onChange={e => onChange({ trendLine: e.target.checked })} />
        </div>
      )}

      {/* Paleta */}
      <div className="cc-row">
        <label className="cc-label">Paleta</label>
        <div className="cc-palettes">
          {Object.entries(PALETTES).map(([name, colors]) => (
            <button key={name} title={name}
              className={`cc-pal ${(config.palette || 'default') === name ? 'active' : ''}`}
              onClick={() => onChange({ palette: name })}>
              {colors.slice(0, 5).map((c, i) => (
                <span key={i} style={{ background: c, flex: 1, height: '100%' }} />
              ))}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
