// Off-market ("pre-MLS") opportunity signals — neighborhood indicators of where
// off-market deal flow tends to concentrate. These are AREA AVERAGES from the
// Census, never individual properties or owners.
//
// Categories group the filter panel. Colors validated for the light chart
// surface (#fcfcfb): all-pairs CVD separation deltaE 18.5 (deutan), normal
// vision 21.6. Every row also carries a text label, which is the required
// relief for amber's sub-3:1 contrast.
export const SIGNAL_CATEGORIES = [
  { id: 'distress', label: 'Distress & turnover', color: '#a92c24' },
  { id: 'equity', label: 'Equity & tenure', color: '#2a78d6' },
  { id: 'stock', label: 'Housing stock', color: '#c98500' },
]

// Order matters: this is the order they appear in the filter panel.
export const SIGNALS = [
  {
    id: 'distressed_vacancy',
    category: 'distress',
    label: 'Distressed vacancy',
    desc: 'Homes sitting empty and not for sale or rent',
  },
  {
    id: 'absentee',
    category: 'distress',
    label: 'Landlord density',
    desc: 'Share of homes rented out — tired-landlord potential',
  },
  {
    id: 'free_clear',
    category: 'equity',
    label: 'Owned free & clear',
    desc: 'No mortgage, so owners have equity and can sell easily',
  },
  {
    id: 'long_tenure',
    category: 'equity',
    label: 'Long-time owners',
    desc: 'Owned 15+ years — equity plus life-stage moves',
  },
  {
    id: 'older_stock',
    category: 'stock',
    label: 'Older housing',
    desc: 'Built before 1970 — value-add and rehab targets',
  },
  {
    id: 'seasonal',
    category: 'stock',
    label: 'Seasonal / second homes',
    desc: 'Shore and vacation markets',
  },
]

export const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]))

// Categories paired with their signals, in display order.
export const GROUPED_SIGNALS = SIGNAL_CATEGORIES.map((cat) => ({
  ...cat,
  signals: SIGNALS.filter((s) => s.category === cat.id),
}))

// Level-wide mean of each signal, for the panel's "NJ avg" column.
export function signalAverages(geos) {
  const totals = {}
  for (const entry of Object.values(geos ?? {})) {
    for (const [k, v] of Object.entries(entry.signals ?? {})) {
      if (typeof v !== 'number') continue
      totals[k] ??= { sum: 0, n: 0 }
      totals[k].sum += v
      totals[k].n++
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([k, { sum, n }]) => [k, n ? sum / n : null]),
  )
}

// Signals are shares (0-1) in the data; show them as percentages.
export function signalPct(v) {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`
}

// The blended heat field shown when one or more filters are active.
export const HEAT_FIELD = {
  prop: 'heat',
  ramp: 'score',
  label: 'Off-market opportunity',
  fmt: (v) => (v == null ? '—' : Math.round(v)),
  tickFmt: (v) => (v == null ? '—' : Math.round(v)),
}

// Blend the checked signals into one 0-100 heat value per feature: the mean of
// their percentile ranks, ignoring signals a place has no data for. A
// choropleth can only paint one number, so multiple checked filters average.
// Mutates feature properties and returns a new wrapper so MapView re-sets data.
export function applyHeat(geo, activeIds) {
  if (!geo) return null
  const ids = [...activeIds]
  for (const f of geo.geojson.features) {
    if (!ids.length) {
      delete f.properties.heat
      continue
    }
    let sum = 0
    let n = 0
    for (const id of ids) {
      const v = f.properties[`sp_${id}`]
      if (typeof v === 'number') {
        sum += v
        n++
      }
    }
    if (n) f.properties.heat = sum / n
    else delete f.properties.heat
  }
  // New wrapper object -> MapView's setData effect fires.
  return { ...geo, geojson: { ...geo.geojson } }
}
