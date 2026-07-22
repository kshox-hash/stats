import { useState, useRef, useEffect } from 'react'

const ML = 52, MR = 12, MT = 10, MB = 54
const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']

function niceTicks(max, count = 5) {
  if (max <= 0) return [0, 1]
  const raw = max / (count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
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

export default function BarChartSVG({ data, labelCol, numericCols, palette, showLabels, clickFilter, onBarClick }) {
  const colors = palette && palette.length ? palette : PALETTE
  const outerRef  = useRef(null)
  const wrapRef   = useRef(null)
  const [wrapW, setWrapW]     = useState(600)
  const [animKey, setAnimKey] = useState(0)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { setAnimKey(k => k + 1) }, [clickFilter?.values?.join(',')])

  if (!numericCols.length) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
  if (!data.length) return <p className="chart-msg">No hay datos para mostrar.</p>

  const nS = numericCols.length
  const nG = data.length
  const barW    = nS === 1 ? 34 : 16
  const barGap  = 2
  const groupW  = nS * barW + (nS - 1) * barGap + 14
  const svgH    = 260
  const svgW    = Math.max(nG * groupW + ML + MR, wrapW)
  const cW      = svgW - ML - MR
  const cH      = svgH - MT - MB

  const maxVal = Math.max(...data.flatMap(r => numericCols.map(c => Number(r[c]) || 0)), 0.001)
  const ticks  = niceTicks(maxVal)
  const yMax   = ticks[ticks.length - 1]

  const yPx    = v => cH - Math.max(0, Math.min(1, v / yMax)) * cH
  const cellOp = row => !clickFilter ? 1 : clickFilter.values.includes(String(row[labelCol])) ? 1 : 0.15

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

            {data.map((row, gi) => {
              const gCx     = (gi + 0.5) * (cW / nG)
              const gStartX = gCx - (nS * barW + (nS - 1) * barGap) / 2
              const op      = cellOp(row)
              const label   = String(row[labelCol] ?? '')
              const delay   = Math.min(gi * 0.018, 0.25)
              return (
                <g key={gi} style={{ cursor: 'pointer' }}
                  onClick={e => onBarClick(label, e.ctrlKey || e.metaKey)}
                  onMouseEnter={e => setTooltip(getTip(e, { label, row }))}
                  onMouseMove={e  => setTooltip(t => t ? getTip(e, { label: t.label, row: t.row }) : null)}
                  onMouseLeave={() => setTooltip(null)}>
                  {numericCols.map((col, si) => {
                    const v     = Math.max(0, Number(row[col]) || 0)
                    const bh    = Math.max(1, (v / yMax) * cH)
                    const bx    = gStartX + si * (barW + barGap)
                    const color = nS === 1 ? colors[gi % colors.length] : colors[si % colors.length]
                    return (
                      <g key={col}>
                        <rect x={bx} y={cH - bh} width={barW} height={bh}
                          fill={color} fillOpacity={op} rx={2} ry={2}
                          className="svg-bar"
                          style={{ animationDelay: delay + 's' }} />
                        {showLabels && v > 0 && (
                          <text x={bx + barW / 2} y={cH - bh - 4} textAnchor="middle" fontSize={9} fill="#888">
                            {fmtV(v)}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              )
            })}

            <line x1={0} x2={cW} y1={cH} y2={cH} stroke="#e0e0ee" />
            <line x1={0} x2={0}  y1={0}  y2={cH} stroke="#e0e0ee" />

            {data.map((row, gi) => {
              const gCx = (gi + 0.5) * (cW / nG)
              const raw = String(row[labelCol] ?? '')
              const lbl = raw.length > 9 ? raw.slice(0, 9) + '…' : raw
              return (
                <text key={gi} x={gCx} y={cH + 8} fontSize={10} fill="#bbb"
                  textAnchor="end" transform={`rotate(-35,${gCx},${cH + 8})`}>
                  {lbl}
                </text>
              )
            })}
          </g>
        </svg>
      </div>

      {nS > 1 && (
        <div style={{ display: 'flex', gap: 10, padding: '3px 8px', flexWrap: 'wrap', flexShrink: 0 }}>
          {numericCols.map((col, i) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i % colors.length], display: 'inline-block' }} />
              {col}
            </div>
          ))}
        </div>
      )}

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 14,
          top: Math.max(4, tooltip.y - 70),
          zIndex: 999,
          background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{tooltip.label}</div>
          {numericCols.map((col, i) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: nS === 1 ? colors[0] : colors[i % colors.length], display: 'inline-block', flexShrink: 0 }} />
              {col}: <strong style={{ color: '#fff' }}>{fmtV(Number(tooltip.row[col]) || 0)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
