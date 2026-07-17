import { useEffect, useMemo, useState } from 'react'
import { scoreColor, scoreInk } from '../lib/colors.js'
import { score1 } from '../lib/format.js'
import { SCORES, METRICS, TIMEFRAMES, LEVELS, resolveField, valueOf } from '../lib/metrics.js'
import { loadScores } from '../lib/useLevelData.js'

const PAGE = 25

// Leaderboard: best places by any score or metric, per geography level.
// Clicking a row jumps to that place on the map.
export default function Rankings({ onPick }) {
  const [level, setLevel] = useState('town')
  const [sel, setSel] = useState({ kind: 'score', id: 'overall' })
  const [limit, setLimit] = useState(PAGE)
  const [scores, setScores] = useState(null)
  const [asc, setAsc] = useState(false)

  useEffect(() => {
    let cancelled = false
    setScores(null)
    loadScores(level).then((s) => !cancelled && setScores(s))
    return () => {
      cancelled = true
    }
  }, [level])

  const field = resolveField(sel)
  const activeMetric = sel.kind === 'metric' ? METRICS.find((m) => m.id === sel.id) : null

  const rows = useMemo(() => {
    if (!scores) return []
    const all = Object.entries(scores.geos)
      .map(([id, e]) => ({ id, entry: e, value: valueOf(field, e) }))
      .filter((r) => r.value != null)
    all.sort((a, b) => (asc ? a.value - b.value : b.value - a.value))
    return all
  }, [scores, field, asc])

  const noun = LEVELS.find((l) => l.id === level)?.noun

  return (
    <div className="rankings">
      <h1>Rankings</h1>
      <p className="rankings-sub">
        Best New Jersey {noun} by {field.label.toLowerCase()}. Click a row to see it on the map.
      </p>

      <div className="rankings-controls">
        <div className="layer-toggle" role="tablist" aria-label="Geography level">
          {LEVELS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={level === id}
              className={level === id ? 'active' : ''}
              onClick={() => {
                setLevel(id)
                setLimit(PAGE)
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className="metric-select"
          aria-label="Rank by"
          value={`${sel.kind}:${sel.id}`}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(':')
            setSel(
              kind === 'score'
                ? { kind, id }
                : { kind, id, timeframe: METRICS.find((m) => m.id === id).timeframes[0] },
            )
            setLimit(PAGE)
          }}
        >
          <optgroup label="Scores">
            {SCORES.map((s) => (
              <option key={s.id} value={`score:${s.id}`}>
                {s.label} score
              </option>
            ))}
          </optgroup>
          <optgroup label="Metrics">
            {METRICS.map((m) => (
              <option key={m.id} value={`metric:${m.id}`}>
                {m.label}
              </option>
            ))}
          </optgroup>
        </select>

        {activeMetric && activeMetric.timeframes.length > 1 && (
          <div className="layer-toggle" role="tablist" aria-label="Timeframe">
            {TIMEFRAMES.filter((t) => activeMetric.timeframes.includes(t.id)).map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                aria-selected={sel.timeframe === id}
                className={sel.timeframe === id ? 'active' : ''}
                onClick={() => setSel({ ...sel, timeframe: id })}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <button className="sort-toggle" onClick={() => setAsc(!asc)}>
          {asc ? 'Lowest first ↑' : 'Highest first ↓'}
        </button>
      </div>

      {!scores ? (
        <p className="rankings-sub">Loading…</p>
      ) : (
        <>
          <table className="rank-table card">
            <thead>
              <tr>
                <th>#</th>
                <th>{level === 'zip' ? 'Zip' : level === 'town' ? 'Town' : 'County'}</th>
                {level !== 'county' && <th className="rank-county">County</th>}
                <th className="rank-value">{field.label}</th>
                <th className="rank-score">Overall</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r, i) => (
                <tr key={r.id} onClick={() => onPick({ level, id: r.id })}>
                  <td className="rank-n">{i + 1}</td>
                  <td>
                    <strong>{r.entry.name}</strong>
                    {level === 'zip' && r.entry.city ? (
                      <span className="rank-sub"> {r.entry.city}</span>
                    ) : null}
                  </td>
                  {level !== 'county' && <td className="rank-county">{r.entry.county}</td>}
                  <td className="rank-value">{field.fmt(r.value)}</td>
                  <td className="rank-score">
                    <span
                      className="score-chip"
                      style={{
                        background: scoreColor(r.entry.scores.overall),
                        color: scoreInk(r.entry.scores.overall),
                      }}
                    >
                      {score1(r.entry.scores.overall)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <button className="show-more" onClick={() => setLimit(limit + 50)}>
              Show more ({rows.length - limit} remaining)
            </button>
          )}
          {rows.length === 0 && <p className="rankings-sub">No data for this selection.</p>}
        </>
      )}
    </div>
  )
}
