import { scoreColor, scoreInk } from '../lib/colors.js'
import { dollars, percent, pts, ratio, days, deltaDays, score1, monthName } from '../lib/format.js'
import { LEVELS } from '../lib/metrics.js'
import { SIGNALS, signalCount, signalPct } from '../lib/signals.js'
import Sparkline from './Sparkline.jsx'

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

const TREND_ROWS = [
  ['zhvi', 'Home value', percent],
  ['zori', 'Rent', percent],
  ['days_to_pending', 'Days to pending', deltaDays],
  ['price_cut_share', 'Price cuts', pts],
  ['inventory', 'Inventory', percent],
]

export default function DetailPanel({ id, level, entry, meta, onClose }) {
  if (!id || !entry) return null
  const {
    scores,
    coverage,
    stats,
    trends = {},
    history = {},
    rank = {},
    signals = {},
    signal_n: signalCounts = {},
  } = entry
  const signalRows = SIGNALS.filter((s) => signals[s.id] != null)
  const partial = SUB_SCORES.some(([k]) => coverage[k] != null && coverage[k] < 1)
  const noun = LEVELS.find((l) => l.id === level)?.noun ?? 'places'
  const nScored = meta?.scored?.overall
  const place =
    level === 'zip'
      ? [entry.city, entry.county ? `${entry.county} County` : ''].filter(Boolean).join(', ')
      : level === 'town'
        ? `${entry.official ?? entry.name}, ${entry.county} County`
        : 'New Jersey'
  const trendRows = TREND_ROWS.filter(([k]) => trends[k])

  return (
    <aside className="detail-panel card" aria-label={`Details for ${entry.name}`}>
      <button className="close-btn" onClick={onClose} aria-label="Close details">
        ×
      </button>
      <div className="detail-head">
        <div>
          <h2>{level === 'county' ? `${entry.name} County` : entry.name}</h2>
          <div className="detail-place">{place}</div>
          {rank.overall != null && nScored != null && (
            <div className="detail-rank">
              #{rank.overall} of {nScored} {noun} overall
            </div>
          )}
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

      {history.zhvi && (
        <div className="spark-block">
          <div className="spark-title">
            Home value, {meta?.history_months ?? 24} months
          </div>
          <Sparkline values={history.zhvi} startMonth={meta?.history_start} fmt={dollars} />
        </div>
      )}
      {history.zori && (
        <div className="spark-block">
          <div className="spark-title">Rent, {meta?.history_months ?? 24} months</div>
          <Sparkline values={history.zori} startMonth={meta?.history_start} fmt={dollars} />
        </div>
      )}

      {trendRows.length > 0 && (
        <div className="trend-block">
          <div className="spark-title">Change over time</div>
          <table className="stats-table trend-table">
            <thead>
              <tr>
                <th />
                <th>1 mo</th>
                <th>3 mo</th>
                <th>1 yr</th>
              </tr>
            </thead>
            <tbody>
              {trendRows.map(([key, label, fmt]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {['m1', 'm3', 'm12'].map((w) => {
                    const v = trends[key]?.[w]
                    return (
                      <td key={w} className={v > 0 ? 'delta-up' : v < 0 ? 'delta-down' : ''}>
                        {fmt(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {signalRows.length > 0 && (
        <div className="trend-block">
          <div className="spark-title">Off-market signals</div>
          <table className="stats-table">
            <tbody>
              {signalRows.map((s) => (
                <tr key={s.id}>
                  <td title={s.desc}>{s.label}</td>
                  <td>
                    {signalPct(signals[s.id])}
                    {signalCounts[s.id] != null && (
                      <span className="stat-n">{signalCount(signalCounts[s.id])}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
            Some metrics aren’t published for this {level === 'zip' ? 'zip' : level}; its scores
            are based on the available data.
          </p>
        )}
        <p>
          Scores are percentiles among New Jersey {noun}. Data through{' '}
          {monthName(meta?.zillow_latest_month)}.
        </p>
      </div>
    </aside>
  )
}
