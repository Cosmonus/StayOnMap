// CPCB ground-station air quality.
//
// This is the only source in the environment module that is an instrument
// reading real air rather than a model reconstructing it, which makes it the
// only fact there allowed to claim MEASURED. That privilege is exactly why the
// parser has to be paranoid: a field-name guess that silently produced a
// plausible number would put an invented value on a card wearing the strongest
// provenance label the system has.
//
// ⚠ The schema these tests encode is from published documentation, NOT from a
// live response — there is no data.gov.in key in this environment. The tests
// therefore prove the parser's BEHAVIOUR (tolerant, null on anything odd), not
// that the field names are right. Verify those against a real response.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { groupStations, nearestStation } from '../src/features/spatial/cpcbProvider.js'
import { env } from '../src/config/env.js'

// Two pollutants at one station, the feed's real one-row-per-pollutant shape.
const RECORDS = [
  { station: 'Alandur Bus Depot, Chennai', city: 'Chennai', latitude: '13.0067', longitude: '80.1000', pollutant_id: 'PM2.5', pollutant_avg: '54', last_update: '20-07-2026 09:00:00' },
  { station: 'Alandur Bus Depot, Chennai', city: 'Chennai', latitude: '13.0067', longitude: '80.1000', pollutant_id: 'PM10',  pollutant_avg: '98', last_update: '20-07-2026 09:00:00' },
  { station: 'Manali, Chennai',            city: 'Chennai', latitude: '13.1667', longitude: '80.2600', pollutant_id: 'PM2.5', pollutant_avg: '71', last_update: '20-07-2026 09:00:00' },
]

describe('groupStations', () => {
  it('collapses one-row-per-pollutant into one row per station', () => {
    const stations = groupStations(RECORDS)
    expect(stations).toHaveLength(2)

    const alandur = stations.find((s) => s.name.startsWith('Alandur'))
    expect(alandur.pm25).toBe(54)
    expect(alandur.pm10).toBe(98)
  })

  it('drops records with no usable coordinates rather than defaulting them', () => {
    // A station defaulted to 0,0 is in the Gulf of Guinea and would be "nearest"
    // to nothing — but a subtler default would silently attach one city's air to
    // another's listings.
    const stations = groupStations([
      { station: 'Nowhere', pollutant_id: 'PM2.5', pollutant_avg: '40' },
      { station: 'Bad', latitude: 'NA', longitude: 'NA', pollutant_id: 'PM2.5', pollutant_avg: '40' },
    ])
    expect(stations).toHaveLength(0)
  })

  it("treats 'NA' as no reading, not as zero", () => {
    // Zero µg/m³ is not merely wrong, it is the best possible air quality —
    // the most flattering direction an error could go.
    const stations = groupStations([
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'PM2.5', pollutant_avg: 'NA' },
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'PM10',  pollutant_avg: '60' },
    ])
    expect(stations[0].pm25).toBeNull()
    expect(stations[0].pm10).toBe(60)
  })

  it('drops a station with neither particulate reading', () => {
    const stations = groupStations([
      { station: 'S', latitude: '13', longitude: '80', pollutant_id: 'NH3', pollutant_avg: '12' },
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
    const s = await nearestStation(13.0067, 80.1001, { fetchImpl: feed(RECORDS) })
    expect(s.name).toMatch(/Alandur/)
    expect(s.distanceM).toBeLessThan(100)
  })

  it('refuses a station too far away to be describing your air', async () => {
    // CPCB stations are sparse. Past ~10 km the honest answer is "no station
    // near you", not a number with a caveat attached.
    const s = await nearestStation(19.0760, 72.8777, { fetchImpl: feed(RECORDS) }) // Mumbai
    expect(s).toBeNull()
  })

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
