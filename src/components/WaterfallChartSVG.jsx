import { useState, useRef, useEffect } from 'react'
import { formatValue, fitLabelFontSize } from '../format'

const ML = 52, MR = 12, MT = 10, MB = 54
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C']

function niceTicksRange(min, max, count = 5) {
  const range = max - min || 1
  const raw   = range / (count - 1)
  const mag   = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)))
  const step  = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) ?? mag * 10
  const start = Math.floor(min / step) * step
  const ticks = []
  for (let v = start; v <= max + step * 0.01; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)))
    if (ticks.length > count + 2) break
  }
  return ticks
}

export default function WaterfallChartSVG({ data, labelCol, valueCol, palette, showLabels, format, clickFilter, onBarClick }) {
  const colors = palette && palette.length ? palette : PALETTE
  const fmtV = v => formatValue(v, format)
  const outerRef = useRef(null)
  const wrapRef  = useRef(null)
  const [wrapSize, setWrapSize] = useState({ w: 600, h: 260 })
  const [animKey, setAnimKey] = useState(0)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setWrapSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  useEffect(() => { setAnimKey(k => k + 1) }, [clickFilter?.values?.join(',')])

  if (!valueCol) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
  if (!data.length) return <p className="chart-msg">No hay datos para mostrar.</p>

  // Compute waterfall positions
  let cum = 0
  const wfData = data.map(row => {
    const val  = Number(row[valueCol]) || 0
    const base = val >= 0 ? cum : cum + val
    cum += val
    return { label: String(row[labelCol] ?? ''), base, amount: Math.abs(val), isNeg: val < 0, end: cum }
  })

  const allY   = wfData.flatMap(d => [d.base, d.base + d.amount, 0])
  const yMin   = Math.min(...allY)
  const yMax   = Math.max(...allY, 0.001)
  const ticks  = niceTicksRange(yMin, yMax)
  const tMin   = ticks[0], tMax = ticks[ticks.length - 1]

  const nG    = wfData.length
  const barW  = 36
  const groupW = barW + 14
  const svgH  = Math.max(wrapSize.h, 120)
  const svgW  = Math.max(nG * groupW + ML + MR, wrapSize.w)
  const cW    = svgW - ML - MR
  const cH    = svgH - MT - MB

  const yPx   = v => cH * (1 - (v - tMin) / (tMax - tMin))
  const y0    = yPx(0)
  const cellOp = label => !clickFilter ? 1 : clickFilter.values.includes(String(label)) ? 1 : 0.15

  const getTip = (e, extra) => {
    const r = outerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top, ...extra }
  }

  return (
    <div ref={outerRef} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={wrapRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <svg key={animKey} width={svgW} height={svgH}
          style={{ display: 'block', minWidth: '100%', animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>
          <g transform={`translate(${ML},${MT})`}>
            {ticks.map(t => (
              <g key={t}>
                <line x1={0} x2={cW} y1={yPx(t)} y2={yPx(t)} stroke="#ebebf5" strokeWidth={1} />
                <text x={-6} y={yPx(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#bbb">{fmtV(t)}</text>
              </g>
            ))}

            {/* Línea del cero */}
            <line x1={0} x2={cW} y1={y0} y2={y0} stroke="#d0d0e8" strokeWidth={1.5} />
            <line x1={0} x2={0}  y1={0}  y2={cH} stroke="#e0e0ee" />

            {/* Líneas conectoras entre barras */}
            {wfData.map((d, gi) => {
              if (gi === nG - 1) return null
              const x1 = (gi + 0.5) * (cW / nG) + barW / 2
              const x2 = (gi + 1.5) * (cW / nG) - barW / 2
              const y  = yPx(d.end)
              return <line key={gi} x1={x1} y1={y} x2={x2} y2={y}
                stroke="#c0c0d8" strokeWidth={1} strokeDasharray="3 2" />
            })}

            {/* Barras */}
            {wfData.map((d, gi) => {
              const gCx    = (gi + 0.5) * (cW / nG)
              const bx     = gCx - barW / 2
              const barTop = yPx(d.base + d.amount)
              const barH   = Math.max(1, yPx(d.base) - barTop)
              const color  = d.isNeg ? (colors[3] ?? colors[colors.length - 1]) : colors[0]
              const op     = cellOp(d.label)
              return (
                <g key={gi} style={{ cursor: 'pointer' }}
                  onClick={e => onBarClick(d.label, e.ctrlKey || e.metaKey)}
                  onMouseEnter={e => setTooltip(getTip(e, { d }))}
                  onMouseMove={e  => setTooltip(t => t ? getTip(e, { d: t.d }) : null)}
                  onMouseLeave={() => setTooltip(null)}>
                  <rect x={bx} y={barTop} width={barW} height={barH}
                    fill={color} fillOpacity={op} rx={2}
                    className="svg-bar"
                    style={{ animationDelay: Math.min(gi * 0.018, 0.25) + 's' }} />
                  {showLabels && (() => {
                    const txt = `${d.isNeg ? '-' : ''}${fmtV(d.amount)}`
                    const fs = fitLabelFontSize(txt, groupW + 10)
                    if (!fs) return null
                    return (
                      <text x={bx + barW / 2} y={barTop - 4} textAnchor="middle" fontSize={fs} fill="#888">
                        {txt}
                      </text>
                    )
                  })()}
                </g>
              )
            })}

            <line x1={0} x2={cW} y1={cH} y2={cH} stroke="#e0e0ee" />

            {/* X labels */}
            {wfData.map((d, gi) => {
              const gCx = (gi + 0.5) * (cW / nG)
              const lbl = d.label.length > 9 ? d.label.slice(0, 9) + '…' : d.label
              return (
                <text key={gi} x={gCx} y={cH + 8} fontSize={10} fill="#bbb"
                  textAnchor="end" transform={`rotate(-35,${gCx},${cH + 8})`}>{lbl}</text>
              )
            })}
          </g>
        </svg>
      </div>

      {tooltip && (
        <div style={{
          position: 'absolute', left: tooltip.x + 14, top: Math.max(4, tooltip.y - 70),
          zIndex: 999, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{tooltip.d.label}</div>
          <div style={{ color: tooltip.d.isNeg ? '#E04837' : '#47A85C' }}>
            {tooltip.d.isNeg ? '▼' : '▲'} {fmtV(tooltip.d.isNeg ? -tooltip.d.amount : tooltip.d.amount)}
          </div>
          <div style={{ color: '#aaa', fontSize: 11 }}>Acum: {fmtV(tooltip.d.end)}</div>
        </div>
      )}
    </div>
  )
}
