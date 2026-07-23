import { useState, useEffect } from 'react'
import { apiUrl } from './api'
import { PALETTES } from './components/ChartConfig'
import BarChartSVG from './components/BarChartSVG'
import LineChartSVG from './components/LineChartSVG'
import AreaChartSVG from './components/AreaChartSVG'
import PieChartSVG from './components/PieChartSVG'
import WaterfallChartSVG from './components/WaterfallChartSVG'
import FunnelChartSVG from './components/FunnelChartSVG'
import TreemapSVG from './components/TreemapSVG'
import ScatterChartSVG from './components/ScatterChartSVG'
import './App.css'
import './Embed.css'

const noop = () => {}

export default function EmbedView({ id }) {
  const [state, setState] = useState({ loading: true, error: '', payload: null })

  useEffect(() => {
    fetch(apiUrl(`/api/embeds/${id}`))
      .then(res => res.ok ? res.json() : Promise.reject(new Error('not found')))
      .then(payload => setState({ loading: false, error: '', payload }))
      .catch(() => setState({ loading: false, error: 'No se pudo cargar este gráfico. El link puede haber expirado o ser incorrecto.', payload: null }))
  }, [id])

  if (state.loading) return <div className="embed-msg">Cargando…</div>
  if (state.error || !state.payload) return <div className="embed-msg">{state.error || 'No se pudo cargar este gráfico.'}</div>

  const { chartType, data, labelCol, valueCol, numericCols, title, config = {} } = state.payload
  const palette = config.palette && config.palette !== 'default' ? PALETTES[config.palette] : undefined
  const common = { palette, format: config.format }

  const chart = (() => {
    switch (chartType) {
      case 'bar':
        return <BarChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
          showLabels={config.showLabels} showLegend={config.showLegend !== false} scale={config.scale} onBarClick={noop} />
      case 'waterfall':
        return <WaterfallChartSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common}
          showLabels={config.showLabels} onBarClick={noop} />
      case 'line':
        return <LineChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
          showLabels={config.showLabels} trendLine={config.trendLine} showLegend={config.showLegend !== false} scale={config.scale} onPointClick={noop} />
      case 'area':
        return <AreaChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
          showLabels={config.showLabels} trendLine={config.trendLine} showLegend={config.showLegend !== false} scale={config.scale} onPointClick={noop} />
      case 'pie':
        return <PieChartSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common}
          showLegend={config.showLegend !== false} onSliceClick={noop} />
      case 'funnel':
        return <FunnelChartSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common} onSliceClick={noop} />
      case 'treemap':
        return <TreemapSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common} onCellClick={noop} />
      case 'scatter':
        return <ScatterChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
          trendLine={config.trendLine} onPointClick={noop} />
      default:
        return <div className="embed-msg">Tipo de gráfico no soportado.</div>
    }
  })()

  return (
    <div className="embed-page">
      {title && <div className="embed-title">{title}</div>}
      <div className="embed-chart">{chart}</div>
      <a className="embed-footer" href="/" target="_blank" rel="noopener noreferrer">Hecho con DataViz Pro</a>
    </div>
  )
}
