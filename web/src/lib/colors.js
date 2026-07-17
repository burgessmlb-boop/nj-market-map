// Sequential blue ramp (validated palette steps 100 -> 700), light -> dark.
// Used for score layers, raw-metric layers, and the legend gradient.
export const RAMP = [
  [0, '#cde2fb'],
  [25, '#9ec5f4'],
  [50, '#5598e7'],
  [75, '#256abf'],
  [100, '#0d366b'],
]

// Diverging ramp for signed values (changes over time): red = falling,
// neutral near-white at zero, blue = rising. Poles validated for CVD
// separation (deltaE 20); no-data areas render near-transparent instead of
// gray so they can't be confused with the neutral midpoint.
export const DIV_RAMP = [
  [-1, '#a92c24'],
  [-0.5, '#e07b70'],
  [0, '#f0efec'],
  [0.5, '#6da7ec'],
  [1, '#1c5cab'],
]

export const NO_DATA_COLOR = '#d9d8d2'

// Interpolate the ramp in JS (for legend swatches / detail panel accents).
export function scoreColor(score) {
  if (score == null) return NO_DATA_COLOR
  const s = Math.max(0, Math.min(100, score))
  for (let i = 1; i < RAMP.length; i++) {
    const [x1, c1] = RAMP[i - 1]
    const [x2, c2] = RAMP[i]
    if (s <= x2) return mixHex(c1, c2, (s - x1) / (x2 - x1))
  }
  return RAMP[RAMP.length - 1][1]
}

// Text color that stays readable on top of scoreColor(score).
export function scoreInk(score) {
  return score != null && score > 55 ? '#ffffff' : '#0b0b0b'
}

function mixHex(a, b, t) {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(h) {
  return [h.slice(1, 3), h.slice(3, 5), h.slice(5, 7)].map((s) => parseInt(s, 16))
}

// Value -> color stops for a field: score fields use the fixed 0-100 ramp;
// sequential fields spread the ramp across [low, median, high]; diverging
// fields center the neutral color on zero. Returns [[value, color], ...].
export function colorStops(field, domain) {
  if (field.ramp === 'score') return RAMP
  if (!domain) return null
  const [lo, mid, hi] = domain
  if (field.ramp === 'div') {
    return DIV_RAMP.map(([t, c]) => [t < 0 ? -t * lo : t * hi, c])
  }
  const stops = [
    [lo, RAMP[0][1]],
    [(lo + mid) / 2, RAMP[1][1]],
    [mid, RAMP[2][1]],
    [(mid + hi) / 2, RAMP[3][1]],
    [hi, RAMP[4][1]],
  ]
  // MapLibre interpolate needs strictly ascending inputs.
  return stops.filter(([v], i) => i === 0 || v > stops[i - 1][0])
}

// MapLibre data-driven fill expression for the active field.
export function fillExpression(field, domain) {
  const stops = colorStops(field, domain)
  if (!stops || stops.length < 2) return NO_DATA_COLOR
  return [
    'case',
    ['==', ['typeof', ['get', field.prop]], 'number'],
    ['interpolate', ['linear'], ['get', field.prop], ...stops.flat()],
    NO_DATA_COLOR,
  ]
}

// No-data polygons go near-transparent (the basemap shows through) so they
// can't be mistaken for the diverging ramp's neutral midpoint.
export function opacityExpression(field) {
  return [
    'case',
    ['!=', ['typeof', ['get', field.prop]], 'number'],
    0.18,
    ['boolean', ['feature-state', 'hover'], false],
    0.92,
    0.75,
  ]
}

// CSS gradient + tick values for the legend.
export function legendScale(field, domain) {
  const stops = colorStops(field, domain)
  if (!stops || stops.length < 2) return null
  const lo = stops[0][0]
  const hi = stops[stops.length - 1][0]
  const gradient = `linear-gradient(to right, ${stops
    .map(([v, c]) => `${c} ${((v - lo) / (hi - lo)) * 100}%`)
    .join(', ')})`
  const mid = field.ramp === 'div' ? 0 : stops[Math.floor(stops.length / 2)][0]
  return { gradient, ticks: [lo, mid, hi] }
}
