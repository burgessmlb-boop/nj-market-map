import { useMemo, useRef, useState } from 'react'

const LEVEL_BADGE = { zip: 'zip', town: 'town', county: 'county' }

export default function SearchBox({ index, onPick }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const hits = index.filter(
      (e) => e.name.toLowerCase().startsWith(q) || e.sub.toLowerCase().includes(q),
    )
    // Towns and counties before individual zips; then alphabetical.
    const order = { county: 0, town: 1, zip: 2 }
    hits.sort(
      (a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name),
    )
    return hits.slice(0, 8)
  }, [index, query])

  function pick(entry) {
    onPick(entry)
    setQuery('')
    setOpen(false)
    boxRef.current?.blur()
  }

  function onKeyDown(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(results[Math.min(cursor, results.length - 1)])
    } else if (e.key === 'Escape') {
      setOpen(false)
      boxRef.current?.blur()
    }
  }

  return (
    <div className="search-box">
      <input
        ref={boxRef}
        type="search"
        placeholder="Search town, county or zip…"
        value={query}
        aria-label="Search town, county or zip code"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setCursor(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className="search-results card" role="listbox">
          {results.map((e, i) => (
            <li
              key={`${e.level}:${e.id}`}
              role="option"
              aria-selected={i === cursor}
              className={i === cursor ? 'cursor' : ''}
              onMouseDown={(ev) => {
                ev.preventDefault()
                pick(e)
              }}
              onMouseEnter={() => setCursor(i)}
            >
              <span className={`level-badge level-${e.level}`}>{LEVEL_BADGE[e.level]}</span>
              <strong>{e.name}</strong>
              <span className="result-county">{e.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
