import { useState } from 'react'
import { GROUPED_SIGNALS, SIGNALS, signalPct } from '../lib/signals.js'

// Left-hand filter panel. Toggle any combination of off-market signals; the map
// recolors as a heat layer showing where those signals concentrate.
export default function OpportunityFilters({
  active,
  onToggle,
  onSetAll,
  onClear,
  level,
  averages,
  selected,
  selectedName,
}) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => new Set())
  // 'avg' = level-wide average, 'place' = the selected place's own value.
  const [valueMode, setValueMode] = useState('avg')

  const count = active.size
  const noun = { zip: 'zip codes', town: 'towns', county: 'counties' }[level] ?? 'areas'
  const showingPlace = valueMode === 'place'

  function toggleCategory(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function valueFor(id) {
    const v = showingPlace ? selected?.[id] : averages?.[id]
    return v == null ? '—' : signalPct(v)
  }

  if (!open) {
    return (
      <button className="filter-pill card" onClick={() => setOpen(true)}>
        Filters
        {count > 0 && <span className="filter-count">{count}</span>}
      </button>
    )
  }

  return (
    <div className="filter-panel card">
      <div className="filter-head">
        <span className="filter-title">Filters</span>
        <button className="filter-action" onClick={() => onSetAll(SIGNALS.map((s) => s.id))}>
          All
        </button>
        <span className="filter-sep">|</span>
        <button className="filter-action" onClick={onClear}>
          Clear
        </button>
        <button
          className="filter-close"
          onClick={() => setOpen(false)}
          aria-label="Close filters"
        >
          ×
        </button>
      </div>

      <div className="filter-body">
        <p className="filter-intro">
          Where off-market deals tend to concentrate. Toggle any combination — the map shades
          NJ {noun} by how much they stack up.
        </p>

        <div className="value-mode" role="tablist" aria-label="Show values for">
          <button
            role="tab"
            aria-selected={!showingPlace}
            className={!showingPlace ? 'active' : ''}
            onClick={() => setValueMode('avg')}
          >
            NJ avg
          </button>
          <button
            role="tab"
            aria-selected={showingPlace}
            className={showingPlace ? 'active' : ''}
            onClick={() => setValueMode('place')}
          >
            This place
          </button>
        </div>
        {showingPlace && (
          <p className="value-hint">
            {selectedName ? selectedName : 'Click a place on the map to see its numbers.'}
          </p>
        )}

        {GROUPED_SIGNALS.map((cat) => {
          const isCollapsed = collapsed.has(cat.id)
          const on = cat.signals.filter((s) => active.has(s.id)).length
          return (
            <section className="filter-group" key={cat.id} style={{ '--cat': cat.color }}>
              <button
                className="group-head"
                onClick={() => toggleCategory(cat.id)}
                aria-expanded={!isCollapsed}
              >
                <span className="group-chevron" aria-hidden="true">
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span className="group-label">{cat.label}</span>
                <span className="group-count">
                  {on}/{cat.signals.length}
                </span>
              </button>

              {!isCollapsed && (
                <ul className="filter-list">
                  {cat.signals.map((s) => {
                    const isOn = active.has(s.id)
                    return (
                      <li key={s.id}>
                        <label className={isOn ? 'on' : ''}>
                          <input
                            type="checkbox"
                            role="switch"
                            className="switch"
                            checked={isOn}
                            onChange={() => onToggle(s.id)}
                          />
                          <span className="filter-text">
                            <span className="filter-label">{s.label}</span>
                            <span className="filter-desc">{s.desc}</span>
                          </span>
                          <span className="filter-value">{valueFor(s.id)}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}

        <p className="filter-note">
          Neighborhood indicators from Census data — not property listings or owner details.
        </p>
      </div>
    </div>
  )
}
