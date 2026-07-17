import { LEVELS } from '../lib/metrics.js'

export default function GeoLevelToggle({ level, onChange }) {
  return (
    <div className="layer-toggle" role="tablist" aria-label="Geography level">
      {LEVELS.map(({ id, label }) => (
        <button
          key={id}
          role="tab"
          aria-selected={level === id}
          className={level === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
