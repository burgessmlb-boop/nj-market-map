import { useState } from 'react'
import { SIGNALS } from '../lib/signals.js'

// Left-hand filter panel. Check any combination of off-market signals; the map
// recolors as a heat layer showing where those signals concentrate.
export default function OpportunityFilters({ active, onToggle, onClear, level }) {
  const [open, setOpen] = useState(false)
  const count = active.size
  const noun = { zip: 'zip codes', town: 'towns', county: 'counties' }[level] ?? 'areas'

  return (
    <div className={`filter-panel card ${open ? 'open' : ''}`}>
      <button
        className="filter-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="filter-title">Off-market signals</span>
        {count > 0 && <span className="filter-count">{count}</span>}
        <span className="filter-chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      <div className="filter-body">
        <p className="filter-intro">
          Where off-market deals tend to concentrate. Tick any combination — the map shades
          NJ {noun} by how much they stack up.
        </p>

        <ul className="filter-list">
          {SIGNALS.map((s) => {
            const on = active.has(s.id)
            return (
              <li key={s.id}>
                <label className={on ? 'on' : ''}>
                  <input type="checkbox" checked={on} onChange={() => onToggle(s.id)} />
                  <span className="filter-text">
                    <span className="filter-label">{s.label}</span>
                    <span className="filter-desc">{s.desc}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        {count > 0 && (
          <button className="filter-clear" onClick={onClear}>
            Clear {count} filter{count > 1 ? 's' : ''}
          </button>
        )}

        <p className="filter-note">
          Neighborhood indicators from Census data — not property listings or owner details.
        </p>
      </div>
    </div>
  )
}
