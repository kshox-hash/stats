import PinnedChart from './PinnedChart'

export default function PinnedPanel({ pinned, onUnpin, onClose }) {
  return (
    <div className="pinned-panel">
      <div className="filter-panel-header">
        <span>📌 Gráficos anclados</span>
        <button className="fp-clear-all" onClick={onClose}>Cerrar</button>
      </div>
      {pinned.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '20px 14px' }}>
          No hay gráficos anclados todavía. Usá el 📌 en un gráfico para congelar su vista actual acá.
        </p>
      ) : (
        <div className="pinned-list">
          {pinned.map(p => (
            <div key={p.id} className="pinned-card">
              <div className="pinned-card-header">
                <span className="pinned-card-title">{p.title}</span>
                <button className="action-btn close" onClick={() => onUnpin(p.id)} title="Desanclar">✕</button>
              </div>
              <div className="pinned-card-chart">
                <PinnedChart chartType={p.chartType} data={p.data} labelCol={p.labelCol}
                  valueCol={p.valueCol} numericCols={p.numericCols} cfg={p.cfg} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
