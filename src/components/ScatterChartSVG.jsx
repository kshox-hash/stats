import { useState, useRef, useEffect } from 'react'

const ML = 52, MR = 16, MT = 10, MB = 36
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1 }
  const range = max - min
  const raw   = range / (count - 1)
  const mag   = Math.pow(10, Math.floor(Math.log10(raw)))
  const step  = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) ?? mag * 10
  const start = Math.floor(min / step) * step
  const ticks = []
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)))
    if (ticks.length > count + 2) break
  }
  return ticks
}

function fmtV(n) {
  if (!isFinite(n)) return ''
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
}

export default function ScatterChartSVG({ data, labelCol, numericCols, clickFilter, onPointClick }) {
  const wrapRef = useRef(null)
  const [size, setSize]       = useState({ w: 600, h: 300 })
  const [tooltip, setTooltip] = useState(null)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { setAnimKey(k => k + 1) }, [clickFilter?.value])

  if (!data.length || !numericCols.length) return null

  const xCol = numericCols[0]
  const yCol = numericCols[1] ?? numericCols[0]

  const { w: svgW, h: svgH } = size
  const cW = svgW - ML - MR
  const cH = svgH - MT - MB

  const xVals  = data.map(r => Number(r[xCol]) || 0)
  const yVals  = data.map(r => Number(r[yCol]) || 0)
  const xTicks = niceTicks(Math.min(...xVals), Math.max(...xVals))
  const yTicks = niceTicks(Math.min(...yVals), Math.max(...yVals))
  const xMin   = xTicks[0], xMax = xTicks[xTicks.length - 1]
  const yMin   = yTicks[0], yMax = yTicks[yTicks.length - 1]

  const xPx = v => ((v - xMin) / (xMax - xMin)) * cW
  const yPx = v => cH - ((v - yMin) / (yMax - yMin)) * cH

  const cellOp = row => !clickFilter ? 1 : String(row[labelCol]) === String(clickFilter.value) ? 1 : 0.15

  const getTip = (e, row) => {
    const r = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top, row }
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg key={animKey} width={svgW} height={svgH}
        style={{ display: 'block', animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>
        <g transform={`translate(${ML},${MT})`}>

          {yTicks.map(t => (
            <g key={t}>
              <line x1={0} x2={cW} y1={yPx(t)} y2={yPx(t)} stroke="#ebebf5" strokeWidth={1} />
              <text x={-6} y={yPx(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#bbb">{fmtV(t)}</text>
            </g>
          ))}
          {xTicks.map(t => (
            <g key={t}>
              <line x1={xPx(t)} x2={xPx(t)} y1={0} y2={cH} stroke="#ebebf5" strokeWidth={1} />
              <text x={xPx(t)} y={cH + 14} textAnchor="middle" fontSize={10} fill="#bbb">{fmtV(t)}</text>
            </g>
          ))}

          <line x1={0} x2={cW} y1={cH} y2={cH} stroke="#e0e0ee" />
          <line x1={0} x2={0}  y1={0}  y2={cH} stroke="#e0e0ee" />

          {data.map((row, i) => {
            const cx    = xPx(Number(row[xCol]) || 0)
            const cy    = yPx(Number(row[yCol]) || 0)
            const op    = cellOp(row)
            const label = String(row[labelCol] ?? '')
            const isSel = clickFilter && String(row[labelCol]) === String(clickFilter.value)
            return (
              <circle key={i} cx={cx} cy={cy}
                r={isSel ? 8 : 6}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={op}
                stroke={isSel ? '#fff' : 'none'}
                strokeWidth={isSel ? 2.5 : 0}
                style={{ cursor: 'pointer', transition: 'r 0.15s, fill-opacity 0.2s' }}
                onClick={() => onPointClick(label)}
                onMouseEnter={e => setTooltip(getTip(e, row))}
                onMouseMove={e  => setTooltip(t => t ? getTip(e, t.row) : null)}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </g>
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 14,
          top: Math.max(4, tooltip.y - 70),
          zIndex: 999,
          background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{String(tooltip.row[labelCol] ?? '')}</div>
          <div>{xCol}: <strong style={{ color: '#fff' }}>{fmtV(Number(tooltip.row[xCol]) || 0)}</strong></div>
          {xCol !== yCol && <div>{yCol}: <strong style={{ color: '#fff' }}>{fmtV(Number(tooltip.row[yCol]) || 0)}</strong></div>}
        </div>
      )}
    </div>
  )
}
