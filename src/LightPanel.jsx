import { useRef, useState } from 'react'
import './LightPanel.css'

const DEFAULT_W = 620
const DEFAULT_H = 380
const MIN_W     = 320
const MIN_H     = 200
const GRID      = 8   // snap a esta grilla cuando no hay otro panel cerca para alinear
const SNAP_TOL  = 6   // distancia (px) para "engancharse" al borde/centro de otro panel

// Compara los bordes/centro de un panel contra los de otros y devuelve el corrimiento
// necesario para alinearlo exactamente, más la línea guía a mostrar (o null si no hay match)
function snapAxis(myStart, mySize, siblingStarts) {
  const myEdges = [myStart, myStart + mySize / 2, myStart + mySize]
  for (const edge of myEdges) {
    for (const s of siblingStarts) {
      if (Math.abs(edge - s) <= SNAP_TOL) return { delta: s - edge, guide: s }
    }
  }
  return null
}

export default function LightPanel({ title, icon, children, onClose, onExpand, onConfig, onPin, anchored, initialPos, initialSize, onDragEnd, onResizeEnd, siblings, zIndex, onFocus }) {
  const panelRef = useRef(null)
  const ghostRef = useRef(null)
  const pos      = useRef(initialPos ?? { x: 60 + Math.random() * 200, y: 56 + Math.random() * 100 })
  const sizeRef  = useRef({ w: initialSize?.w ?? DEFAULT_W, h: initialSize?.h ?? DEFAULT_H })
  const [size, setSize] = useState({ w: initialSize?.w ?? DEFAULT_W, h: initialSize?.h ?? DEFAULT_H })
  const [guides, setGuides] = useState({ v: null, h: null })

  // ── Drag desde el overlay ────────────────────────────────────────────────
  const onMouseDownDrag = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    const ox = e.clientX - pos.current.x
    const oy = e.clientY - pos.current.y
    const sibs = siblings || []
    const move = (e) => {
      let x = Math.max(0, e.clientX - ox)
      let y = Math.max(0, e.clientY - oy)
      const { w, h } = sizeRef.current
      const snapX = snapAxis(x, w, sibs.flatMap(s => [s.x, s.x + s.w / 2, s.x + s.w]))
      const snapY = snapAxis(y, h, sibs.flatMap(s => [s.y, s.y + s.h / 2, s.y + s.h]))
      if (snapX) x += snapX.delta; else x = Math.round(x / GRID) * GRID
      if (snapY) y += snapY.delta; else y = Math.round(y / GRID) * GRID
      pos.current = { x, y }
      setGuides({ v: snapX?.guide ?? null, h: snapY?.guide ?? null })
      if (panelRef.current)
        panelRef.current.style.transform = `translate3d(${pos.current.x}px,${pos.current.y}px,0)`
    }
    const up = () => {
      setGuides({ v: null, h: null })
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      onDragEnd?.(pos.current)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // ── Resize con ghost ─────────────────────────────────────────────────────
  const onMouseDownResize = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const startW = sizeRef.current.w, startH = sizeRef.current.h
    const sibs = siblings || []
    const ghost  = ghostRef.current
    if (ghost) {
      ghost.style.transform = `translate3d(${pos.current.x}px,${pos.current.y}px,0)`
      ghost.style.width  = startW + 'px'
      ghost.style.height = startH + 'px'
      ghost.style.display = 'block'
    }
    const move = (e) => {
      let w = Math.max(MIN_W, startW + e.clientX - startX)
      let h = Math.max(MIN_H, startH + e.clientY - startY)
      const rightEdge  = pos.current.x + w
      const bottomEdge = pos.current.y + h
      const snapR = snapAxis(rightEdge, 0, sibs.flatMap(s => [s.x, s.x + s.w / 2, s.x + s.w]))
      const snapB = snapAxis(bottomEdge, 0, sibs.flatMap(s => [s.y, s.y + s.h / 2, s.y + s.h]))
      if (snapR) w += snapR.delta; else w = Math.round(w / GRID) * GRID
      if (snapB) h += snapB.delta; else h = Math.round(h / GRID) * GRID
      w = Math.max(MIN_W, w); h = Math.max(MIN_H, h)
      sizeRef.current = { w, h }
      setGuides({ v: snapR?.guide ?? null, h: snapB?.guide ?? null })
      if (ghost) { ghost.style.width = w + 'px'; ghost.style.height = h + 'px' }
    }
    const up = () => {
      if (ghost) ghost.style.display = 'none'
      setGuides({ v: null, h: null })
      setSize({ ...sizeRef.current })
      onResizeEnd?.({ ...sizeRef.current })
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <>
      {guides.v != null && <div className="lp-guide lp-guide-v" style={{ left: guides.v }} />}
      {guides.h != null && <div className="lp-guide lp-guide-h" style={{ top: guides.h }} />}
      <div ref={ghostRef} className="lp-ghost" />
      <div
        ref={panelRef}
        className={`lp ${anchored ? 'lp-anchored' : ''}`}
        style={{ width: size.w, height: size.h, transform: `translate3d(${pos.current.x}px,${pos.current.y}px,0)`, zIndex: zIndex ?? 200 }}
        onMouseDown={onFocus}
      >
        {/* Overlay que aparece al hover: drag + botones */}
        <div className="lp-overlay" onMouseDown={onMouseDownDrag}>
          <span className="lp-overlay-title">{icon}{title}{anchored && <span className="lp-anchored-badge" title="Anclado: filtro congelado">📌</span>}</span>
          <div className="lp-overlay-btns">
            {onConfig && (
              <button onMouseDown={e => e.stopPropagation()} onClick={onConfig} title="Configurar gráfico">⚙</button>
            )}
            {onExpand && (
              <button onMouseDown={e => e.stopPropagation()} onClick={onExpand} title="Pantalla completa">⤢</button>
            )}
            {onPin && (
              <button className={anchored ? 'lp-pin-active' : ''} onMouseDown={e => e.stopPropagation()} onClick={onPin}
                title={anchored ? 'Desanclar (volver a los filtros en vivo)' : 'Anclar (congelar con el filtro actual)'}>📌</button>
            )}
            <button className="lp-close" onMouseDown={e => e.stopPropagation()} onClick={onClose} title="Cerrar">✕</button>
          </div>
        </div>

        {/* Contenido del gráfico — ocupa toda la altura */}
        <div className="lp-body" style={{ height: size.h }}>
          {children}
        </div>

        <div className="lp-resize" onMouseDown={onMouseDownResize} />
      </div>
    </>
  )
}
