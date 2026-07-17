import { SCORES, METRICS, TIMEFRAMES } from '../lib/metrics.js'

// Score buttons + metric dropdown + timeframe control. The map recolors by
// whatever is active here.
export default function MetricPicker({ selection, onChange, coverage }) {
  const activeMetric = selection.kind === 'metric' ? METRICS.find((m) => m.id === selection.id) : null

  return (
    <div className="metric-picker">
      <div className="layer-toggle" role="tablist" aria-label="Score layer">
        {SCORES.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={selection.kind === 'score' && selection.id === id}
            className={selection.kind === 'score' && selection.id === id ? 'active' : ''}
            onClick={() => onChange({ kind: 'score', id })}
          >
            {label}
            {coverage?.[id] === 0 && <span className="toggle-hint"> (no data yet)</span>}
          </button>
        ))}
      </div>

      <select
        className="metric-select"
        aria-label="Color the map by a metric"
        value={activeMetric?.id ?? ''}
        onChange={(e) => {
          const m = METRICS.find((x) => x.id === e.target.value)
          if (m) onChange({ kind: 'metric', id: m.id, timeframe: m.timeframes[0] })
        }}
      >
        <option value="">Metric…</option>
        {METRICS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      {activeMetric && activeMetric.timeframes.length > 1 && (
        <div className="layer-toggle timeframes" role="tablist" aria-label="Timeframe">
          {TIMEFRAMES.filter((t) => activeMetric.timeframes.includes(t.id)).map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={selection.timeframe === id}
              className={selection.timeframe === id ? 'active' : ''}
              onClick={() => onChange({ ...selection, timeframe: id })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
