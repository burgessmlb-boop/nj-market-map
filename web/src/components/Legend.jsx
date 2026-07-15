import { RAMP, NO_DATA_COLOR } from '../lib/colors.js'
import { LAYERS } from './LayerToggle.jsx'

const DESCRIPTIONS = {
  overall: 'Blend of investment, hotness and affordability',
  investment: 'Appreciation, rent yield and supply trends',
  hotness: 'How fast and competitively homes are selling',
  affordability: 'Home values relative to local incomes and rents',
}

export default function Legend({ activeLayer, coverage }) {
  const gradient = `linear-gradient(to right, ${RAMP.map(([v, c]) => `${c} ${v}%`).join(', ')})`
  const label = LAYERS.find((l) => l.key === activeLayer)?.label
  const empty = coverage?.[activeLayer] === 0
  return (
    <div className="legend card">
      <div className="legend-title">{label} score</div>
      <div className="legend-desc">{DESCRIPTIONS[activeLayer]}</div>
      {empty ? (
        <div className="legend-empty">No data available yet for this layer.</div>
      ) : (
        <>
          <div className="legend-bar" style={{ background: gradient }} />
          <div className="legend-ticks">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </>
      )}
      <div className="legend-nodata">
        <span className="swatch" style={{ background: NO_DATA_COLOR }} />
        No data
      </div>
    </div>
  )
}
