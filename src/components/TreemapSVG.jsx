import { useState, useRef, useEffect } from 'react'

const PALETTE = ['#0078D4','#47A85C','#9B59B6','#E67E22','#1ABC9C','#E04837','#F2C811','#3498DB','#E91E63','#00BCD4']

function fmtV(n) {
  if (!isFinite(n)) return ''
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1)
}

function layout(items, rect, result = []) {
  if (!items.length) return result
  if (items.length === 1) { result.push({ ...items[0], ...rect }); return result }
  const total = items.reduce((s, d) => s + d.value, 0)
  let bestSplit = 1, bestAR = Infinity, cum = 0
  for (let i = 0; i < items.length - 1; i++) {
    cum += items[i].value
    const rA = cum / total
    const ar = rect.w >= rect.h
      ? Math.max((rect.w * rA) / (rect.h || 1), (rect.h || 1) / ((rect.w * rA) || 1))
      : Math.max((rect.w) / ((rect.h * rA) || 1), (rect.h * rA) / (rect.w || 1))
    if (ar < bestAR) { bestAR = ar; bestSplit = i + 1 }
  }
  const rA = items.slice(0, bestSplit).reduce((s, d) => s + d.value, 0) / total
  if (rect.w >= rect.h) {
    layout(items.slice(0, bestSplit), { x: rect.x, y: rect.y, w: rect.w * rA, h: rect.h }, result)
    layout(items.slice(bestSplit), { x: rect.x + rect.w * rA, y: rect.y, w: rect.w * (1 - rA), h: rect.h }, result)
  } else {
    layout(items.slice(0, bestSplit), { x: rect.x, y: rect.y, w: rect.w, h: rect.h * rA }, result)
    layout(items.slice(bestSplit), { x: rect.x, y: rect.y + rect.h * rA, w: rect.w, h: rect.h * (1 - rA) }, result)
  }
  return result
}

export default function TreemapSVG({ data, labelCol, valueCol, palette, clickFilter, onCellClick }) {
  const colors = palette && palette.length ? palette : PALETTE
  const wrapRef  = useRef(null)
  const [size, setSize]       = useState({ w: 500, h: 300 })
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

  const items = data
    .map((row, i) => ({ label: String(row[labelCol] ?? ''), value: Math.max(0, Number(row[valueCol]) || 0), i }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  if (!items.length) return <p className="chart-msg">Los valores son todos cero — no hay nada que graficar.</p>

  const { w, h } = size
  const PAD = 2
  const cells = layout(items, { x: PAD, y: PAD, w: w - PAD * 2, h: h - PAD * 2 })

  const getTip = (e) => {
    const r = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg key={animKey} width={w} height={h}
        style={{ display: 'block', animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>
        {cells.map((cell, ci) => {
          const { label, value, i, x, y, w: cw, h: ch } = cell
          const isSel  = clickFilter && clickFilter.values.includes(label)
          const isHov  = hovIdx === i
          const op     = !clickFilter ? 1 : isSel ? 1 : 0.25
          const color  = colors[i % colors.length]
          const showLbl  = cw > 40 && ch > 22
          const showVal  = cw > 55 && ch > 38
          const fontSize = Math.max(9, Math.min(13, cw / 8))
          return (
            <g key={ci} style={{ cursor: 'pointer' }}
              onClick={e => onCellClick(label, e.ctrlKey || e.metaKey)}
              onMouseEnter={e => { setHovIdx(i); setTooltip({ ...getTip(e), label, value }) }}
              onMouseMove={e  => setTooltip(t => t ? { ...getTip(e), label: t.label, value: t.value } : null)}
              onMouseLeave={() => { setHovIdx(null); setTooltip(null) }}>
              <rect x={x} y={y} width={cw} height={ch} rx={3}
                fill={color} fillOpacity={op}
                stroke="#fff" strokeWidth={PAD}
                style={{ filter: isHov ? 'brightness(1.12)' : 'none', transition: 'filter 0.1s' }} />
              {showLbl && (
                <text x={x + cw/2} y={y + (showVal ? ch/2 - 7 : ch/2)} textAnchor="middle"
                  dominantBaseline="middle" fontSize={fontSize} fill="#fff"
                  fontWeight={600} pointerEvents="none"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
                  {label.length > Math.floor(cw / (fontSize * 0.6)) ? label.slice(0, Math.floor(cw / (fontSize * 0.6))) + '…' : label}
                </text>
              )}
              {showVal && (
                <text x={x + cw/2} y={y + ch/2 + 8} textAnchor="middle"
                  dominantBaseline="middle" fontSize={Math.max(8, fontSize - 1)} fill="rgba(255,255,255,0.8)"
                  pointerEvents="none">{fmtV(value)}</text>
              )}
            </g>
          )
        })}
      </svg>

      {tooltip && (
        <div style={{
          position: 'absolute', left: Math.min(tooltip.x + 14, size.w - 150), top: Math.max(4, tooltip.y - 60),
          zIndex: 999, background: '#1e1e2e', border: '1px solid #3a3a5c', borderRadius: 5,
          padding: '6px 10px', fontSize: 12, color: '#d0d0f0', pointerEvents: 'none',
        }}>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: 3 }}>{tooltip.label}</div>
          <div>{valueCol}: <strong style={{ color: '#fff' }}>{fmtV(tooltip.value)}</strong></div>
        </div>
      )}
    </div>
  )
}
