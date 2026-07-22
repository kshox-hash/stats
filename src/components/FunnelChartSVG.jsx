import { useState, useRef, useEffect } from 'react'

const PALETTE = ['#0078D4','#F2C811','#47A85C','#E04837','#9B59B6','#1ABC9C','#E67E22','#3498DB','#E91E63','#00BCD4']

function fmtV(n) {
  if (!isFinite(n)) return ''
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

export default function FunnelChartSVG({ data, labelCol, valueCol, palette, clickFilter, onSliceClick }) {
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

  useEffect(() => { setAnimKey(k => k + 1) }, [clickFilter?.values?.join(',')])

  if (!valueCol) return <p className="chart-msg">Necesitás al menos una columna numérica.</p>
  if (!data.length) return <p className="chart-msg">No hay datos para mostrar.</p>

  const sorted = [...data].sort((a, b) => (Number(b[valueCol]) || 0) - (Number(a[valueCol]) || 0))
  const maxV   = Number(sorted[0]?.[valueCol]) || 1
  const n      = sorted.length

  const { w, h } = size
  const ML = 10, MR = 130, MT = 10, MB = 10
  const cW   = w - ML - MR
  const cH   = h - MT - MB
  const gap  = 3
  const barH = Math.max(16, (cH - gap * (n - 1)) / n)
  const cx   = ML + cW / 2

  const getTip = (e) => {
    const r = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg key={animKey} width={w} height={h}
        style={{ display: 'block', animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>
        <g transform={`translate(0,${MT})`}>
          {sorted.map((row, i) => {
            const v     = Number(row[valueCol]) || 0
            const nextV = i < n - 1 ? (Number(sorted[i+1][valueCol]) || 0) : v * 0.6
            const topW  = (v / maxV) * cW
            const botW  = (nextV / maxV) * cW
            const topL  = cx - topW / 2, topR = cx + topW / 2
            const botL  = cx - botW / 2, botR = cx + botW / 2
            const y     = i * (barH + gap)
            const color = colors[i % colors.length]
            const label = String(row[labelCol] ?? '')
            const isSel = clickFilter && clickFilter.values.includes(label)
            const op    = !clickFilter ? 1 : isSel ? 1 : 0.2
            const isHov = hovIdx === i
            const pct   = (v / (Number(sorted[0]?.[valueCol]) || 1) * 100).toFixed(0)
            return (
              <g key={i} style={{ cursor: 'pointer' }}
                onClick={e => onSliceClick(label, e.ctrlKey || e.metaKey)}
                onMouseEnter={e => { setHovIdx(i); setTooltip({ ...getTip(e), row, v, label }) }}
                onMouseMove={e  => setTooltip(t => t ? { ...getTip(e), row: t.row, v: t.v, label: t.label } : null)}
                onMouseLeave={() => { setHovIdx(null); setTooltip(null) }}>
                <path d={`M${topL},${y} L${topR},${y} L${botR},${y+barH} L${botL},${y+barH} Z`}
                  fill={color} fillOpacity={op}
                  style={{ filter: isHov ? 'brightness(1.1)' : 'none', transition: 'filter 0.1s' }} />
                {/* Label + valor a la derecha */}
                <text x={cx + topW/2 + 10} y={y + barH/2 - 6} fontSize={11} fill="#555" dominantBaseline="middle">
                  {label.length > 14 ? label.slice(0, 14) + '…' : label}
                </text>
                <text x={cx + topW/2 + 10} y={y + barH/2 + 8} fontSize={10} fill="#aaa" dominantBaseline="middle">
                  {fmtV(v)} · {pct}%
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x + 14, size.w - 160), top: Math.max(4, tooltip.y - 60),
          zIndex: 999, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{tooltip.label}</div>
          <div>{valueCol}: <strong style={{ color: '#fff' }}>{fmtV(tooltip.v)}</strong></div>
        </div>
      )}
    </div>
  )
}
