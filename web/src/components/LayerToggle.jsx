export const LAYERS = [
  { key: 'overall', label: 'Overall' },
  { key: 'investment', label: 'Investment' },
  { key: 'hotness', label: 'Hotness' },
  { key: 'affordability', label: 'Affordability' },
]

export default function LayerToggle({ active, onChange, coverage }) {
  return (
    <div className="layer-toggle" role="tablist" aria-label="Score layer">
      {LAYERS.map(({ key, label }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          className={active === key ? 'active' : ''}
          onClick={() => onChange(key)}
        >
          {label}
          {coverage?.[key] === 0 && <span className="toggle-hint"> (no data yet)</span>}
        </button>
      ))}
    </div>
  )
}
