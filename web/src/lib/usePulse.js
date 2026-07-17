import { useEffect, useState } from 'react'

const BASE = import.meta.env.BASE_URL

let cached
let promise

// pulse.json is optional (best-effort weekly build) — resolve null if absent.
export function usePulse() {
  const [pulse, setPulse] = useState(cached ?? null)

  useEffect(() => {
    if (cached !== undefined) return
    promise ??= fetch(`${BASE}data/pulse.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        cached = data
        return data
      })
    let cancelled = false
    promise.then((data) => !cancelled && setPulse(data))
    return () => {
      cancelled = true
    }
  }, [])

  return pulse
}
