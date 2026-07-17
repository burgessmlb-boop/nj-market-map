import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { fillExpression, opacityExpression } from '../lib/colors.js'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const NJ_CENTER = [-74.55, 40.06]
const NJ_MAX_BOUNDS = [
  [-76.6, 38.5],
  [-72.6, 41.7],
]
const EMPTY = { type: 'FeatureCollection', features: [] }

export default function MapView({ geo, field, domain, selectedId, onSelect, flyTo, renderTooltip }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const loadedRef = useRef(false)
  const hoverRef = useRef(null)
  const selectedRef = useRef(null)
  const geoRef = useRef(geo)
  const tooltipFnRef = useRef(renderTooltip)
  const flownRef = useRef(null)

  useEffect(() => {
    geoRef.current = geo
  }, [geo])
  useEffect(() => {
    tooltipFnRef.current = renderTooltip
  }, [renderTooltip])

  const paintRef = useRef({ field, domain })
  useEffect(() => {
    paintRef.current = { field, domain }
  }, [field, domain])

  // Create the map once.
  useEffect(() => {
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
      className: 'geo-tooltip',
      maxWidth: 'none',
    })

    map.on('load', () => {
      map.addSource('geo', {
        type: 'geojson',
        data: geoRef.current?.geojson ?? EMPTY,
        promoteId: 'id',
      })

      // Insert under the basemap's first symbol layer so place labels stay on top.
      const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
      const { field: f, domain: d } = paintRef.current

      map.addLayer(
        {
          id: 'geo-fill',
          type: 'fill',
          source: 'geo',
          paint: {
            'fill-color': fillExpression(f, d),
            'fill-opacity': opacityExpression(f),
          },
        },
        firstSymbol,
      )
      map.addLayer(
        {
          id: 'geo-line',
          type: 'line',
          source: 'geo',
          paint: { 'line-color': 'rgba(255,255,255,0.65)', 'line-width': 0.6 },
        },
        firstSymbol,
      )
      map.addLayer({
        id: 'geo-highlight',
        type: 'line',
        source: 'geo',
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
        map.setFeatureState({ source: 'geo', id: selectedRef.current }, { selected: true })
      }
    })

    map.on('mousemove', 'geo-fill', (e) => {
      const f = e.features?.[0]
      if (!f) return
      const id = f.properties.id
      if (hoverRef.current && hoverRef.current !== id) {
        map.setFeatureState({ source: 'geo', id: hoverRef.current }, { hover: false })
      }
      hoverRef.current = id
      map.setFeatureState({ source: 'geo', id }, { hover: true })
      map.getCanvas().style.cursor = 'pointer'
      tooltip.setLngLat(e.lngLat).setHTML(tooltipFnRef.current(f.properties)).addTo(map)
    })

    map.on('mouseleave', 'geo-fill', () => {
      if (hoverRef.current) {
        map.setFeatureState({ source: 'geo', id: hoverRef.current }, { hover: false })
        hoverRef.current = null
      }
      map.getCanvas().style.cursor = ''
      tooltip.remove()
    })

    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['geo-fill'] })
      onSelect(hits.length ? hits[0].properties.id : null)
    })

    return () => {
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Level switch: swap the source data and drop stale feature-state.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current || !geo) return
    map.removeFeatureState({ source: 'geo' })
    hoverRef.current = null
    map.getSource('geo').setData(geo.geojson)
    if (selectedRef.current) {
      map.setFeatureState({ source: 'geo', id: selectedRef.current }, { selected: true })
    }
  }, [geo])

  // Field/domain switch: restyle fill color and no-data opacity only.
  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) {
      map.setPaintProperty('geo-fill', 'fill-color', fillExpression(field, domain))
      map.setPaintProperty('geo-fill', 'fill-opacity', opacityExpression(field))
    }
  }, [field, domain])

  // Selection highlight via feature-state.
  useEffect(() => {
    const map = mapRef.current
    const prev = selectedRef.current
    selectedRef.current = selectedId
    if (!map || !loadedRef.current) return
    if (prev) map.setFeatureState({ source: 'geo', id: prev }, { selected: false })
    if (selectedId) {
      map.setFeatureState({ source: 'geo', id: selectedId }, { selected: true })
    }
  }, [selectedId])

  // Fly to a place chosen in search/rankings (waits for its level's bounds).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo || flownRef.current === flyTo.at) return
    const box = geo?.bounds?.[flyTo.id]
    if (box) {
      flownRef.current = flyTo.at
      map.fitBounds(
        [
          [box[0], box[1]],
          [box[2], box[3]],
        ],
        { padding: 120, maxZoom: 12, duration: 900 },
      )
    }
  }, [flyTo, geo])

  return <div ref={containerRef} className="map-container" />
}
