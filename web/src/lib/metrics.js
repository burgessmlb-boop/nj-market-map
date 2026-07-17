import { dollars, dollarsCompact, percent, pts, ratio, days, deltaDays, score1 } from './format.js'

// Single source of truth for everything colorable/filterable. The map paints
// whatever field the user selects; Legend/tooltip/Rankings format through it.

export const SCORES = [
  { id: 'overall', label: 'Overall', desc: 'Blend of investment, hotness and affordability' },
  { id: 'investment', label: 'Investment', desc: 'Appreciation, rent yield and supply trends' },
  { id: 'hotness', label: 'Hotness', desc: 'How fast and competitively homes are selling' },
  {
    id: 'affordability',
    label: 'Affordability',
    desc: 'Home values relative to local incomes and rents',
  },
]

// kind drives formatting; signed metrics color with the diverging ramp
// centered on 0. timeframes: 'now' plus precomputed delta windows.
// deltaKind: how the pipeline expressed the delta (pct change, days, points).
export const METRICS = [
  { id: 'zhvi', label: 'Typical home value', kind: 'currency', timeframes: ['now', 'm1', 'm3', 'm12'], deltaKind: 'pct' },
  { id: 'zori', label: 'Typical rent', kind: 'currency', timeframes: ['now', 'm1', 'm3', 'm12'], deltaKind: 'pct' },
  { id: 'appreciation_1yr', label: '1-year appreciation', kind: 'percent', signed: true, timeframes: ['now'] },
  { id: 'appreciation_5yr', label: '5-year appreciation (per year)', kind: 'percent', signed: true, timeframes: ['now'] },
  { id: 'rent_yield', label: 'Gross rent yield', kind: 'percent', timeframes: ['now'] },
  { id: 'days_to_pending', label: 'Days to pending sale', kind: 'days', timeframes: ['now', 'm1', 'm3', 'm12'], deltaKind: 'days' },
  { id: 'sale_to_list', label: 'Sale-to-list ratio', kind: 'percent', timeframes: ['now'] },
  { id: 'price_cut_share', label: 'Listings with a price cut', kind: 'percent', timeframes: ['now', 'm1', 'm3', 'm12'], deltaKind: 'pts' },
  // Raw inventory counts scale with geography size (misleading choropleth) —
  // only its changes are offered.
  { id: 'inventory', label: 'For-sale inventory', kind: 'count', timeframes: ['m1', 'm3', 'm12'], deltaKind: 'pct' },
  { id: 'value_to_income', label: 'Home value ÷ income', kind: 'ratio', timeframes: ['now'] },
  { id: 'buy_to_rent', label: 'Monthly mortgage ÷ rent', kind: 'ratio', timeframes: ['now'] },
]

export const TIMEFRAMES = [
  { id: 'now', label: 'Current' },
  { id: 'm1', label: '1 mo' },
  { id: 'm3', label: '3 mo' },
  { id: 'm12', label: '1 yr' },
]

export const LEVELS = [
  { id: 'zip', label: 'Zip', noun: 'zip codes' },
  { id: 'town', label: 'Town', noun: 'towns' },
  { id: 'county', label: 'County', noun: 'counties' },
]

const KIND_FMT = {
  currency: dollars,
  percent: percent,
  days: days,
  ratio: ratio,
  count: (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US')),
}

const DELTA_FMT = { pct: percent, days: deltaDays, pts: pts }

// The default selection: {kind:'score', id:'overall'} — or
// {kind:'metric', id:'zhvi', timeframe:'m3'} etc.
export const DEFAULT_SELECTION = { kind: 'score', id: 'overall' }

// Resolve a selection to everything the map/legend/tooltip need:
// prop (joined feature property), ramp type, label, formatter, domainKey.
export function resolveField(sel) {
  if (sel.kind === 'score') {
    const s = SCORES.find((x) => x.id === sel.id) ?? SCORES[0]
    return {
      prop: `score_${s.id}`,
      ramp: 'score',
      label: `${s.label} score`,
      desc: s.desc,
      fmt: score1,
      tickFmt: score1,
      scoreId: s.id,
    }
  }
  const m = METRICS.find((x) => x.id === sel.id) ?? METRICS[0]
  const tf = m.timeframes.includes(sel.timeframe) ? sel.timeframe : m.timeframes[0]
  if (tf === 'now') {
    const fmt = KIND_FMT[m.kind]
    return {
      prop: `v_${m.id}`,
      domainKey: m.id,
      ramp: m.signed ? 'div' : 'seq',
      label: m.label,
      fmt,
      tickFmt: m.kind === 'currency' ? dollarsCompact : fmt,
      metricId: m.id,
      timeframe: tf,
    }
  }
  const tfLabel = { m1: '1-month change', m3: '3-month change', m12: '1-year change' }[tf]
  const fmt = DELTA_FMT[m.deltaKind]
  return {
    prop: `v_${m.id}__${tf}`,
    domainKey: `${m.id}__${tf}`,
    ramp: 'div',
    label: `${m.label} — ${tfLabel}`,
    fmt,
    tickFmt: fmt,
    metricId: m.id,
    timeframe: tf,
  }
}

// Color domain [low, mid, high] for a field, from the level's meta.domains.
// Signed current-value metrics get symmetrized so 0 sits at the neutral mid.
export function domainFor(field, domains) {
  if (field.ramp === 'score') return [0, 50, 100]
  const d = domains?.[field.domainKey]
  if (!d) return null
  if (field.ramp === 'div') {
    const a = Math.max(Math.abs(d[0]), Math.abs(d[2]))
    return a > 0 ? [-a, 0, a] : null
  }
  return d[0] < d[2] ? d : null
}

// Read a field's value off a scores entry (for Rankings and delta chips).
export function valueOf(field, entry) {
  if (field.ramp === 'score') return entry.scores[field.scoreId]
  if (field.timeframe === 'now') return entry.stats[field.metricId]
  return entry.trends?.[field.metricId]?.[field.timeframe] ?? null
}
