import { useEffect, useMemo, useState } from 'react'
import { LEVELS } from './metrics.js'

const BASE = import.meta.env.BASE_URL

// Module-level caches survive level switches and page (hash) navigation.
const scoresCache = new Map() // level -> scores json
const geoCache = new Map() // level -> { geojson (joined), bounds }
const pending = new Map() // url -> promise

function fetchJson(url) {
  if (!pending.has(url)) {
    pending.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url.split('/').pop()}: HTTP ${r.status}`)
        return r.json()
      }),
    )
  }
  return pending.get(url)
}

export function loadScores(level) {
  if (scoresCache.has(level)) return Promise.resolve(scoresCache.get(level))
  return fetchJson(`${BASE}data/scores_${level}.json`).then((scores) => {
    scoresCache.set(level, scores)
    return scores
  })
}

// Join every colorable value into feature properties once per level:
// score_<dim> for the four scores, v_<metric> for current values,
// v_<metric>__<window> for deltas. MapLibre then colors by property name.
function joinLevel(scores, geojson) {
  const bounds = {}
  for (const f of geojson.features) {
    const id = f.properties.id
    const entry = scores.geos[id]
    if (entry) {
      f.properties.county = entry.county ?? ''
      if (entry.city) f.properties.city = entry.city
      for (const [dim, v] of Object.entries(entry.scores)) {
        if (v != null) f.properties[`score_${dim}`] = v
      }
      for (const [k, v] of Object.entries(entry.stats)) {
        if (v != null) f.properties[`v_${k}`] = v
      }
      for (const [metric, wins] of Object.entries(entry.trends ?? {})) {
        for (const [win, v] of Object.entries(wins)) {
          if (v != null) f.properties[`v_${metric}__${win}`] = v
        }
      }
      // Off-market signals: raw share for tooltips, percentile for heat blending.
      for (const [k, v] of Object.entries(entry.signals ?? {})) {
        if (v != null) f.properties[`sig_${k}`] = v
      }
      for (const [k, v] of Object.entries(entry.signal_pct ?? {})) {
        if (v != null) f.properties[`sp_${k}`] = v
      }
    }
    bounds[id] = bbox(f.geometry.coordinates)
  }
  return { geojson, bounds }
}

export function loadLevel(level) {
  if (geoCache.has(level)) return Promise.resolve(geoCache.get(level))
  return Promise.all([loadScores(level), fetchJson(`${BASE}data/geo_${level}.geojson`)]).then(
    ([scores, geojson]) => {
      const joined = joinLevel(scores, geojson)
      geoCache.set(level, joined)
      return joined
    },
  )
}

function searchEntries(level, scores) {
  return Object.entries(scores.geos).map(([id, e]) => ({
    level,
    id,
    name: e.name,
    sub:
      level === 'zip'
        ? [e.city, e.county].filter(Boolean).join(', ')
        : level === 'town'
          ? `${e.county} County`
          : 'County',
  }))
}

// Loads the active level's scores + boundaries (joined), plus every other
// level's scores in the background so search spans all levels.
export function useLevelData(level) {
  const [, bump] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadLevel(level)
      .then(() => !cancelled && bump((n) => n + 1))
      .catch((e) => !cancelled && setError(e))
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 800))
    const handle = idle(() => {
      for (const { id } of LEVELS) {
        if (id !== level) {
          loadScores(id)
            .then(() => !cancelled && bump((n) => n + 1))
            .catch(() => {})
        }
      }
    })
    return () => {
      cancelled = true
      ;(window.cancelIdleCallback ?? clearTimeout)(handle)
    }
  }, [level])

  const scores = scoresCache.get(level) ?? null
  const geo = geoCache.get(level) ?? null

  const searchIndex = useMemo(() => {
    const out = []
    for (const { id } of LEVELS) {
      const s = scoresCache.get(id)
      if (s) out.push(...searchEntries(id, s))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoresCache.size, scores])

  return { scores, geo, searchIndex, error }
}

function bbox(coords, box = [Infinity, Infinity, -Infinity, -Infinity]) {
  if (typeof coords[0] === 'number') {
    box[0] = Math.min(box[0], coords[0])
    box[1] = Math.min(box[1], coords[1])
    box[2] = Math.max(box[2], coords[0])
    box[3] = Math.max(box[3], coords[1])
    return box
  }
  for (const c of coords) bbox(c, box)
  return box
}
