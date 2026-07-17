import { dollarsCompact, percent } from '../lib/format.js'
import { usePulse } from '../lib/usePulse.js'

// Compact statewide strip in the map top bar, fed by pulse.json.
export default function StateSummary() {
  const pulse = usePulse()
  const s = pulse?.state
  if (!s?.zhvi) return null

  return (
    <div className="state-summary card" aria-label="New Jersey statewide summary">
      <div className="stat">
        <span className="stat-label">NJ typical home</span>
        <span className="stat-value">{dollarsCompact(s.zhvi)}</span>
      </div>
      {s.zhvi_yoy != null && (
        <div className="stat">
          <span className="stat-label">1-yr change</span>
          <span className={`stat-value ${s.zhvi_yoy >= 0 ? 'delta-up' : 'delta-down'}`}>
            {percent(s.zhvi_yoy)}
          </span>
        </div>
      )}
      {s.mortgage_rate != null && (
        <div className="stat">
          <span className="stat-label">30-yr rate</span>
          <span className="stat-value">{(s.mortgage_rate * 100).toFixed(2)}%</span>
        </div>
      )}
      <a className="stat-link" href="#/pulse">
        Market pulse →
      </a>
    </div>
  )
}
