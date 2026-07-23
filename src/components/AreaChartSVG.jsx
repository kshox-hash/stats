import { useState, useRef, useEffect } from 'react'
import { formatValue } from '../format'
import { niceLinearTicks, niceLogTicks, makeYScale } from '../scale'

const ML = 52, MR = 16, MT = 10, MB = 46
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']
const DASHES  = ['none', '6 3', '3 3', '8 3 3 3', '2 2']

function smoothPath(pts, t = 0.35) {
  if (!pts.length) return ''
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i-1], c = pts[i], dx = (c.x - p.x) * t
    d += ` C${p.x+dx},${p.y} ${c.x-dx},${c.y} ${c.x},${c.y}`
  }
  return d
}

// Regresión lineal simple (mínimos cuadrados) sobre índice → valor
function linearRegression(vals) {
  const n = vals.length
  if (n < 2) return null
  let sx = 0, sy = 0, sxy = 0, sxx = 0
  vals.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x })
  const denom = n * sxx - sx * sx
  if (denom === 0) return null
  const m = (n * sxy - sx * sy) / denom
  const b = (sy - m * sx) / n
  return { m, b }
}

export default function AreaChartSVG({ data, labelCol, numericCols, palette, showLabels, trendLine, showLegend = true, format, scale, clickFilter, onPointClick }) {
  const colors   = palette && palette.length ? palette : PALETTE
  const fmtV = v => formatValue(v, format)
  const wrapRef  = useRef(null)
  const uid      = useRef(Math.random().toString(36).slice(2))
  const [size, setSize]         = useState({ w: 600, h: 260 })
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tooltip, setTooltip]   = useState(null)
  const [animKey, setAnimKey]   = useState(0)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  useEffect(() => { setAnimKey(k => k + 1) }, [clickFilter?.values?.join(',')])

  if (!numericCols.length) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
  if (!data.length) return <p className="chart-msg">No hay datos para mostrar.</p>

  const legendH = numericCols.length > 1 ? 22 : 0
  const svgW = size.w, svgH = size.h - legendH
  const cW = svgW - ML - MR, cH = svgH - MT - MB
  const n  = data.length

  const maxVal    = Math.max(...data.flatMap(r => numericCols.map(c => Number(r[c]) || 0)), 0.001)
  const isLog     = scale === 'log'
  const ticks     = isLog ? niceLogTicks(maxVal, Math.max(3, Math.floor(cH / 28))) : niceLinearTicks(maxVal)
  const yMax      = isLog ? maxVal : ticks[ticks.length - 1]
  const normalize = makeYScale(yMax, scale)
  const slotW     = n > 1 ? cW / n : cW

  const xPx = i  => n < 2 ? cW / 2 : (i / (n - 1)) * cW
  const yPx = v  => cH - normalize(v) * cH
  const selIdxs = clickFilter
    ? data.reduce((acc, r, i) => (clickFilter.values.includes(String(r[labelCol])) ? [...acc, i] : acc), [])
    : []
  const showEvery = n <= 20 ? 1 : Math.ceil(n / 16)

  const getTip = (e) => {
    const r = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <svg key={animKey} width={svgW} height={svgH}
        style={{ display: 'block', flex: 1, animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>
        <defs>
          {numericCols.map((_, si) => (
            <linearGradient key={si} id={`ag-${uid.current}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={colors[si % colors.length]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={colors[si % colors.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <g transform={`translate(${ML},${MT})`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={0} x2={cW} y1={yPx(t)} y2={yPx(t)} stroke="#ebebf5" strokeWidth={1} />
              <text x={-6} y={yPx(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#bbb">{fmtV(t)}</text>
            </g>
          ))}
          <line x1={0} x2={cW} y1={cH} y2={cH} stroke="#e0e0ee" />
          <line x1={0} x2={0}  y1={0}  y2={cH} stroke="#e0e0ee" />

          {/* Áreas + líneas */}
          {numericCols.map((col, si) => {
            const pts   = data.map((row, i) => ({ x: xPx(i), y: yPx(Number(row[col]) || 0) }))
            const line  = smoothPath(pts)
            const area  = `${line} L${pts[pts.length-1].x},${cH} L${pts[0].x},${cH} Z`
            const color = colors[si % colors.length]
            const dash  = DASHES[si % DASHES.length]
            return (
              <g key={col}>
                <path d={area} fill={`url(#ag-${uid.current}-${si})`}
                  style={{ animation: 'area-in 0.4s 0.18s ease-out both' }} />
                <path d={line} fill="none" stroke={color} strokeWidth={2}
                  strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round"
                  pathLength="1" className="svg-line"
                  style={{ animationDelay: si * 0.08 + 's' }} />
              </g>
            )
          })}

          {/* Línea de tendencia (regresión lineal) por serie */}
          {trendLine && numericCols.map((col, si) => {
            const reg = linearRegression(data.map(row => Number(row[col]) || 0))
            if (!reg) return null
            const x1 = xPx(0), x2 = xPx(n - 1)
            const y1 = yPx(reg.b), y2 = yPx(reg.m * (n - 1) + reg.b)
            return (
              <line key={`trend-${col}`} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={colors[si % colors.length]} strokeWidth={1.5}
                strokeDasharray="5 4" opacity={0.6} />
            )
          })}

          {/* Puntos */}
          {n <= 80 && numericCols.map((col, si) => {
            const color = colors[si % colors.length]
            return data.map((row, i) => {
              const v = Number(row[col]) || 0
              return (
                <g key={`${si}-${i}`}>
                  <circle cx={xPx(i)} cy={yPx(v)}
                    r={selIdxs.includes(i) ? 6 : i === hoverIdx ? 4 : 2.5}
                    fill={color} stroke="#fff" strokeWidth={selIdxs.includes(i) ? 2 : 1}
                    style={{ transition: 'r 0.1s' }} />
                  {showLabels && fmtV(v).length * 5.5 < slotW && (
                    <text x={xPx(i)} y={yPx(v) - 8} textAnchor="middle" fontSize={9} fill="#888">{fmtV(v)}</text>
                  )}
                </g>
              )
            })
          })}

          {hoverIdx != null && (
            <line x1={xPx(hoverIdx)} x2={xPx(hoverIdx)} y1={0} y2={cH}
              stroke="#0078D4" strokeWidth={1} strokeDasharray="3 2" opacity={0.4} />
          )}
          {selIdxs.map(i => (
            <line key={`sel-${i}`} x1={xPx(i)} x2={xPx(i)} y1={0} y2={cH}
              stroke="#F2C811" strokeWidth={2} strokeDasharray="5 3" />
          ))}

          {/* Zonas invisibles */}
          {data.map((row, i) => {
            const slotW = n > 1 ? cW / n : cW
            return (
              <rect key={i} x={xPx(i) - slotW/2} y={0} width={slotW} height={cH}
                fill="transparent" style={{ cursor: 'pointer' }}
                onClick={e => onPointClick(String(row[labelCol]), e.ctrlKey || e.metaKey)}
                onMouseEnter={e => { setHoverIdx(i); setTooltip({ ...getTip(e), row }) }}
                onMouseMove={e  => setTooltip(t => t ? { ...getTip(e), row: t.row } : null)}
                onMouseLeave={() => { setHoverIdx(null); setTooltip(null) }} />
            )
          })}

          {data.map((row, i) => {
            if (i % showEvery !== 0 && i !== n - 1) return null
            const lbl = String(row[labelCol] ?? '')
            const tr  = lbl.length > 9 ? lbl.slice(0, 9) + '…' : lbl
            return (
              <text key={i} x={xPx(i)} y={cH + 8} fontSize={10} fill="#bbb"
                textAnchor="end" transform={`rotate(-35,${xPx(i)},${cH + 8})`}>{tr}</text>
            )
          })}
        </g>
      </svg>

      {showLegend && numericCols.length > 1 && (
        <div style={{ display: 'flex', gap: 12, padding: '2px 8px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
          {numericCols.map((col, i) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888' }}>
              <svg width={24} height={10}><line x1={0} y1={5} x2={24} y2={5}
                stroke={colors[i % colors.length]} strokeWidth={2}
                strokeDasharray={DASHES[i % DASHES.length]} strokeLinecap="round" /></svg>
              {col}
            </div>
          ))}
        </div>
      )}

      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x + 14, size.w - 150), top: Math.max(4, tooltip.y - 70),
          zIndex: 999, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{String(tooltip.row[labelCol] ?? '')}</div>
          {numericCols.map((col, i) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i % colors.length], display: 'inline-block', flexShrink: 0 }} />
              {col}: <strong style={{ color: '#fff' }}>{fmtV(Number(tooltip.row[col]) || 0)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
