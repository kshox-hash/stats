import { useState, useRef, useEffect } from 'react'

const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']

function fmtV(n) {
  if (!isFinite(n)) return ''
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function donutPath(cx, cy, R, r, a1, a2) {
  const cos1 = Math.cos(a1), sin1 = Math.sin(a1)
  const cos2 = Math.cos(a2), sin2 = Math.sin(a2)
  const large = (a2 - a1) > Math.PI ? 1 : 0
  return [
    `M${cx + R*cos1},${cy + R*sin1}`,
    `A${R},${R} 0 ${large},1 ${cx + R*cos2},${cy + R*sin2}`,
    `L${cx + r*cos2},${cy + r*sin2}`,
    `A${r},${r} 0 ${large},0 ${cx + r*cos1},${cy + r*sin1}`,
    'Z'
  ].join(' ')
}

export default function PieChartSVG({ data, labelCol, valueCol, palette, clickFilter, onSliceClick }) {
  const colors = palette && palette.length ? palette : PALETTE
  const wrapRef  = useRef(null)
  const [size, setSize]       = useState({ w: 400, h: 300 })
  const [hovIdx, setHovIdx]   = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  useEffect(() => { setAnimKey(k => k + 1) }, [clickFilter?.value])

  if (!valueCol) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
  if (!data.length) return <p className="chart-msg">No hay datos para mostrar.</p>

  const total = data.reduce((s, r) => s + Math.max(0, Number(r[valueCol]) || 0), 0)
  if (total === 0) return <p className="chart-msg">Los valores son todos cero — no hay nada que graficar.</p>

  const { w, h } = size
  const legH = Math.min(40, Math.ceil(data.length / 3) * 18)
  const chartH = h - legH
  const cx = w / 2, cy = chartH / 2
  const R  = Math.min(cx, cy) * 0.82
  const ri = R * 0.52

  const slices = []
  let angle = -Math.PI / 2
  data.forEach((row, i) => {
    const v   = Math.max(0, Number(row[valueCol]) || 0)
    const pct = v / total
    const end = angle + pct * 2 * Math.PI
    if (end - angle < 0.002) return
    slices.push({ i, row, label: String(row[labelCol] ?? ''), v, pct, a1: angle, a2: end, color: colors[i % colors.length] })
    angle = end
  })

  const getTip = (e) => {
    const r = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <svg key={animKey} width={w} height={chartH}
        style={{ display: 'block', animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>
        {slices.map(sl => {
          const isHov = hovIdx === sl.i
          const isSel = clickFilter && String(sl.label) === String(clickFilter.value)
          const op    = !clickFilter ? 1 : isSel ? 1 : 0.2
          const bump  = isHov ? 7 : isSel ? 10 : 0
          const midA  = (sl.a1 + sl.a2) / 2
          const bx    = Math.cos(midA) * bump
          const by    = Math.sin(midA) * bump
          const path  = donutPath(cx + bx, cy + by, R, ri, sl.a1, sl.a2)
          return (
            <path key={sl.i} d={path} fill={sl.color} fillOpacity={op}
              style={{ cursor: 'pointer', transition: 'transform 0.15s, fill-opacity 0.15s' }}
              onClick={() => onSliceClick(sl.label)}
              onMouseEnter={e => { setHovIdx(sl.i); setTooltip({ ...getTip(e), sl }) }}
              onMouseMove={e  => setTooltip(t => t ? { ...getTip(e), sl: t.sl } : null)}
              onMouseLeave={() => { setHovIdx(null); setTooltip(null) }} />
          )
        })}

        {/* Etiquetas de porcentaje para slices grandes */}
        {slices.map(sl => {
          if (sl.pct < 0.08) return null
          const mid = (sl.a1 + sl.a2) / 2
          const lr  = (R + ri) / 2
          const px  = cx + lr * Math.cos(mid)
          const py  = cy + lr * Math.sin(mid)
          return (
            <text key={sl.i} x={px} y={py} textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.max(9, Math.min(12, sl.pct * 40))} fill="#fff" fontWeight={600} pointerEvents="none">
              {(sl.pct * 100).toFixed(0)}%
            </text>
          )
        })}

        {/* Centro: total */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={Math.max(14, Math.min(22, R * 0.22))}
          fontWeight={700} fill="#1a1a2e">{fmtV(total)}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="#aaa">total</text>
      </svg>

      {/* Leyenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '4px 8px', flexShrink: 0 }}>
        {slices.map(sl => (
          <div key={sl.i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666', cursor: 'pointer' }}
            onClick={() => onSliceClick(sl.label)}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: sl.color, display: 'inline-block',
              opacity: !clickFilter ? 1 : String(sl.label) === String(clickFilter.value) ? 1 : 0.3 }} />
            {sl.label}
          </div>
        ))}
      </div>

      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x + 14, size.w - 150), top: Math.max(4, tooltip.y - 60),
          zIndex: 999, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: tooltip.sl.color, display: 'inline-block' }} />
            <strong style={{ color: '#fff' }}>{tooltip.sl.label}</strong>
          </div>
          <div>{valueCol}: <strong style={{ color: '#fff' }}>{fmtV(tooltip.sl.v)}</strong></div>
          <div style={{ color: '#aaa', fontSize: 11 }}>{(tooltip.sl.pct * 100).toFixed(1)}% del total</div>
        </div>
      )}
    </div>
  )
}
