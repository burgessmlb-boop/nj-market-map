import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import LayerToggle from './components/LayerToggle.jsx'
import Legend from './components/Legend.jsx'
import DetailPanel from './components/DetailPanel.jsx'
import SearchBox from './components/SearchBox.jsx'
import Methodology from './components/Methodology.jsx'
import { useScores } from './lib/useScores.js'

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.startsWith('#/methodology') ? 'methodology' : 'map'
}

export default function App() {
  const { data, error } = useScores()
  const [activeLayer, setActiveLayer] = useState('overall')
  const [selectedZip, setSelectedZip] = useState(null)
  const [flyToZip, setFlyToZip] = useState(null)
  const view = useHashRoute()

  // Count of zips with a score per layer (to flag empty layers in the UI).
  const coverage = useMemo(() => {
    if (!data) return null
    const zips = Object.values(data.scores.zips)
    const out = {}
    for (const dim of ['overall', 'investment', 'hotness', 'affordability']) {
      out[dim] = zips.filter((z) => z.scores[dim] != null).length
    }
    return out
  }, [data])

  const selectedEntry = selectedZip ? data?.scores.zips[selectedZip] : null

  return (
    <div className="app">
      {view === 'map' ? (
        <>
          <MapView
            data={data}
            activeLayer={activeLayer}
            selectedZip={selectedZip}
            onSelect={setSelectedZip}
            flyToZip={flyToZip}
          />
          <header className="top-bar">
            <div className="brand card">
              <h1>NJ Market Map</h1>
              <p>New Jersey real estate, scored by zip code</p>
            </div>
            {data && (
              <div className="controls card">
                <SearchBox
                  index={data.searchIndex}
                  onPick={(e) => {
                    setSelectedZip(e.zip)
                    setFlyToZip({ zip: e.zip, at: Date.now() })
                  }}
                />
                <LayerToggle active={activeLayer} onChange={setActiveLayer} coverage={coverage} />
              </div>
            )}
          </header>
          <Legend activeLayer={activeLayer} coverage={coverage} />
          {selectedEntry && (
            <DetailPanel
              zip={selectedZip}
              entry={selectedEntry}
              meta={data?.scores.meta}
              onClose={() => setSelectedZip(null)}
            />
          )}
          {!data && !error && <div className="loading card">Loading map data…</div>}
          {error && (
            <div className="loading card error">
              Failed to load map data: {String(error.message)}
            </div>
          )}
        </>
      ) : (
        <Methodology meta={data?.scores.meta} />
      )}
      <footer className="site-footer">
        <a href="https://www.zillow.com/research/data/" target="_blank" rel="noreferrer">
          Data provided by Zillow
        </a>
        <span>·</span>
        <span>U.S. Census Bureau ACS</span>
        <span>·</span>
        {view === 'map' ? <a href="#/methodology">Methodology</a> : <a href="#/">Map</a>}
      </footer>
    </div>
  )
}
