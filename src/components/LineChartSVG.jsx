import { useState, useRef, useEffect } from 'react'

const ML = 52, MR = 16, MT = 10, MB = 46
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']
const DASHES  = ['none', '6 3', '3 3', '8 3 3 3', '2 2']

function niceTicks(max, count = 5) {
  if (max <= 0) return [0, 1]
  const raw  = max / (count - 1)
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) ?? mag * 10
  const ticks = []
  for (let v = 0; v <= max * 1.05; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)))
    if (ticks.length > count + 1) break
  }
  return ticks
}

function fmtV(n) {
  if (!isFinite(n)) return ''
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

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

export default function LineChartSVG({ data, labelCol, numericCols, palette, showLabels, trendLine, clickFilter, onPointClick }) {
  const colors = palette && palette.length ? palette : PALETTE
  const wrapRef  = useRef(null)
  const svgRef   = useRef(null)
  const dragRef  = useRef(null)
  const uid      = useRef(Math.random().toString(36).slice(2))
  const [size, setSize]         = useState({ w: 600, h: 260 })
  const [hoverIdx, setHoverIdx] = useState(null)
  const [tooltip, setTooltip]   = useState(null)
  const [animKey, setAnimKey]   = useState(0)
  const [xZoom, setXZoom]       = useState(null)
  const [dragRect, setDragRect] = useState(null)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  useEffect(() => { setAnimKey(k => k + 1); setXZoom(null) }, [clickFilter?.value])

  if (!numericCols.length) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
  if (!data.length) return <p className="chart-msg">No hay datos para mostrar.</p>

  const legendH = numericCols.length > 1 ? 22 : 0
  const svgW = size.w, svgH = size.h - legendH
  const cW = svgW - ML - MR, cH = svgH - MT - MB

  const visData = xZoom ? data.slice(xZoom.from, xZoom.to + 1) : data
  const n = visData.length

  const maxVal = Math.max(...visData.flatMap(r => numericCols.map(c => Number(r[c]) || 0)), 0.001)
  const ticks  = niceTicks(maxVal)
  const yMax   = ticks[ticks.length - 1]

  const xPx     = i  => n < 2 ? cW / 2 : (i / (n - 1)) * cW
  const yPx     = v  => cH - Math.max(0, Math.min(1, v / yMax)) * cH
  const pxToIdx = px => Math.max(0, Math.min(n - 1, Math.round((px / cW) * Math.max(1, n - 1))))
  const selIdx  = clickFilter ? visData.findIndex(r => String(r[labelCol]) === String(clickFilter.value)) : -1
  const showEvery = n <= 20 ? 1 : Math.ceil(n / 16)

  const getTip = (e, row) => {
    const r = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top, row }
  }

  const onSvgMouseDown = (e) => {
    if (e.button !== 0) return
    const svgRect = svgRef.current?.getBoundingClientRect()
    if (!svgRect) return
    const px = e.clientX - svgRect.left - ML
    if (px < 0 || px > cW) return
    dragRef.current = { startPx: px, svgRect }
    setDragRect(null)
    const onMove = (me) => {
      if (!dragRef.current) return
      const cur = Math.max(0, Math.min(cW, me.clientX - dragRef.current.svgRect.left - ML))
      if (Math.abs(cur - dragRef.current.startPx) > 8)
        setDragRect({ x1: Math.min(dragRef.current.startPx, cur), x2: Math.max(dragRef.current.startPx, cur) })
    }
    const onUp = (ue) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!dragRef.current) return
      const end  = Math.max(0, Math.min(cW, ue.clientX - dragRef.current.svgRect.left - ML))
      const dist = Math.abs(end - dragRef.current.startPx)
      setDragRect(null)
      if (dist > 8) {
        const fromPx = Math.min(dragRef.current.startPx, end)
        const toPx   = Math.max(dragRef.current.startPx, end)
        const base   = xZoom?.from ?? 0
        const from   = base + pxToIdx(fromPx)
        const to     = Math.min(data.length - 1, base + pxToIdx(toPx))
        if (to > from) setXZoom({ from, to })
      }
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    e.preventDefault()
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {xZoom && (
        <button onClick={() => setXZoom(null)} style={{
          position: 'absolute', top: 6, right: 22, zIndex: 5, fontSize: 10, padding: '2px 7px',
          cursor: 'pointer', border: '1px solid #0078D4', borderRadius: 3,
          background: '#e8f4fd', color: '#0078D4', fontWeight: 600,
        }}>Restablecer ×</button>
      )}

      <svg ref={svgRef} key={animKey} width={svgW} height={svgH}
        style={{ display: 'block', flex: 1, cursor: 'crosshair',
          animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}
        onMouseDown={onSvgMouseDown}>
        <defs>
          {numericCols.map((_, si) => (
            <linearGradient key={si} id={`lg-${uid.current}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={colors[si % colors.length]} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colors[si % colors.length]} stopOpacity={0.01} />
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

          {/* Área + línea suave por serie */}
          {numericCols.map((col, si) => {
            const pts   = visData.map((row, i) => ({ x: xPx(i), y: yPx(Number(row[col]) || 0) }))
            const line  = smoothPath(pts)
            const area  = pts.length ? `${line} L${pts[pts.length-1].x},${cH} L${pts[0].x},${cH} Z` : ''
            const color = colors[si % colors.length]
            const dash  = DASHES[si % DASHES.length]
            return (
              <g key={col}>
                <path d={area} fill={`url(#lg-${uid.current}-${si})`}
                  style={{ animation: 'area-in 0.4s 0.18s ease-out both' }} />
                <path d={line} fill="none" stroke={color} strokeWidth={2.5}
                  strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round"
                  pathLength="1" className="svg-line"
                  style={{ animationDelay: si * 0.08 + 's' }} />
              </g>
            )
          })}

          {/* Línea de tendencia (regresión lineal) por serie */}
          {trendLine && numericCols.map((col, si) => {
            const reg = linearRegression(visData.map(row => Number(row[col]) || 0))
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
            return visData.map((row, i) => {
              const isSel = i === selIdx, isHov = i === hoverIdx
              const v = Number(row[col]) || 0
              return (
                <g key={`${si}-${i}`}>
                  <circle cx={xPx(i)} cy={yPx(v)}
                    r={isSel ? 7 : isHov ? 5 : 3}
                    fill={color} stroke="#fff" strokeWidth={isSel ? 2.5 : 1}
                    style={{ transition: 'r 0.1s' }} />
                  {showLabels && (
                    <text x={xPx(i)} y={yPx(v) - 9} textAnchor="middle" fontSize={9} fill="#888">{fmtV(v)}</text>
                  )}
                </g>
              )
            })
          })}

          {hoverIdx != null && (
            <line x1={xPx(hoverIdx)} x2={xPx(hoverIdx)} y1={0} y2={cH}
              stroke="#0078D4" strokeWidth={1} strokeDasharray="3 2" opacity={0.45} />
          )}
          {selIdx >= 0 && (
            <line x1={xPx(selIdx)} x2={xPx(selIdx)} y1={0} y2={cH}
              stroke="#F2C811" strokeWidth={2} strokeDasharray="5 3" />
          )}
          {dragRect && (
            <rect x={dragRect.x1} y={0} width={dragRect.x2 - dragRect.x1} height={cH}
              fill="rgba(0,120,212,0.1)" stroke="#0078D4" strokeWidth={1} strokeDasharray="4 2" />
          )}

          {visData.map((row, i) => {
            const slotW = n > 1 ? cW / n : cW
            return (
              <rect key={i} x={xPx(i) - slotW/2} y={0} width={slotW} height={cH}
                fill="transparent" style={{ cursor: 'pointer' }}
                onClick={() => { if (!dragRef.current) onPointClick(String(row[labelCol])) }}
                onMouseEnter={e => { setHoverIdx(i); setTooltip(getTip(e, row)) }}
                onMouseMove={e  => setTooltip(t => t ? getTip(e, t.row) : null)}
                onMouseLeave={() => { setHoverIdx(null); setTooltip(null) }} />
            )
          })}

          {visData.map((row, i) => {
            if (i % showEvery !== 0 && i !== n - 1) return null
            const lbl   = String(row[labelCol] ?? '')
            const trunc = lbl.length > 9 ? lbl.slice(0, 9) + '…' : lbl
            return (
              <text key={i} x={xPx(i)} y={cH + 8} fontSize={10} fill="#bbb"
                textAnchor="end" transform={`rotate(-35,${xPx(i)},${cH + 8})`}>{trunc}</text>
            )
          })}
        </g>
      </svg>

      {numericCols.length > 1 && (
        <div style={{ display: 'flex', gap: 12, padding: '2px 8px', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
          {numericCols.map((col, i) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888' }}>
              <svg width={24} height={10} style={{ overflow: 'visible' }}>
                <line x1={0} y1={5} x2={24} y2={5}
                  stroke={colors[i % colors.length]} strokeWidth={2.5}
                  strokeDasharray={DASHES[i % DASHES.length]} strokeLinecap="round" />
              </svg>
              {col}
            </div>
          ))}
        </div>
      )}

      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x + 14, size.w - 160), top: Math.max(4, tooltip.y - 70),
          zIndex: 999, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{String(tooltip.row[labelCol] ?? '')}</div>
          {numericCols.map((col, i) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={14} height={8} style={{ flexShrink: 0 }}>
                <line x1={0} y1={4} x2={14} y2={4} stroke={colors[i % colors.length]}
                  strokeWidth={2} strokeDasharray={DASHES[i % DASHES.length]} strokeLinecap="round" />
              </svg>
              {col}: <strong style={{ color: '#fff' }}>{fmtV(Number(tooltip.row[col]) || 0)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
