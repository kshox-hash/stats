export const PALETTES = {
  default: ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB'],
  warm:    ['#E04837','#E67E22','#F2C811','#FF5722','#E91E63','#FF9800','#c0392b','#d35400'],
  cool:    ['#1ABC9C','#00BCD4','#3498DB','#9B59B6','#673AB7','#0078D4','#2980b9','#16a085'],
  mono:    ['#1a1a2e','#3d3d6b','#6a6a9a','#8a8aba','#aaaacc','#c0c0d8','#2e2e5a','#4a4a7a'],
  nature:  ['#2d6a4f','#40916c','#52b788','#74c69d','#95d5b2','#1b4332','#b7e4c7','#d8f3dc'],
}

const TREND_CHARTS = ['line', 'area', 'scatter']
const LABEL_CHARTS = ['bar', 'line', 'area', 'waterfall']

export default function ChartConfig({ chartId, config, columns, numericCols, onChange }) {
  const yCols = config.yCols || numericCols

  const toggleYCol = (col) => {
    const next = yCols.includes(col) ? yCols.filter(c => c !== col) : [...yCols, col]
    onChange({ yCols: next.length ? next : [col] })
  }

  return (
    <div className="chart-config">
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

      {/* Etiquetas */}
      {LABEL_CHARTS.includes(chartId) && (
        <div className="cc-row cc-toggle">
          <label className="cc-label">Etiquetas de datos</label>
          <input type="checkbox" checked={!!config.showLabels} onChange={e => onChange({ showLabels: e.target.checked })} />
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
