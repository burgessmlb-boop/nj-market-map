import { NO_DATA_COLOR, legendScale } from '../lib/colors.js'

export default function Legend({ field, domain, empty, signalNames, levelNoun }) {
  const scale = legendScale(field, domain)
  const desc = signalNames?.length
    ? `${signalNames.join(' + ')} — relative to other NJ ${levelNoun}`
    : field.desc
  return (
    <div className="legend card">
      <div className="legend-title">{field.label}</div>
      {desc && <div className="legend-desc">{desc}</div>}
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
