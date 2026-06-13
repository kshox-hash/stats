import { useEffect, useRef, useState } from 'react'
import './FloatingChart.css'

export default function FloatingChart({ id, title, icon, children, onClose, onDownload, onDock }) {
  const [pos, setPos]         = useState({ x: 80 + Math.random() * 120, y: 80 + Math.random() * 60 })
  const [size, setSize]       = useState({ w: 520, h: 380 })
  const [dragging, setDrag]   = useState(false)
  const [resizing, setResize] = useState(false)
  const [zIndex, setZIndex]   = useState(200)
  const dragOffset            = useRef({ dx: 0, dy: 0 })
  const resizeStart           = useRef({ mx: 0, my: 0, w: 0, h: 0 })
  const ref                   = useRef(null)

  // Drag — mover la ventana
  const onMouseDownHeader = (e) => {
    if (e.target.closest('button')) return
    e.preventDefault()
    setZIndex(z => z + 1)
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y }
    setDrag(true)
  }

  // Resize — esquina inferior derecha
  const onMouseDownResize = (e) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }
    setResize(true)
  }

  useEffect(() => {
    if (!dragging && !resizing) return

    const onMove = (e) => {
      if (dragging) {
        setPos({
          x: Math.max(0, e.clientX - dragOffset.current.dx),
          y: Math.max(0, e.clientY - dragOffset.current.dy),
        })
      }
      if (resizing) {
        const dx = e.clientX - resizeStart.current.mx
        const dy = e.clientY - resizeStart.current.my
        setSize({
          w: Math.max(320, resizeStart.current.w + dx),
          h: Math.max(240, resizeStart.current.h + dy),
        })
      }
    }
    const onUp = () => { setDrag(false); setResize(false) }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, resizing])

  return (
    <div
      ref={ref}
      className="float-win"
      style={{ left: pos.x, top: pos.y, width: size.w, zIndex }}
    >
      {/* Header draggable */}
      <div className="float-header" onMouseDown={onMouseDownHeader}>
        <span className="float-title">
          <span className="float-drag-icon">⠿</span>
          {icon}
          {title}
        </span>
        <div className="float-actions">
          <button onClick={onDownload} title="Descargar PNG">↓</button>
          <button onClick={onDock}     title="Anclar al panel">⊞</button>
          <button onClick={onClose}    title="Cerrar" className="close">✕</button>
        </div>
      </div>

      {/* Cuerpo del gráfico */}
      <div className="float-body" style={{ height: size.h }}>
        {children}
      </div>

      {/* Handle de resize */}
      <div className="float-resize" onMouseDown={onMouseDownResize} title="Redimensionar" />
    </div>
  )
}
