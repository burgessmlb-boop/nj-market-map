// Minimal SVG sparkline: one 2px line, no axes, hover shows label + value.
// Data is an array of numbers (nulls allowed = gaps). Point labels come from
// startMonth (months counted forward) or an explicit labels array — this is
// shared between the detail panel (monthly) and the pulse page (weekly).
import { useState } from 'react'

const W = 272

export default function Sparkline({ values, startMonth, labels, color = '#2a78d6', fmt, height = 44 }) {
  const [hover, setHover] = useState(null)
  const H = height
  const points = values
    .map((v, i) => ({ v, i }))
    .filter((p) => p.v != null)
  if (points.length < 6) return null

  const min = Math.min(...points.map((p) => p.v))
  const max = Math.max(...points.map((p) => p.v))
  const span = max - min || 1
  const x = (i) => (i / (values.length - 1)) * (W - 4) + 2
  const y = (v) => H - 4 - ((v - min) / span) * (H - 10)

  // Build segments so null gaps break the line.
  const segments = []
  let current = []
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) {
      if (current.length > 1) segments.push(current)
      current = []
    } else {
      current.push(`${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`)
    }
  }
  if (current.length > 1) segments.push(current)

  function monthLabel(i) {
    if (labels) return labels[i] ?? ''
    if (!startMonth) return ''
    const [yy, mm] = startMonth.split('-').map(Number)
    const d = new Date(yy, mm - 1 + i, 1)
    return d.toLocaleString('en-US', { month: 'short', year: '2-digit' })
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = null
    for (const p of points) {
      if (best == null || Math.abs(x(p.i) - px) < Math.abs(x(best.i) - px)) best = p
    }
    setHover(best)
  }

  return (
    <div className="sparkline">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label="trend chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hover && (
          <>
            <line
              x1={x(hover.i)}
              x2={x(hover.i)}
              y1="2"
              y2={H - 2}
              stroke="#c3c2b7"
              strokeWidth="1"
            />
            <circle cx={x(hover.i)} cy={y(hover.v)} r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" />
          </>
        )}
      </svg>
      <div className="spark-caption">
        {hover ? (
          <>
            <span>{monthLabel(hover.i)}</span>
            <strong>{fmt ? fmt(hover.v) : hover.v}</strong>
          </>
        ) : (
          <>
            <span>{monthLabel(0)}</span>
            <span>{monthLabel(values.length - 1)}</span>
          </>
        )}
      </div>
    </div>
  )
}
