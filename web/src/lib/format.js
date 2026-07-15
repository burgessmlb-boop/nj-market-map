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

export function score1(v) {
  if (v == null) return '—'
  return Math.round(v)
}

export function monthName(yyyymm) {
  if (!yyyymm) return ''
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
}
