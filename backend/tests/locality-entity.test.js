/**
 * Locality as an entity — 2026-08-07
 *
 * The load-bearing property: THE MAP DECIDES, NOT THE TYPING. A locality
 * resolves from OSM admin boundaries when they cover the point, and falls back
 * to owner-typed text only when they do not. Get that backwards and an owner
 * typing "Prime Location" invents an area, which is the exact free-text problem
 * the entity exists to end.
 *
 * The second property, equally load-bearing: resolving must never 404 a URL that
 * was already published. "Koramangala 5th Block" becomes an ALIAS of Koramangala
 * rather than disappearing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

vi.mock('../src/features/spatial/boundaryLookup.js', () => ({
  boundariesAt: vi.fn(),
}))

const { boundariesAt } = await import('../src/features/spatial/boundaryLookup.js')
const { resolveLocality, localityBySlug, slugify } = await import('../src/features/localities/resolve.js')

const property = {
  id: 'p1',
  city: 'Bengaluru',
  lat: 12.9352,
  lng: 77.6245,
  landmark: 'Koramangala 5th Block',
}

// Every locality created in a test comes back through findUnique the way the
// database would, so upsertLocality's find-then-create path behaves like the
// real thing rather than creating duplicates.
function trackCreates() {
  const created = []
  prismaMock.locality.create.mockImplementation(({ data }) => {
    const row = { id: `loc${created.length + 1}`, ...data }
    created.push(row)
    return Promise.resolve(row)
  })
  prismaMock.locality.update.mockImplementation(({ where, data }) => {
    const row = created.find((c) => c.id === where.id)
    Object.assign(row, data)
    return Promise.resolve(row)
  })
  return created
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.locality.findUnique.mockResolvedValue(null)
  prismaMock.localityAlias.findUnique.mockResolvedValue(null)
  prismaMock.localityAlias.create.mockResolvedValue({})
})

describe('slugify', () => {
  it('is the same function the URL uses', () => {
    expect(slugify('Anna Nagar')).toBe('anna-nagar')
    expect(slugify('T. Nagar')).toBe('t-nagar')
    expect(slugify('  Koramangala.  ')).toBe('koramangala')
  })
})

describe('resolution order', () => {
  it('prefers the ward the map reports over what the owner typed', async () => {
    boundariesAt.mockResolvedValue([
      { osmId: 'r1', name: 'Koramangala', adminLevel: 10, label: 'Ward' },
      { osmId: 'r2', name: 'Bengaluru', adminLevel: 8, label: 'Municipality' },
    ])
    const created = trackCreates()

    await resolveLocality(property)

    expect(created).toHaveLength(1)
    expect(created[0].name).toBe('Koramangala')
    expect(created[0].source).toBe('BOUNDARY')
    expect(created[0].adminLevel).toBe(10)
  })

  it('takes the MOST specific level, not the first one returned', async () => {
    // Deliberately unsorted — the caller must not depend on lookup ordering.
    boundariesAt.mockResolvedValue([
      { osmId: 'r2', name: 'Bengaluru', adminLevel: 8 },
      { osmId: 'r1', name: 'Koramangala', adminLevel: 10 },
    ])
    const created = trackCreates()

    await resolveLocality(property)
    expect(created[0].name).toBe('Koramangala')
  })

  it('never resolves to a district or larger — one locality per city is worse than none', async () => {
    boundariesAt.mockResolvedValue([
      { osmId: 'r9', name: 'Bengaluru Urban', adminLevel: 6 },
      { osmId: 'r8', name: 'Karnataka', adminLevel: 4 },
    ])
    const created = trackCreates()

    await resolveLocality(property)

    // Falls through to the landmark rather than accepting the district.
    expect(created[0].source).toBe('LANDMARK')
    expect(created[0].name).toBe('Koramangala 5th Block')
  })

  it('falls back to the owner text when no boundary covers the point', async () => {
    boundariesAt.mockResolvedValue([])
    const created = trackCreates()

    await resolveLocality(property)
    expect(created[0].source).toBe('LANDMARK')
  })

  it('falls back the same way when the lookup could not run at all', async () => {
    // null is "we could not look" — a distinct state from [] in boundaryLookup,
    // and the caller must degrade identically rather than throwing.
    boundariesAt.mockResolvedValue(null)
    const created = trackCreates()

    await resolveLocality(property)
    expect(created[0].source).toBe('LANDMARK')
  })

  it('resolves to nothing when there is neither a boundary nor usable text', async () => {
    boundariesAt.mockResolvedValue([])
    trackCreates()

    const id = await resolveLocality({ ...property, landmark: '   ' })
    expect(id).toBeNull()
    expect(prismaMock.locality.create).not.toHaveBeenCalled()
  })

  it('never throws — it runs fire-and-forget on the property write path', async () => {
    boundariesAt.mockRejectedValue(new Error('boundary table missing'))
    await expect(resolveLocality(property)).resolves.toBeNull()
  })
})

describe('the owner text becomes an alias, not the identity', () => {
  it('records what the owner called it', async () => {
    boundariesAt.mockResolvedValue([{ osmId: 'r1', name: 'Koramangala', adminLevel: 10 }])
    trackCreates()

    await resolveLocality(property)

    expect(prismaMock.localityAlias.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        text: 'Koramangala 5th Block',
        slug: 'koramangala-5th-block',
        citySlug: 'bengaluru',
      }),
    })
  })

  it('does not record an alias identical to the canonical slug', async () => {
    boundariesAt.mockResolvedValue([{ osmId: 'r1', name: 'Koramangala', adminLevel: 10 }])
    trackCreates()

    await resolveLocality({ ...property, landmark: 'Koramangala' })
    expect(prismaMock.localityAlias.create).not.toHaveBeenCalled()
  })

  it('survives a duplicate alias without failing the resolve', async () => {
    boundariesAt.mockResolvedValue([{ osmId: 'r1', name: 'Koramangala', adminLevel: 10 }])
    trackCreates()
    prismaMock.localityAlias.create.mockRejectedValue(new Error('unique violation'))

    await expect(resolveLocality(property)).resolves.toBe('loc1')
  })
})

describe('a landmark locality is upgraded, not duplicated, once the map can confirm it', () => {
  it('promotes LANDMARK to BOUNDARY in place, keeping the id', async () => {
    const existing = {
      id: 'loc-existing', citySlug: 'bengaluru', slug: 'koramangala',
      name: 'Koramangala', source: 'LANDMARK', osmId: null, adminLevel: null,
    }
    // No row for the osmId yet, but the slug is already taken by the
    // landmark-derived row.
    prismaMock.locality.findUnique.mockImplementation(({ where }) =>
      Promise.resolve(where.osmId ? null : existing))
    prismaMock.locality.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...existing, ...data }))

    boundariesAt.mockResolvedValue([{ osmId: 'r1', name: 'Koramangala', adminLevel: 10 }])

    const id = await resolveLocality({ ...property, landmark: 'Koramangala' })

    // Same id — every listing already pointing at it survives the upgrade.
    expect(id).toBe('loc-existing')
    expect(prismaMock.locality.create).not.toHaveBeenCalled()
    expect(prismaMock.locality.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ source: 'BOUNDARY', osmId: 'r1', adminLevel: 10 }),
    }))
  })

  it('never downgrades a BOUNDARY locality because one listing fell outside the polygons', async () => {
    const existing = {
      id: 'loc-existing', citySlug: 'bengaluru', slug: 'koramangala',
      name: 'Koramangala', source: 'BOUNDARY', osmId: 'r1', adminLevel: 10,
    }
    prismaMock.locality.findUnique.mockResolvedValue(existing)
    boundariesAt.mockResolvedValue([])

    const id = await resolveLocality({ ...property, landmark: 'Koramangala' })

    expect(id).toBe('loc-existing')
    expect(prismaMock.locality.update).not.toHaveBeenCalled()
  })
})

describe('localityBySlug — a published URL must not start 404ing', () => {
  it('resolves the canonical slug directly', async () => {
    const row = { id: 'loc1', slug: 'koramangala' }
    prismaMock.locality.findUnique.mockResolvedValue(row)

    await expect(localityBySlug('bengaluru', 'koramangala')).resolves.toBe(row)
  })

  it('resolves an alias slug to the canonical locality', async () => {
    prismaMock.locality.findUnique.mockResolvedValue(null)
    prismaMock.localityAlias.findUnique.mockResolvedValue({
      locality: { id: 'loc1', slug: 'koramangala' },
    })

    const found = await localityBySlug('bengaluru', 'koramangala-5th-block')
    expect(found.id).toBe('loc1')
  })

  it('prefers a real locality over another locality\'s alias for the same slug', async () => {
    prismaMock.locality.findUnique.mockResolvedValue({ id: 'the-real-one' })
    prismaMock.localityAlias.findUnique.mockResolvedValue({ locality: { id: 'the-alias-owner' } })

    const found = await localityBySlug('chennai', 'anna-nagar')
    expect(found.id).toBe('the-real-one')
    // Publishing a new area must never silently steal an existing page's URL.
    expect(prismaMock.localityAlias.findUnique).not.toHaveBeenCalled()
  })

  it('returns null for a slug nobody owns', async () => {
    await expect(localityBySlug('chennai', 'nowhere')).resolves.toBeNull()
  })
})
