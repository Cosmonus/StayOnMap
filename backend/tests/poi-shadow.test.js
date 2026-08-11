// Shadow validation — the comparison, not the sampling.
//
// What matters here is that the report cannot flatter the change it is meant to
// scrutinise: the two directions are never netted, "never scored" is never
// folded into "scored badly", and the legacy rule stays frozen.
import { describe, it, expect } from 'vitest'
import {
  dedupeWith, compareDedupe, summariseDedupe, summariseScores,
} from '../src/features/spatial/poiShadow.js'

const LAT = 12.9352
const LNG = 77.6245
const M = 1 / 111_320

const poi = (osmId, name, metres) => ({
  osmId, name, brand: null,
  distanceM: metres,
  lat: LAT + metres * M,
  lng: LNG,
})

describe('dedupeWith', () => {
  it('is parameterised, so both rules run over identical input', () => {
    const rows = [poi('a', 'Blue Tokai', 100), poi('b', 'Blue Tokai', 180)]
    expect(dedupeWith(rows, 30, 150)).toHaveLength(1)  // legacy merges at 80 m
    expect(dedupeWith(rows, 20, 60)).toHaveLength(2)   // POINT keeps them apart
  })
})

describe('compareDedupe', () => {
  it('reports a place the new rule keeps that the old one merged away', () => {
    // Two cafes 80 m apart. The flat 150 m rule called them one cafe.
    const r = compareDedupe([poi('a', 'Blue Tokai', 100), poi('b', 'Blue Tokai', 180)], 'cafe')
    expect(r.legacyCount).toBe(1)
    expect(r.nextCount).toBe(2)
    expect(r.appeared).toBe(1)
    expect(r.disappeared).toBe(0)
  })

  it('reports a place the new rule merges that the old one kept', () => {
    // Hospital blocks 300 m apart. The flat rule made them two hospitals.
    const r = compareDedupe(
      [poi('a', 'Manipal Hospital', 100), poi('b', 'Manipal Hospital', 400)],
      'hospital'
    )
    expect(r.legacyCount).toBe(2)
    expect(r.nextCount).toBe(1)
    expect(r.disappeared).toBe(1)
    expect(r.appeared).toBe(0)
  })

  it('says nothing changed when nothing changed', () => {
    const r = compareDedupe([poi('a', 'Apollo', 100), poi('b', 'MedPlus', 400)], 'pharmacy')
    expect(r.appeared).toBe(0)
    expect(r.disappeared).toBe(0)
    expect(r.nearestChanged).toBe(false)
  })

  it('separates an unnamed neighbour the old radius swallowed', () => {
    // A named cafe with an unnamed point 25 m behind it. The legacy 30 m
    // unnamed radius called that the node/way double of the first; cafe's own
    // 20 m radius does not, because two shopfronts 25 m apart on an Indian
    // high street are two shopfronts.
    //
    // Order matters and is the point: the collapse fires on the LATER row
    // being unnamed, since the list is walked nearest-first.
    const r = compareDedupe(
      [poi('a', 'Third Wave', 100), poi('b', null, 125)],
      'cafe'
    )
    expect(r.thresholds.next).toEqual([20, 60])
    expect(r.legacyCount).toBe(1)
    expect(r.nextCount).toBe(2)
    expect(r.appeared).toBe(1)
    // The nearest is unchanged — only the count moved. Worth asserting: a
    // report that conflated "there are more of them" with "the closest one is
    // different" would overstate what a user actually sees.
    expect(r.nearestChanged).toBe(false)
  })

  it('carries both threshold pairs so a reader can check the arithmetic', () => {
    const r = compareDedupe([poi('a', 'X', 10), poi('b', 'X', 20)], 'hospital')
    expect(r.thresholds).toEqual({ legacy: [30, 150], next: [120, 400] })
  })
})

describe('summariseDedupe', () => {
  it('never nets the two directions against each other', () => {
    // A net of zero can mean "nothing changed" or "twelve wrong merges traded
    // for twelve wrong splits". Those are not the same result and the summary
    // must not be able to report them identically.
    const s = summariseDedupe([
      { category: 'cafe', appeared: 12, disappeared: 0, nearestChanged: false, thresholds: {} },
      { category: 'hospital', appeared: 0, disappeared: 12, nearestChanged: false, thresholds: {} },
    ])
    expect(s.appeared).toBe(12)
    expect(s.disappeared).toBe(12)
    expect(s).not.toHaveProperty('net')
  })

  it('counts CATEGORIES affected, not just totals', () => {
    // One category changing a lot is a threshold to re-examine; every category
    // changing a little is the rule working. A single total hides which.
    const s = summariseDedupe([
      { category: 'cafe', appeared: 40, disappeared: 0, nearestChanged: true, thresholds: {} },
      { category: 'bank', appeared: 0, disappeared: 0, nearestChanged: false, thresholds: {} },
    ])
    expect(s.categoriesChanged).toBe(1)
    expect(s.nearestChanged).toBe(1)
    expect(s.byCategory.bank.appeared).toBe(0)
  })
})

describe('summariseScores', () => {
  it('keeps "never scored" out of the bands', () => {
    // The distinction this whole layer exists to preserve, and a rollout report
    // is the worst possible place to lose it: folding unscored rows into
    // MINIMAL would report an un-run job as a database full of bad data.
    const s = summariseScores([
      { trustScore: null }, { trustScore: null }, { trustScore: 90 }, { trustScore: 10 },
    ])
    expect(s.unscored).toBe(2)
    expect(s.bands.MINIMAL).toBe(1)
    expect(s.bands.HIGH).toBe(1)
    expect(s.total).toBe(4)
  })

  it('bands on the same boundaries as module confidence', () => {
    // A POI's band and a module's band appear on one screen; they have to mean
    // the same thing. envelope.js: 0.75 / 0.50 / 0.25.
    const s = summariseScores([
      { trustScore: 75 }, { trustScore: 74 }, { trustScore: 50 }, { trustScore: 24 },
    ])
    expect(s.bands).toEqual({ HIGH: 1, MODERATE: 2, LOW: 0, MINIMAL: 1 })
  })

  it('reports no average', () => {
    // An average trust score describes no POI and moves for reasons that have
    // nothing to do with quality — a city being seeded, a category being added.
    const s = summariseScores([{ trustScore: 90 }, { trustScore: 10 }])
    expect(s).not.toHaveProperty('average')
    expect(s).not.toHaveProperty('mean')
  })
})
