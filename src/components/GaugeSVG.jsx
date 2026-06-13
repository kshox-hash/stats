import { useRef, useEffect, useState } from 'react'

const START_DEG = 130
const SWEEP_DEG = 280
const toRad     = d => d * Math.PI / 180

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  const a1 = toRad(startDeg), a2 = toRad(startDeg + sweepDeg)
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
  return `M${x1},${y1} A${r},${r} 0 ${sweepDeg > 180 ? 1 : 0},1 ${x2},${y2}`
}

function fmtV(n) {
  if (!isFinite(n)) return '0'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export default function GaugeSVG({ value, maxValue, col }) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 300, h: 220 })

  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  const pct    = Math.min(1, Math.max(0, (maxValue > 0 ? value / maxValue : 0)))
  const { w, h } = size
  const cx     = w / 2
  const cy     = h * 0.58
  const R      = Math.min(w * 0.38, h * 0.72)
  const trackW = R * 0.22
  const Rmid   = R - trackW / 2

  const valueAngle = START_DEG + pct * SWEEP_DEG
  const vRad       = toRad(valueAngle)
  const nx = cx + (Rmid - trackW * 0.2) * Math.cos(vRad)
  const ny = cy + (Rmid - trackW * 0.2) * Math.sin(vRad)

  const valueColor = pct > 0.8 ? '#E04837' : pct > 0.6 ? '#F2C811' : '#0078D4'

  // Labels min/max
  const minPt = { x: cx + (R + 8) * Math.cos(toRad(START_DEG)), y: cy + (R + 8) * Math.sin(toRad(START_DEG)) }
  const maxPt = { x: cx + (R + 8) * Math.cos(toRad(START_DEG + SWEEP_DEG)), y: cy + (R + 8) * Math.sin(toRad(START_DEG + SWEEP_DEG)) }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <svg width={w} height={h}
        style={{ display: 'block', animation: 'chart-pop 0.38s cubic-bezier(0.34,1.4,0.64,1) both' }}>

        {/* Track */}
        <path d={arcPath(cx, cy, Rmid, START_DEG, SWEEP_DEG)}
          fill="none" stroke="#ebebf5" strokeWidth={trackW} strokeLinecap="butt" />

        {/* Franjas de color de fondo (verde/amarillo/rojo) */}
        <path d={arcPath(cx, cy, Rmid, START_DEG, SWEEP_DEG * 0.6)}
          fill="none" stroke="#47A85C" strokeWidth={trackW} strokeLinecap="butt" opacity={0.18} />
        <path d={arcPath(cx, cy, Rmid, START_DEG + SWEEP_DEG * 0.6, SWEEP_DEG * 0.2)}
          fill="none" stroke="#F2C811" strokeWidth={trackW} strokeLinecap="butt" opacity={0.18} />
        <path d={arcPath(cx, cy, Rmid, START_DEG + SWEEP_DEG * 0.8, SWEEP_DEG * 0.2)}
          fill="none" stroke="#E04837" strokeWidth={trackW} strokeLinecap="butt" opacity={0.18} />

        {/* Arco de valor */}
        {pct > 0 && (
          <path d={arcPath(cx, cy, Rmid, START_DEG, pct * SWEEP_DEG)}
            fill="none" stroke={valueColor} strokeWidth={trackW} strokeLinecap="butt" />
        )}

        {/* Marcas de tick */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const a  = toRad(START_DEG + p * SWEEP_DEG)
          const r1 = R - trackW, r2 = R
          return (
            <line key={p}
              x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
              x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
              stroke="#fff" strokeWidth={2} />
          )
        })}

        {/* Aguja */}
        <line x1={cx} y1={cy} x2={nx} y2={ny}
          stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#333" />
        <circle cx={cx} cy={cy} r={3.5} fill="#fff" />

        {/* Valor central */}
        <text x={cx} y={cy + R * 0.22} textAnchor="middle"
          fontSize={Math.max(16, R * 0.26)} fontWeight={700} fill="#1a1a2e">{fmtV(value)}</text>
        {col && (
          <text x={cx} y={cy + R * 0.22 + Math.max(16, R * 0.26) + 4} textAnchor="middle"
            fontSize={10} fill="#aaa">{col}</text>
        )}
        {maxValue > 0 && (
          <text x={cx} y={cy + R * 0.22 + Math.max(16, R * 0.26) + 18} textAnchor="middle"
            fontSize={10} fill="#0078D4">{(pct * 100).toFixed(0)}%</text>
        )}

        {/* Labels min/max */}
        <text x={minPt.x} y={minPt.y} textAnchor="middle" fontSize={9} fill="#bbb">0</text>
        <text x={maxPt.x} y={maxPt.y} textAnchor="middle" fontSize={9} fill="#bbb">{fmtV(maxValue)}</text>
      </svg>
    </div>
  )
}
