import { PALETTES } from './ChartConfig'
import BarChartSVG from './BarChartSVG'
import LineChartSVG from './LineChartSVG'
import AreaChartSVG from './AreaChartSVG'
import PieChartSVG from './PieChartSVG'
import WaterfallChartSVG from './WaterfallChartSVG'
import FunnelChartSVG from './FunnelChartSVG'
import TreemapSVG from './TreemapSVG'
import ScatterChartSVG from './ScatterChartSVG'

const noop = () => {}

// Renderiza la "foto" congelada de un gráfico anclado: mismos datos y config
// de cuando se ancló, sin reaccionar a los filtros actuales del dashboard.
export default function PinnedChart({ chartType, data, labelCol, valueCol, numericCols, cfg = {} }) {
  const palette = (cfg.palette && cfg.palette !== 'default') ? PALETTES[cfg.palette] : undefined
  const common = { palette, format: cfg.format }

  switch (chartType) {
    case 'bar':
      return <BarChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
        showLabels={cfg.showLabels} showLegend={cfg.showLegend !== false} scale={cfg.scale} onBarClick={noop} />
    case 'waterfall':
      return <WaterfallChartSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common}
        showLabels={cfg.showLabels} onBarClick={noop} />
    case 'line':
      return <LineChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
        showLabels={cfg.showLabels} trendLine={cfg.trendLine} showLegend={cfg.showLegend !== false} scale={cfg.scale} onPointClick={noop} />
    case 'area':
      return <AreaChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
        showLabels={cfg.showLabels} trendLine={cfg.trendLine} showLegend={cfg.showLegend !== false} scale={cfg.scale} onPointClick={noop} />
    case 'pie':
      return <PieChartSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common}
        showLegend={cfg.showLegend !== false} onSliceClick={noop} />
    case 'funnel':
      return <FunnelChartSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common} onSliceClick={noop} />
    case 'treemap':
      return <TreemapSVG data={data} labelCol={labelCol} valueCol={valueCol} {...common} onCellClick={noop} />
    case 'scatter':
      return <ScatterChartSVG data={data} labelCol={labelCol} numericCols={numericCols} {...common}
        trendLine={cfg.trendLine} onPointClick={noop} />
    default:
      return <p className="chart-msg">Tipo de gráfico no soportado.</p>
  }
}
