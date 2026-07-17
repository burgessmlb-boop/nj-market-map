export function dollars(v) {
  if (v == null) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}

export function percent(v, digits = 1) {
  if (v == null) return '—'
  const pct = v * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

export function ratio(v, digits = 2) {
  if (v == null) return '—'
  return v.toFixed(digits)
}

export function days(v) {
  if (v == null) return '—'
  return `${Math.round(v)} days`
}

export function deltaDays(v) {
  if (v == null) return '—'
  const d = Math.round(v)
  return `${d > 0 ? '+' : ''}${d} days`
}

// Percentage-point change for metrics that are already shares (e.g. the
// share of listings with a price cut going from 15% to 17% = "+2.0 pts").
export function pts(v) {
  if (v == null) return '—'
  const p = v * 100
  return `${p > 0 ? '+' : ''}${p.toFixed(1)} pts`
}

// Compact dollars for legend ticks: $850k, $1.2M.
export function dollarsCompact(v) {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${Math.round(v / 1e3)}k`
  return '$' + Math.round(v)
}

export function score1(v) {
  if (v == null) return '—'
  return Math.round(v)
}

export function monthName(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}
