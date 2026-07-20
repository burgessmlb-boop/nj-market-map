// Off-market ("pre-MLS") opportunity signals — neighborhood indicators of where
// off-market deal flow tends to concentrate. These are AREA AVERAGES from the
// Census, never individual properties or owners.
//
// Order matters: this is the order they appear in the filter panel.
export const SIGNALS = [
  {
    id: 'distressed_vacancy',
    label: 'Distressed vacancy',
    desc: 'Homes sitting empty and not for sale or rent',
  },
  {
    id: 'absentee',
    label: 'Landlord density',
    desc: 'Share of homes rented out — tired-landlord potential',
  },
  {
    id: 'free_clear',
    label: 'Owned free & clear',
    desc: 'No mortgage, so owners have equity and can sell easily',
  },
  {
    id: 'long_tenure',
    label: 'Long-time owners',
    desc: 'Owned 15+ years — equity plus life-stage moves',
  },
  {
    id: 'older_stock',
    label: 'Older housing',
    desc: 'Built before 1970 — value-add and rehab targets',
  },
  {
    id: 'seasonal',
    label: 'Seasonal / second homes',
    desc: 'Shore and vacation markets',
  },
]

export const SIGNAL_BY_ID = Object.fromEntries(SIGNALS.map((s) => [s.id, s]))

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
