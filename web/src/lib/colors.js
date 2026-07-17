// Diverging red->green ramp for the 0-100 scores: dark red = weak market,
// soft neutral at the middle, deep green = strong market. Poles validated for
// colorblind separation (deutan deltaE 6.7, normal-vision 20.7); the neutral
// gray midpoint and the always-visible tooltip/legend values are the safety
// nets for red/green vision.
export const SCORE_RAMP = [
  [0, '#a92c24'],
  [25, '#e07b70'],
  [50, '#f0efec'],
  [75, '#7ac695'],
  [100, '#1b8a4a'],
]

// Sequential blue ramp (validated palette steps 100 -> 700), light -> dark.
// Used for raw magnitude metrics (home value, rent, days) and their legend.
export const RAMP = [
  [0, '#cde2fb'],
  [25, '#9ec5f4'],
  [50, '#5598e7'],
  [75, '#256abf'],
  [100, '#0d366b'],
]

// Diverging ramp for signed values (changes over time): red = falling,
// neutral near-white at zero, green = rising — matching the score ramp so
// "green = good" reads the same everywhere. No-data areas render
// near-transparent instead of gray so they can't be confused with the mid.
export const DIV_RAMP = [
  [-1, '#a92c24'],
  [-0.5, '#e07b70'],
  [0, '#f0efec'],
  [0.5, '#7ac695'],
  [1, '#1b8a4a'],
]

export const NO_DATA_COLOR = '#d9d8d2'

// Interpolate the score ramp in JS (for chips / bars / detail panel accents).
export function scoreColor(score) {
  if (score == null) return NO_DATA_COLOR
  const s = Math.max(0, Math.min(100, score))
  for (let i = 1; i < SCORE_RAMP.length; i++) {
    const [x1, c1] = SCORE_RAMP[i - 1]
    const [x2, c2] = SCORE_RAMP[i]
    if (s <= x2) return mixHex(c1, c2, (s - x1) / (x2 - x1))
  }
  return SCORE_RAMP[SCORE_RAMP.length - 1][1]
}

// Readable text over scoreColor(score). Both poles are dark now (deep red and
// deep green) while the middle is light, so pick ink by the resolved color's
// luminance rather than the score value.
export function scoreInk(score) {
  if (score == null) return '#0b0b0b'
  return luminance(scoreColor(score)) < 0.5 ? '#ffffff' : '#0b0b0b'
}

// Perceived luminance (0 dark - 1 light) of a hex color, sRGB-weighted.
function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => v / 255)
  return 0.299 * r + 0.587 * g + 0.114 * b
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
  if (field.ramp === 'score') return SCORE_RAMP
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
