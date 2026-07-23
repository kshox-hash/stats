import { useRef, useState } from 'react'
import './LightPanel.css'

const DEFAULT_W = 620
const DEFAULT_H = 380
const MIN_W     = 320
const MIN_H     = 200

export default function LightPanel({ title, icon, children, onClose, onExpand, onConfig, onPin, anchored, initialPos, initialSize, onDragEnd, zIndex, onFocus }) {
  const panelRef = useRef(null)
  const ghostRef = useRef(null)
  const pos      = useRef(initialPos ?? { x: 60 + Math.random() * 200, y: 56 + Math.random() * 100 })
  const sizeRef  = useRef({ w: initialSize?.w ?? DEFAULT_W, h: initialSize?.h ?? DEFAULT_H })
  const [size, setSize] = useState({ w: initialSize?.w ?? DEFAULT_W, h: initialSize?.h ?? DEFAULT_H })

  // ── Drag desde el overlay ────────────────────────────────────────────────
  const onMouseDownDrag = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    const ox = e.clientX - pos.current.x
    const oy = e.clientY - pos.current.y
    const move = (e) => {
      pos.current = { x: Math.max(0, e.clientX - ox), y: Math.max(0, e.clientY - oy) }
      if (panelRef.current)
        panelRef.current.style.transform = `translate3d(${pos.current.x}px,${pos.current.y}px,0)`
    }
    const up = () => {
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
    const ghost  = ghostRef.current
    if (ghost) {
      ghost.style.transform = `translate3d(${pos.current.x}px,${pos.current.y}px,0)`
      ghost.style.width  = startW + 'px'
      ghost.style.height = startH + 'px'
      ghost.style.display = 'block'
    }
    const move = (e) => {
      const w = Math.max(MIN_W, startW + e.clientX - startX)
      const h = Math.max(MIN_H, startH + e.clientY - startY)
      sizeRef.current = { w, h }
      if (ghost) { ghost.style.width = w + 'px'; ghost.style.height = h + 'px' }
    }
    const up = () => {
      if (ghost) ghost.style.display = 'none'
      setSize({ ...sizeRef.current })
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <>
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
