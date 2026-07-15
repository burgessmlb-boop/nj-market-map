import { useEffect, useState } from 'react'

const BASE = import.meta.env.BASE_URL

// Fetches scores.json + nj_zcta.geojson, joins scores into feature
// properties, and precomputes per-zip bounding boxes for search fly-to.
export function useScores() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`${BASE}data/scores.json`).then((r) => {
        if (!r.ok) throw new Error(`scores.json: HTTP ${r.status}`)
        return r.json()
      }),
      fetch(`${BASE}data/nj_zcta.geojson`).then((r) => {
        if (!r.ok) throw new Error(`nj_zcta.geojson: HTTP ${r.status}`)
        return r.json()
      }),
    ])
      .then(([scores, geojson]) => {
        if (cancelled) return
        const bounds = {}
        for (const f of geojson.features) {
          const zip = f.properties.zip
          const entry = scores.zips[zip]
          if (entry) {
            f.properties.city = entry.city
            for (const [dim, v] of Object.entries(entry.scores)) {
              if (v != null) f.properties[`score_${dim}`] = v
            }
          }
          bounds[zip] = bbox(f.geometry.coordinates)
        }
        const searchIndex = Object.entries(scores.zips).map(([zip, e]) => ({
          zip,
          city: e.city,
          county: e.county,
        }))
        setData({ scores, geojson, bounds, searchIndex })
      })
      .catch((e) => !cancelled && setError(e))
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error }
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
