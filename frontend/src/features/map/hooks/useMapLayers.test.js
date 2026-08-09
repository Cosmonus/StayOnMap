// The two rules that keep the metro layer from making zoom feel late.
//
// Both are about COUNT, not correctness — the layer rendered the right thing
// before, it just rendered ~93k vertices and 741 symbols of it on every camera
// change. Google's Data layer re-projects everything it holds, so what is in
// the layer IS the frame budget.
import { describe, it, expect } from 'vitest'
import { splitMetroFeatures, stationsVisibleAt } from './useMapLayers'
import metro from '@/data/layers/metro-lines.json'

const line = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })
const point = () => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [77, 12] } })

describe('splitMetroFeatures', () => {
  it('separates stations from lines so the expensive half can be detached', () => {
    const { lines, stations } = splitMetroFeatures({ type: 'FeatureCollection', features: [line([[77, 12], [78, 13]]), point(), point()] })
    expect(lines.features).toHaveLength(1)
    expect(stations.features).toHaveLength(2)
  })

  it('keeps every feature — this is a split, never a filter', () => {
    const { lines, stations } = splitMetroFeatures(metro)
    expect(lines.features.length + stations.features.length).toBe(metro.features.length)
  })

  it('puts the overwhelming majority of features on the zoom-gated layer', () => {
    // 741 of 785 in the shipped network. If this ever inverts, gating stations
    // has stopped being the lever and this whole design needs rethinking.
    const { stations } = splitMetroFeatures(metro)
    expect(stations.features.length / metro.features.length).toBeGreaterThan(0.9)
  })
})

describe('stationsVisibleAt', () => {
  it('hides station dots above neighbourhood zoom', () => {
    expect(stationsVisibleAt(11)).toBe(false)
    expect(stationsVisibleAt(12.9)).toBe(false)
  })

  it('shows them from street zoom', () => {
    expect(stationsVisibleAt(13)).toBe(true)
    expect(stationsVisibleAt(17)).toBe(true)
  })

  it('treats an unknown zoom as too far out', () => {
    // getZoom() returns undefined before the map has settled. Defaulting the
    // other way would put 741 symbols on screen for exactly the frames where
    // the map is busiest.
    expect(stationsVisibleAt(undefined)).toBe(false)
  })
})

describe('the shipped geometry', () => {
  it('is not resampled — a spline here is invisible and costs 8x', () => {
    // Median vertex spacing is 48.7 m: 0.65 px at zoom 11, 2.6 px at zoom 13,
    // under a 3.5 px stroke. The Catmull-Rom pass that used to run here
    // interpolated INSIDE that span. This asserts the vertex count the layer
    // receives still matches the file on disk, so reintroducing smoothing in
    // the render path fails here rather than in someone's frame rate.
    const { lines } = splitMetroFeatures(metro)
    const vertices = lines.features.reduce((n, f) => n + f.geometry.coordinates.length, 0)
    const onDisk = metro.features
      .filter((f) => f.geometry.type === 'LineString')
      .reduce((n, f) => n + f.geometry.coordinates.length, 0)
    expect(vertices).toBe(onDisk)
  })
})
