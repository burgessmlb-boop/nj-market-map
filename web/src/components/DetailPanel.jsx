import { scoreColor, scoreInk } from '../lib/colors.js'
import { dollars, percent, ratio, days, score1, monthName } from '../lib/format.js'

const SUB_SCORES = [
  ['investment', 'Investment'],
  ['hotness', 'Hotness'],
  ['affordability', 'Affordability'],
]

const STAT_ROWS = [
  ['zhvi', 'Typical home value', dollars],
  ['appreciation_1yr', '1-year appreciation', percent],
  ['appreciation_5yr', '5-year appreciation (per year)', percent],
  ['zori', 'Typical rent (monthly)', dollars],
  ['rent_yield', 'Gross rent yield', (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)],
  ['days_to_pending', 'Days to pending sale', days],
  ['sale_to_list', 'Sale-to-list ratio', (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)],
  ['price_cut_share', 'Listings with a price cut', (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)],
  ['inventory_yoy', 'Inventory change (1 yr)', percent],
  ['income', 'Median household income', dollars],
  ['value_to_income', 'Home value ÷ income', ratio],
  ['buy_to_rent', 'Monthly mortgage ÷ rent', ratio],
]

export default function DetailPanel({ zip, entry, meta, onClose }) {
  if (!zip || !entry) return null
  const { scores, coverage, stats } = entry
  const partial = SUB_SCORES.some(([k]) => coverage[k] != null && coverage[k] < 1)

  return (
    <aside className="detail-panel card" aria-label={`Details for zip code ${zip}`}>
      <button className="close-btn" onClick={onClose} aria-label="Close details">
        ×
      </button>
      <div className="detail-head">
        <div>
          <h2>{zip}</h2>
          <div className="detail-place">
            {entry.city}
            {entry.county ? `, ${entry.county} County` : ''}
          </div>
        </div>
        <div
          className="overall-chip"
          style={{ background: scoreColor(scores.overall), color: scoreInk(scores.overall) }}
        >
          <div className="chip-value">{score1(scores.overall)}</div>
          <div className="chip-label">overall</div>
        </div>
      </div>

      <div className="sub-scores">
        {SUB_SCORES.map(([key, label]) => (
          <div className="sub-score" key={key}>
            <span className="sub-label">{label}</span>
            <span className="sub-bar">
              <span
                className="sub-fill"
                style={{
                  width: `${scores[key] ?? 0}%`,
                  background: scoreColor(scores[key]),
                }}
              />
            </span>
            <span className="sub-value">{score1(scores[key])}</span>
          </div>
        ))}
      </div>

      <table className="stats-table">
        <tbody>
          {STAT_ROWS.map(([key, label, fmt]) => (
            <tr key={key}>
              <td>{label}</td>
              <td>{fmt(stats[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="detail-notes">
        {partial && (
          <p>
            Some metrics aren’t published for this zip; its scores are based on the available
            data.
          </p>
        )}
        <p>
          Scores are percentiles among New Jersey zip codes. Data through{' '}
          {monthName(meta?.zillow_latest_month)}.
        </p>
      </div>
    </aside>
  )
}
