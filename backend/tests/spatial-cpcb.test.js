// CPCB ground-station air quality.
//
// This is the only source in the environment module that is an instrument
// reading real air rather than a model reconstructing it, which makes it the
// only fact there allowed to claim MEASURED. That privilege is exactly why the
// parser has to be paranoid: a field-name guess that silently produced a
// plausible number would put an invented value on a card wearing the strongest
// provenance label the system has.
//
// The fixtures below are REAL ROWS, pasted verbatim from a live response on
// 2026-07-20. That matters: the first version of this file used the field names
// from the resource's own published metadata (`pollutant_avg`), and the live
// feed sends `avg_value`. Invented fixtures agreed with the invented parser and
// all eleven tests passed while the feature could never have worked.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  groupStations, nearestStation, parseLastUpdate, stationConfidenceFactor,
} from '../src/features/spatial/cpcbProvider.js'
import { env } from '../src/config/env.js'

// Verbatim live rows: one station with two pollutants, one with a dead sensor.
const RECORDS = [
  { country: 'India', state: 'Tamil Nadu', city: 'Chennai', station: 'Alandur Bus Depot, Chennai - CPCB', last_update: '20-07-2026 05:00:00', latitude: '12.99911', longitude: '80.19339', pollutant_id: 'PM2.5', min_value: '28', max_value: '71', avg_value: '48' },
  { country: 'India', state: 'Tamil Nadu', city: 'Chennai', station: 'Alandur Bus Depot, Chennai - CPCB', last_update: '20-07-2026 05:00:00', latitude: '12.99911', longitude: '80.19339', pollutant_id: 'PM10',  min_value: '40', max_value: '110', avg_value: '86' },
  { country: 'India', state: 'Andhra Pradesh', city: 'Machilipatnam', station: 'Srinivas Nagar Colony, Machilipatnam - APPCB', last_update: '20-07-2026 05:00:00', latitude: '16.186555', longitude: '81.13219', pollutant_id: 'PM2.5', min_value: 'NA', max_value: 'NA', avg_value: 'NA' },
]

describe('parseLastUpdate', () => {
  it('reads the feed\'s day-first format', () => {
    expect(parseLastUpdate('20-07-2026 05:00:00')).toBe('2026-07-20T05:00:00')
  })

  it('does not let a day-first date be read as month-first', () => {
    // The silent one: `new Date('07-08-2026')` is 7 August in the feed's terms
    // and 8 July to a JS Date. Wrong for any day <= 12, i.e. a third of the
    // month, and correct the rest of the time — which is how it survives.
    expect(parseLastUpdate('07-08-2026 05:00:00')).toBe('2026-08-07T05:00:00')
  })

  it('returns null on an unfamiliar shape rather than guessing', () => {
    // A fact with no observedAt is honest. A fact dated four months wrong is not.
    expect(parseLastUpdate('2026-07-20T05:00:00Z')).toBeNull()
    expect(parseLastUpdate('20/07/2026 05:00:00')).toBeNull()
    expect(parseLastUpdate('45-13-2026 05:00:00')).toBeNull()
    expect(parseLastUpdate(null)).toBeNull()
    expect(parseLastUpdate('')).toBeNull()
  })
})

describe('groupStations', () => {
  it('reads avg_value, the field the live feed actually sends', () => {
    // The regression that matters. The resource's own metadata advertises
    // `pollutant_avg`; the records carry `avg_value`. Reading the documented
    // name yields null for every station — safe, and permanently dark.
    const stations = groupStations(RECORDS)
    const alandur = stations.find((s) => s.name.startsWith('Alandur'))
    expect(alandur.pm25).toBe(48)
    expect(alandur.pm10).toBe(86)
  })

  it('also accepts the documented name, in case they ever fix the mismatch', () => {
    const stations = groupStations([
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'PM2.5', pollutant_avg: '55' },
    ])
    expect(stations[0].pm25).toBe(55)
  })

  it('collapses one-row-per-pollutant into one row per station', () => {
    // The feed sends a row per pollutant per station — 3416 rows for 488
    // stations on the day this was verified.
    expect(groupStations(RECORDS)).toHaveLength(1)
  })

  it('converts the day-first timestamp on the way through', () => {
    expect(groupStations(RECORDS)[0].observedAt).toBe('2026-07-20T05:00:00')
  })

  it('drops records with no usable coordinates rather than defaulting them', () => {
    // A station defaulted to 0,0 is in the Gulf of Guinea and would be "nearest"
    // to nothing — but a subtler default would silently attach one city's air to
    // another's listings.
    const stations = groupStations([
      { station: 'Nowhere', pollutant_id: 'PM2.5', avg_value: '40' },
      { station: 'Bad', latitude: 'NA', longitude: 'NA', pollutant_id: 'PM2.5', avg_value: '40' },
    ])
    expect(stations).toHaveLength(0)
  })

  it("treats 'NA' as no reading, not as zero", () => {
    // Not an edge case: 271 of 3416 live rows were 'NA'. And zero µg/m³ is not
    // merely wrong, it is the best possible air quality — the most flattering
    // direction the error could go.
    const machilipatnam = groupStations(RECORDS).find((s) => s.city === 'Machilipatnam')
    expect(machilipatnam).toBeUndefined() // dropped: no usable particulate reading

    const partial = groupStations([
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'PM2.5', avg_value: 'NA' },
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'PM10',  avg_value: '60' },
    ])
    expect(partial[0].pm25).toBeNull()
    expect(partial[0].pm10).toBe(60)
  })

  it('drops a station reporting only gases we do not ask about', () => {
    // The live feed also carries NO2, CO, NH3, OZONE and SO2.
    const stations = groupStations([
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'NH3',   avg_value: '12' },
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'OZONE', avg_value: '30' },
    ])
    expect(stations).toHaveLength(0)
  })

  it('survives a shape it does not recognise', () => {
    // The realistic failure: data.gov.in renames a column. Returning [] makes
    // that show up as "no station data", which is true, rather than throwing
    // inside a module and taking the whole envelope down.
    expect(groupStations(null)).toEqual([])
    expect(groupStations(undefined)).toEqual([])
    expect(groupStations([{ totally: 'different' }])).toEqual([])
    expect(groupStations('not an array')).toEqual([])
  })
})

describe('nearestStation', () => {
  const ORIGINAL_KEY = env.dataGovApiKey

  const feed = (records) => vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ records }),
  })

  beforeEach(() => { env.dataGovApiKey = 'test-key' })
  afterEach(() => { env.dataGovApiKey = ORIGINAL_KEY })

  it('returns null with no API key, which is a supported state', async () => {
    // Not a misconfiguration. `cpcb_station` stays absent and confidence
    // reflects that honestly — the documented design, not a degraded one.
    env.dataGovApiKey = null
    expect(await nearestStation(13.0, 80.2, { fetchImpl: feed(RECORDS) })).toBeNull()
    env.dataGovApiKey = 'test-key'
  })

  it('picks the closest station', async () => {
    // Just off the real Alandur station's real coordinates.
    const s = await nearestStation(12.9995, 80.1935, { fetchImpl: feed(RECORDS) })
    expect(s.name).toMatch(/Alandur/)
    expect(s.distanceM).toBeLessThan(200)
    expect(s.pm25).toBe(48)
  })

  it('still returns a station tens of km away, rather than nothing', async () => {
    // CPCB has 488 stations nationally, so for most listings the nearest is
    // kilometres off. Refusing those left the majority of real listings with no
    // reading at all — the wrong shape of honesty, since the distance is known
    // exactly and can grade the claim instead of gating it.
    const s = await nearestStation(13.15, 80.30, { fetchImpl: feed(RECORDS) })
    expect(s).not.toBeNull()
    expect(s.distanceM).toBeGreaterThan(15_000)
  })

  it('refuses a station in an entirely different airshed', async () => {
    // The outer bound is an identity threshold, not a quality one: Chennai's
    // air says nothing about Mumbai.
    const s = await nearestStation(19.0760, 72.8777, { fetchImpl: feed(RECORDS) })
    expect(s).toBeNull()
  })
})

describe('stationConfidenceFactor', () => {
  it('says nothing when the monitor is genuinely nearby', () => {
    expect(stationConfidenceFactor({ distanceM: 1_200, name: 'X' })).toBeNull()
  })

  it('reduces for a same-city reading, and says so in words', () => {
    const f = stationConfidenceFactor({ distanceM: 9_000, name: 'Alandur' })
    expect(f.multiplier).toBe(0.85)
    expect(f.reason).toMatch(/your part of the city rather than your street/i)
    expect(f.reason).toMatch(/Alandur/)
  })

  it('reduces harder for a regional reading', () => {
    const f = stationConfidenceFactor({ distanceM: 40_000, name: 'Alandur' })
    expect(f.multiplier).toBe(0.6)
    expect(f.reason).toMatch(/regional reading, not a local one/i)
  })

  it('floors rather than collapsing — a distant measurement still beats a model', () => {
    // The alternative is not certainty, it is Open-Meteo's reanalysis. Driving
    // a real reading below that would be the wrong trade.
    expect(stationConfidenceFactor({ distanceM: 59_000, name: 'X' }).multiplier).toBe(0.6)
  })

  it('says nothing when there is no station', () => {
    expect(stationConfidenceFactor(null)).toBeNull()
    expect(stationConfidenceFactor({ name: 'X' })).toBeNull()
  })
})

describe('nearestStation — failure handling', () => {
  const ORIGINAL_KEY = env.dataGovApiKey
  const feed = (records) => vi.fn().mockResolvedValue({
    ok: true, status: 200, json: async () => ({ records }),
  })

  beforeEach(() => { env.dataGovApiKey = 'test-key' })
  afterEach(() => { env.dataGovApiKey = ORIGINAL_KEY })

  it('returns null rather than throwing when the API fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    await expect(nearestStation(13.0, 80.2, { fetchImpl })).resolves.toBeNull()
  })

  it('returns null when a 200 response parses to zero stations', async () => {
    // The schema-drift case. An empty list must not be cached and served as
    // "no stations in India" for an hour.
    await expect(nearestStation(13.0, 80.2, { fetchImpl: feed([{ x: 1 }]) })).resolves.toBeNull()
  })

  it('ignores nonsense coordinates from the caller', async () => {
    expect(await nearestStation(undefined, 80.2, { fetchImpl: feed(RECORDS) })).toBeNull()
    expect(await nearestStation(13.0, null, { fetchImpl: feed(RECORDS) })).toBeNull()
  })
})
