import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fillExpression } from '../lib/colors.js'
import { score1 } from '../lib/format.js'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const NJ_CENTER = [-74.55, 40.06]
const NJ_MAX_BOUNDS = [
  [-76.6, 38.5],
  [-72.6, 41.7],
]

export default function MapView({ data, activeLayer, selectedZip, onSelect, flyToZip }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const loadedRef = useRef(false)
  const hoverZipRef = useRef(null)
  const selectedRef = useRef(null)
  const layerRef = useRef(activeLayer)

  useEffect(() => {
    layerRef.current = activeLayer
  }, [activeLayer])

  useEffect(() => {
    if (!data || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: NJ_CENTER,
      zoom: 7.3,
      maxBounds: NJ_MAX_BOUNDS,
      minZoom: 6.5,
      attributionControl: { compact: false },
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    const tooltip = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'zip-tooltip',
      maxWidth: 'none',
    })

    map.on('load', () => {
      map.addSource('zips', { type: 'geojson', data: data.geojson, promoteId: 'zip' })

      // Insert under the basemap's first symbol layer so place labels stay on top.
      const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id

      map.addLayer(
        {
          id: 'zip-fill',
          type: 'fill',
          source: 'zips',
          paint: {
            'fill-color': fillExpression(layerRef.current),
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              0.92,
              0.75,
            ],
          },
        },
        firstSymbol,
      )
      map.addLayer(
        {
          id: 'zip-line',
          type: 'line',
          source: 'zips',
          paint: { 'line-color': 'rgba(255,255,255,0.65)', 'line-width': 0.6 },
        },
        firstSymbol,
      )
      map.addLayer({
        id: 'zip-highlight',
        type: 'line',
        source: 'zips',
        paint: {
          'line-color': '#0b0b0b',
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            2.5,
            ['boolean', ['feature-state', 'hover'], false],
            1.5,
            0,
          ],
        },
      })

      loadedRef.current = true
      if (selectedRef.current) {
        map.setFeatureState({ source: 'zips', id: selectedRef.current }, { selected: true })
      }
    })

    map.on('mousemove', 'zip-fill', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const zip = f.properties.zip
      if (hoverZipRef.current && hoverZipRef.current !== zip) {
        map.setFeatureState({ source: 'zips', id: hoverZipRef.current }, { hover: false })
      }
      hoverZipRef.current = zip
      map.setFeatureState({ source: 'zips', id: zip }, { hover: true })
      map.getCanvas().style.cursor = 'pointer'

      const score = f.properties[`score_${layerRef.current}`]
      const city = f.properties.city
      tooltip
        .setLngLat(e.lngLat)
        .setHTML(
          `<strong>${zip}</strong>${city ? ` · ${escapeHtml(city)}` : ''}` +
            `<span class="tt-score">${score != null ? score1(score) : 'no data'}</span>`,
        )
        .addTo(map)
    })

    map.on('mouseleave', 'zip-fill', () => {
      if (hoverZipRef.current) {
        map.setFeatureState({ source: 'zips', id: hoverZipRef.current }, { hover: false })
        hoverZipRef.current = null
      }
      map.getCanvas().style.cursor = ''
      tooltip.remove()
    })

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['zip-fill'] })
      onSelect(hits.length ? hits[0].properties.zip : null)
    })

    return () => {
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Layer switch: restyle the fill only.
  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) {
      map.setPaintProperty('zip-fill', 'fill-color', fillExpression(activeLayer))
    }
  }, [activeLayer])

  // Selection highlight via feature-state.
  useEffect(() => {
    const map = mapRef.current
    const prev = selectedRef.current
    selectedRef.current = selectedZip
    if (!map || !loadedRef.current) return
    if (prev) map.setFeatureState({ source: 'zips', id: prev }, { selected: false })
    if (selectedZip) {
      map.setFeatureState({ source: 'zips', id: selectedZip }, { selected: true })
    }
  }, [selectedZip])

  // Fly to a zip chosen in the search box.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToZip) return
    const box = data?.bounds?.[flyToZip.zip]
    if (box) {
      map.fitBounds(
        [
          [box[0], box[1]],
          [box[2], box[3]],
        ],
        { padding: 120, maxZoom: 12, duration: 900 },
      )
    }
  }, [flyToZip]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="map-container" />
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
