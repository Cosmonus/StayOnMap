/**
 * Admin filter unification — 2026-07-17
 *
 * The admin property map/table used to hand-roll its own filter handling
 * (city/type/bhk/status only, no validation, raw req.query into Prisma) while
 * the public map ran on features/properties/filters.registry.js's ~40 filters.
 * Both now generate from that one registry; admin gets ADMIN_FILTERS, which
 * adds status + riskLevel on top.
 *
 * The load-bearing property these tests guard: `status` is admin-only. The
 * public read path pins listings to ACTIVE, so a user-settable status would be
 * how a DRAFT/SUSPENDED listing leaks out of the public map.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pinsQuerySchema, listQuerySchema } from '../src/features/properties/properties.validation.js'
import { adminPinsQuerySchema, adminPropertiesQuerySchema } from '../src/features/admin/admin.validation.js'
import { FILTERS, ADMIN_FILTERS, buildFilterWhere, filterQueryShape, PROPERTY_STATUSES } from '../src/features/properties/filters.registry.js'

const bounds = { swLat: '12.8', swLng: '77.4', neLat: '13.1', neLng: '77.8' }
const whereOf = (query, registry) => JSON.stringify(buildFilterWhere(query, registry))

describe('status is admin-only', () => {
  it('is absent from the public registry entirely', () => {
    expect('status' in FILTERS).toBe(false)
    expect('riskLevel' in FILTERS).toBe(false)
  })

  it('is present in the admin registry', () => {
    expect('status' in ADMIN_FILTERS).toBe(true)
    expect('riskLevel' in ADMIN_FILTERS).toBe(true)
  })

  it('is stripped from a public /pins query that tries to send it', () => {
    const parsed = pinsQuerySchema.safeParse({ ...bounds, status: 'DRAFT' })
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('status')
    expect(whereOf(parsed.data, FILTERS)).not.toContain('status')
  })

  it('is stripped from a public list query too', () => {
    const parsed = listQuerySchema.safeParse({ status: 'SUSPENDED', page: '1' })
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('status')
  })

  it('cannot leak in even if a status value reaches buildFilterWhere with the public registry', () => {
    // Defence in depth: the where-builder iterates the registry, not the query,
    // so an unknown key is inert regardless of how it got there.
    expect(whereOf({ status: 'DRAFT', rentMax: 1000 }, FILTERS)).toBe('[{"rent":{"lte":1000}}]')
  })

  it('does not appear in the public query shape', () => {
    expect(Object.keys(filterQueryShape())).not.toContain('status')
    expect(Object.keys(filterQueryShape(ADMIN_FILTERS))).toContain('status')
  })
})

describe('adminPinsQuerySchema', () => {
  it('accepts the full user filter set plus admin-only filters', () => {
    const parsed = adminPinsQuerySchema.safeParse({
      ...bounds,
      status: 'PENDING,DRAFT',
      riskLevel: 'HIGH',
      type: 'APARTMENT,VILLA',
      rentMax: '45000',
      bhk: '0,2',
      amenities: 'Lift,Parking',
      verifiedOnly: 'true',
      city: 'Bengaluru',
    })
    expect(parsed.success).toBe(true)
    const where = buildFilterWhere(parsed.data, ADMIN_FILTERS)
    expect(where).toContainEqual({ status: { in: ['PENDING', 'DRAFT'] } })
    expect(where).toContainEqual({ riskScore: { is: { level: { in: ['HIGH'] } } } })
    expect(where).toContainEqual({ rent: { lte: 45000 } })
  })

  it('supports Studio (bhk 0), which the old admin BHK list omitted', () => {
    const parsed = adminPinsQuerySchema.safeParse({ ...bounds, bhk: '0' })
    expect(parsed.success).toBe(true)
    expect(buildFilterWhere(parsed.data, ADMIN_FILTERS)).toContainEqual({ bhk: { in: [0] } })
  })

  it('rejects a bogus status instead of passing it to Prisma', () => {
    // The old getAdminPins did `where.status = status` with no validation.
    expect(adminPinsQuerySchema.safeParse({ ...bounds, status: 'NONSENSE' }).success).toBe(false)
  })

  it('rejects a bogus riskLevel', () => {
    expect(adminPinsQuerySchema.safeParse({ ...bounds, riskLevel: 'VERY_BAD' }).success).toBe(false)
  })

  it('allows omitted bounds — the admin map fetches before its first idle event', () => {
    const parsed = adminPinsQuerySchema.safeParse({ status: 'PENDING' })
    expect(parsed.success).toBe(true)
    expect(parsed.data.swLat).toBeUndefined()
  })

  it('clamps an out-of-India viewport rather than rejecting it', () => {
    const parsed = adminPinsQuerySchema.safeParse({ swLat: '-90', swLng: '0', neLat: '90', neLng: '180' })
    expect(parsed.success).toBe(true)
    expect(parsed.data.swLat).toBe(6)
    expect(parsed.data.neLng).toBe(98)
  })

  it('produces no fragments for an empty query, so admin sees every status', () => {
    const parsed = adminPinsQuerySchema.safeParse(bounds)
    expect(buildFilterWhere(parsed.data, ADMIN_FILTERS)).toEqual([])
  })
})

describe('adminPropertiesQuerySchema', () => {
  it('parses a single status string into a CSV array', () => {
    // ReviewListingsSection sends one value, not a list.
    const parsed = adminPropertiesQuerySchema.safeParse({ status: 'PENDING', limit: '50' })
    expect(parsed.success).toBe(true)
    expect(parsed.data.status).toEqual(['PENDING'])
    expect(parsed.data.limit).toBe(50)
  })

  it('honours riskLevel, which listAdminProperties previously discarded', () => {
    const parsed = adminPropertiesQuerySchema.safeParse({ riskLevel: 'SUSPICIOUS' })
    expect(parsed.success).toBe(true)
    expect(buildFilterWhere(parsed.data, ADMIN_FILTERS))
      .toContainEqual({ riskScore: { is: { level: { in: ['SUSPICIOUS'] } } } })
  })

  it('clamps limit to 100 — these two endpoints bypassed the clamp their siblings used', () => {
    expect(adminPropertiesQuerySchema.safeParse({ limit: '999999' }).success).toBe(false)
    expect(adminPropertiesQuerySchema.safeParse({ limit: '100' }).data.limit).toBe(100)
  })

  it('defaults page/limit when absent', () => {
    const parsed = adminPropertiesQuerySchema.safeParse({})
    expect(parsed.data).toMatchObject({ page: 1, limit: 20 })
  })
})

describe('registry parameterisation keeps the user path unchanged', () => {
  it('defaults to FILTERS when no registry is passed', () => {
    expect(whereOf({ rentMax: 500 })).toBe(whereOf({ rentMax: 500 }, FILTERS))
  })

  it('ADMIN_FILTERS is a strict superset of FILTERS', () => {
    for (const id of Object.keys(FILTERS)) expect(ADMIN_FILTERS[id]).toBe(FILTERS[id])
    expect(Object.keys(ADMIN_FILTERS).length).toBe(Object.keys(FILTERS).length + 2)
  })
})

// ── Every status is filterable ───────────────────────────────────────────────
//
// Added 2026-08-10, after OCCUPIED was found missing from PROPERTY_STATUSES and
// from the panel's own STATUS_OPTIONS. The enum and the data both supported it;
// the filter simply could not select it — so the one state a marketplace most
// wants to count, the listings that actually found a tenant, was invisible from
// the admin panel.
//
// It is the quiet kind of gap: the chip row still looks complete, and every
// chip in it works. Nothing is broken, something is just absent.
describe('the admin status filter covers the whole enum', () => {
  const schemaStatuses = () => {
    const src = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
    const block = /enum PropertyStatus \{([^}]*)\}/.exec(src)[1]
    return block.split('\n').map((l) => l.trim()).filter((l) => /^[A-Z_]+$/.test(l)).sort()
  }

  it('accepts every value PropertyStatus defines', () => {
    expect(schemaStatuses().length).toBeGreaterThan(5)
    expect([...PROPERTY_STATUSES].sort()).toEqual(schemaStatuses())
  })

  it('is offered by the admin panel too — a filter nothing can select is not a filter', () => {
    const src = readFileSync(new URL('../../frontend/src/config/adminFilters.js', import.meta.url), 'utf8')
    const block = src.split('export const STATUS_OPTIONS = [')[1].split(']')[0]
    const offered = [...block.matchAll(/value:\s*'([A-Z_]+)'/g)].map((m) => m[1]).sort()
    expect(offered).toEqual(schemaStatuses())
  })
})
