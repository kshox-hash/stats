import { useState, useRef } from 'react'

export default function TabBar({ pages, activePage, onSelect, onAdd, onRemove, onRename }) {
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef(null)

  const startEdit = (page, e) => {
    e.stopPropagation()
    setEditing(page.id)
    setEditVal(page.name)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commitEdit = () => {
    if (editing && editVal.trim()) onRename(editing, editVal.trim())
    setEditing(null)
  }

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {pages.map(page => (
          <div key={page.id}
            className={`tab ${activePage === page.id ? 'active' : ''}`}
            onClick={() => onSelect(page.id)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="1" y1="4" x2="11" y2="4" stroke="currentColor" strokeWidth="1.2"/>
            </svg>

            {editing === page.id ? (
              <input ref={inputRef} className="tab-input" value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null) }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="tab-name" onDoubleClick={e => startEdit(page, e)}>{page.name}</span>
            )}

            {pages.length > 1 && (
              <button className="tab-close" onClick={e => { e.stopPropagation(); onRemove(page.id) }}>✕</button>
            )}
          </div>
        ))}
      </div>
      <button className="tab-add" onClick={onAdd} title="Nueva página">+ Página</button>
    </div>
  )
}
