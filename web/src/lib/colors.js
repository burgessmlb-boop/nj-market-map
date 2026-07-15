// Sequential blue ramp (validated palette steps 100 -> 700), light -> dark.
// Used for both the MapLibre fill expression and the legend gradient.
export const RAMP = [
  [0, '#cde2fb'],
  [25, '#9ec5f4'],
  [50, '#5598e7'],
  [75, '#256abf'],
  [100, '#0d366b'],
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

// MapLibre data-driven fill expression for the active score layer.
// Scores are joined into feature properties as e.g. `score_overall`.
export function fillExpression(layerKey) {
  const prop = `score_${layerKey}`
  return [
    'case',
    ['==', ['typeof', ['get', prop]], 'number'],
    [
      'interpolate',
      ['linear'],
      ['get', prop],
      ...RAMP.flat(),
    ],
    NO_DATA_COLOR,
  ]
}
