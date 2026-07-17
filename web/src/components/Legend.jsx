import { NO_DATA_COLOR, legendScale } from '../lib/colors.js'

export default function Legend({ field, domain, empty }) {
  const scale = legendScale(field, domain)
  return (
    <div className="legend card">
      <div className="legend-title">{field.label}</div>
      {field.desc && <div className="legend-desc">{field.desc}</div>}
      {empty || !scale ? (
        <div className="legend-empty">No data available yet for this layer.</div>
      ) : (
        <>
          <div className="legend-bar" style={{ background: scale.gradient }} />
          <div className="legend-ticks">
            {scale.ticks.map((v, i) => (
              <span key={i}>{field.tickFmt(v)}</span>
            ))}
          </div>
        </>
      )}
      <div className="legend-nodata">
        <span className="swatch" style={{ background: NO_DATA_COLOR, opacity: 0.4 }} />
        No data
      </div>
    </div>
  )
}
