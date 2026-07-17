import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import GeoLevelToggle from './components/GeoLevelToggle.jsx'
import MetricPicker from './components/MetricPicker.jsx'
import Legend from './components/Legend.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import SearchBox from './components/SearchBox.jsx'
import Rankings from './components/Rankings.jsx'
import Pulse from './components/Pulse.jsx'
import StateSummary from './components/StateSummary.jsx'
import Methodology from './components/Methodology.jsx'
import { useLevelData } from './lib/useLevelData.js'
import { DEFAULT_SELECTION, resolveField, domainFor, LEVELS } from './lib/metrics.js'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  if (hash.startsWith('#/methodology')) return 'methodology'
  if (hash.startsWith('#/rankings')) return 'rankings'
  if (hash.startsWith('#/pulse')) return 'pulse'
  return 'map'
}

export default function App() {
  const [level, setLevel] = useState('zip')
  const [selection, setSelection] = useState(DEFAULT_SELECTION)
  const [selectedId, setSelectedId] = useState(null)
  const [flyTo, setFlyTo] = useState(null)
  const view = useHashRoute()
  const { scores, geo, searchIndex, error } = useLevelData(level)

  const field = useMemo(() => resolveField(selection), [selection])
  const domain = useMemo(
    () => domainFor(field, scores?.meta?.domains),
    [field, scores],
  )

  // Count of geos with a score per dimension (to flag empty layers in the UI).
  const coverage = scores?.meta?.scored ?? null
  const selectedEntry = selectedId ? scores?.geos?.[selectedId] : null
  const levelNoun = LEVELS.find((l) => l.id === level)?.noun

  function changeLevel(next) {
    if (next === level) return
    setLevel(next)
    setSelectedId(null)
  }

  function goTo({ level: nextLevel, id }) {
    window.location.hash = '#/'
    setLevel(nextLevel)
    setSelectedId(id)
    setFlyTo({ id, at: Date.now() })
  }

  function renderTooltip(props) {
    const title =
      level === 'zip'
        ? `${props.id}${props.city ? ' · ' + escapeHtml(props.city) : ''}`
        : level === 'county'
          ? `${escapeHtml(props.name)} County`
          : escapeHtml(props.name)
    const v = props[field.prop]
    const value = v != null ? field.fmt(v) : 'no data'
    const rank =
      level === 'county' && field.ramp === 'score' && scores?.geos?.[props.id]?.rank?.[field.scoreId] != null
        ? ` · #${scores.geos[props.id].rank[field.scoreId]} of ${scores.meta.scored[field.scoreId]}`
        : ''
    return `<strong>${title}</strong><span class="tt-score">${value}${rank}</span>`
  }

  return (
    <div className="app">
      {view === 'map' ? (
        <>
          <MapView
            geo={geo}
            field={field}
            domain={domain}
            selectedId={selectedId}
            onSelect={setSelectedId}
            flyTo={flyTo}
            renderTooltip={renderTooltip}
          />
          <header className="top-bar">
            <div className="brand card">
              <h1>NJ Market Map</h1>
              <p>New Jersey real estate, scored by {levelNoun}</p>
            </div>
            {scores && (
              <div className="controls card">
                <SearchBox index={searchIndex} onPick={goTo} />
                <GeoLevelToggle level={level} onChange={changeLevel} />
                <MetricPicker selection={selection} onChange={setSelection} coverage={coverage} />
              </div>
            )}
            <StateSummary />
          </header>
          <Legend
            field={field}
            domain={domain}
            empty={field.ramp === 'score' && coverage?.[field.scoreId] === 0}
          />
          {selectedEntry && (
            <DetailPanel
              id={selectedId}
              level={level}
              entry={selectedEntry}
              meta={scores?.meta}
              onClose={() => setSelectedId(null)}
            />
          )}
          {!geo && !error && <div className="loading card">Loading map data…</div>}
          {error && (
            <div className="loading card error">
              Failed to load map data: {String(error.message)}
            </div>
          )}
        </>
      ) : view === 'rankings' ? (
        <div className="page-scroll">
          <Rankings onPick={goTo} />
        </div>
      ) : view === 'pulse' ? (
        <div className="page-scroll">
          <Pulse />
        </div>
      ) : (
        <Methodology meta={scores?.meta} />
      )}
      <nav className="site-nav card">
        <a href="#/" className={view === 'map' ? 'active' : ''}>
          Map
        </a>
        <a href="#/rankings" className={view === 'rankings' ? 'active' : ''}>
          Rankings
        </a>
        <a href="#/pulse" className={view === 'pulse' ? 'active' : ''}>
          Pulse
        </a>
        <a href="#/methodology" className={view === 'methodology' ? 'active' : ''}>
          Methodology
        </a>
      </nav>
      <footer className="site-footer">
        <a href="https://www.zillow.com/research/data/" target="_blank" rel="noreferrer">
          Data provided by Zillow
        </a>
        <span>·</span>
        <a href="https://www.redfin.com/news/data-center/" target="_blank" rel="noreferrer">
          Redfin Data Center
        </a>
        <span>·</span>
        <span>U.S. Census Bureau ACS</span>
      </footer>
    </div>
  )
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
