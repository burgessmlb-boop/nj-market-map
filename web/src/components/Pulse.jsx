import { useMemo, useState } from 'react'
import { dollars, dollarsCompact, percent, monthName } from '../lib/format.js'
import { usePulse } from '../lib/usePulse.js'
import Sparkline from './Sparkline.jsx'

const count = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'))

const CHARTS = [
  { key: 'median_sale_price', label: 'Median sale price', fmt: dollars },
  { key: 'homes_sold', label: 'Homes sold', fmt: count },
  { key: 'new_listings', label: 'New listings', fmt: count },
  { key: 'inventory', label: 'Homes for sale', fmt: count },
]

// Market pulse: Redfin's actual-sales data per NJ county — real transactions,
// complementing Zillow's model-based value estimates on the map.
export default function Pulse() {
  const pulse = usePulse()
  const counties = useMemo(() => Object.keys(pulse?.counties ?? {}).sort(), [pulse])
  const [county, setCounty] = useState(null)
  const active = county ?? (counties.includes('Bergen') ? 'Bergen' : counties[0])
  const data = pulse?.counties?.[active]

  if (pulse === null) {
    return (
      <div className="pulse">
        <h1>Market pulse</h1>
        <p className="rankings-sub">The market pulse hasn’t been generated yet — check back soon.</p>
      </div>
    )
  }
  if (!pulse || !data) {
    return (
      <div className="pulse">
        <h1>Market pulse</h1>
        <p className="rankings-sub">Loading…</p>
      </div>
    )
  }

  const monthLabels = data.months.map((m) => {
    const [y, mm] = m.split('-').map(Number)
    return new Date(y, mm - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
  })
  const lastPrice = data.median_sale_price?.filter((v) => v != null).at(-1)
  const lastYoy = data.median_sale_price_yoy?.filter((v) => v != null).at(-1)

  return (
    <div className="pulse">
      <h1>Market pulse</h1>
      <p className="rankings-sub">
        What actually sold, county by county — real transactions reported by Redfin, through{' '}
        {monthName(pulse.meta.redfin_latest_month)}. The map’s home values are Zillow model
        estimates; these are closed sales.
      </p>

      <div className="rankings-controls">
        <select
          className="metric-select"
          aria-label="County"
          value={active}
          onChange={(e) => setCounty(e.target.value)}
        >
          {counties.map((c) => (
            <option key={c} value={c}>
              {c} County
            </option>
          ))}
        </select>
        {lastPrice != null && (
          <span className="pulse-headline">
            {dollarsCompact(lastPrice)} median sale price
            {lastYoy != null && (
              <span className={lastYoy >= 0 ? 'delta-up' : 'delta-down'}>
                {' '}
                ({percent(lastYoy)} vs last year)
              </span>
            )}
          </span>
        )}
      </div>

      <div className="pulse-grid">
        {CHARTS.map(({ key, label, fmt }) => {
          const values = data[key] ?? []
          const has = values.some((v) => v != null)
          return (
            <div className="pulse-card card" key={key}>
              <div className="spark-title">{label}</div>
              {has ? (
                <Sparkline values={values} labels={monthLabels} fmt={fmt} height={110} />
              ) : (
                <div className="legend-empty">Not published for this county.</div>
              )}
            </div>
          )
        })}
      </div>

      <p className="pulse-note">
        Monthly, not seasonally adjusted, all residential property types. Small counties can
        have gaps where Redfin doesn’t publish a stat. The 30-year mortgage rate in the map
        header updates weekly from FRED.
      </p>
    </div>
  )
}
