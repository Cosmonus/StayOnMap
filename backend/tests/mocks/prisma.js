import { vi } from 'vitest'

// A transaction mock that executes the callback with the same mock client (tx === prismaMock)
const txMock = {}

export const prismaMock = {
  property: {
    findMany:  vi.fn(),
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    count:      vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
  propertyAmenity: {
    deleteMany: vi.fn(),
  },
  propertyImage: {
    deleteMany: vi.fn(),
  },
  amenity: {
    findMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    // Defaults to null: the only current caller is phone.service.js asking
    // "is this number already verified on another account", and undefined
    // there would read as a claim rather than the absence of one.
    findFirst:  vi.fn().mockResolvedValue(null),
    update:     vi.fn(),
    updateMany: vi.fn(),
    create:     vi.fn(),
  },
  appointment: {
    findUnique:   vi.fn(),
    findFirst:    vi.fn(),
    findMany:     vi.fn(),
    create:       vi.fn(),
    update:       vi.fn(),
    updateMany:   vi.fn(),
    count:        vi.fn(),
    groupBy:      vi.fn(),
  },
  availabilityBlock: {
    findFirst: vi.fn(),
    findMany:  vi.fn(),
  },
  lease: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
  // Host dashboard surfaces (features/host/host.service.js)
  communityReview: {
    findMany: vi.fn(),
    count:    vi.fn(),
  },
  savedListing: {
    count: vi.fn(),
  },
  listingDraft: {
    findUnique: vi.fn(),
    upsert:     vi.fn(),
    deleteMany: vi.fn(),
  },
  propertyDailyView: {
    aggregate: vi.fn(),
    upsert:    vi.fn(),
  },
  propertyViewer: {
    findMany: vi.fn(),
    upsert:   vi.fn(),
  },
  waitlistEntry: {
    create: vi.fn(),
  },
  passwordResetToken: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
  emailOtp: {
    create:    vi.fn(),
    findFirst: vi.fn(),
    count:     vi.fn(),
    update:    vi.fn(),
  },
  // Phone verification codes. `user.findFirst` (the "already verified by
  // someone else" check) lives on the shared user mock below and defaults to
  // null there — nobody has claimed the number.
  phoneOtp: {
    create:    vi.fn().mockResolvedValue({}),
    findFirst: vi.fn().mockResolvedValue(null),
    count:     vi.fn().mockResolvedValue(0),
    update:    vi.fn().mockResolvedValue({}),
  },
  // Defaults, not bare vi.fn(): every login path now issues a session as a
  // side effect, and a mock returning undefined where an array is expected
  // would fail tests that aren't about sessions at all.
  authSession: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany:   vi.fn().mockResolvedValue([]),
    create:     vi.fn().mockResolvedValue({}),
    update:     vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  socialAccount: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany:   vi.fn().mockResolvedValue([]),
    count:      vi.fn().mockResolvedValue(0),
    create:     vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  fraudSignal: {
    createMany: vi.fn(),
  },
  trustScore: {
    upsert: vi.fn(),
  },
  propertyRiskScore: {
    upsert:     vi.fn(),
    findUnique: vi.fn(),
  },
  propertyReport: {
    create:     vi.fn(),
    findMany:   vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
    count:      vi.fn(),
  },
  message: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
    count:      vi.fn(),
  },
  conversation: {
    findUnique: vi.fn(),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
  // User-to-user blocking. The defaults are "nobody has blocked anybody", which
  // is every existing test's world — chat.service now consults these on every
  // send and every list, so an unmocked findFirst would return undefined and
  // read as a block rather than as an absent one.
  userBlock: {
    findFirst:  vi.fn().mockResolvedValue(null),
    findMany:   vi.fn().mockResolvedValue([]),
    upsert:     vi.fn(),
    deleteMany: vi.fn(),
  },
  userReport: {
    create:   vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
  },
  notification: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    updateMany: vi.fn(),
    count:      vi.fn(),
    findMany:   vi.fn(),
  },
  ownerTrustScore: undefined, // not yet in schema — tested services check typeof before calling
  // Spatial intelligence. Defaults leave PoiIndex unseeded (count 0), which is
  // a fresh checkout's real state and the path that must degrade gracefully —
  // individual tests override to exercise the seeded path.
  poiIndex: {
    count:    vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    upsert:   vi.fn(),
    // Per-category city coverage (cityCategoryCoverage). Empty = nothing
    // seeded, matching count 0 above.
    groupBy:  vi.fn().mockResolvedValue([]),
    // poiFreshness — max(fetchedAt) per city. Null = date unknown.
    aggregate: vi.fn().mockResolvedValue({ _max: { fetchedAt: null } }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  // Per-cell proximity summary — derived data the filters join on.
  cellPoiSummary: {
    upsert:   vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  // ETL run receipts. Default is "no report on file", which is both a fresh
  // checkout's real state and the case that must NOT be read as bad coverage —
  // see dataQuality.js's coverageFactor.
  dataQualityReport: {
    create:    vi.fn().mockResolvedValue({}),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany:  vi.fn().mockResolvedValue([]),
  },
  spatialContext: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany:   vi.fn().mockResolvedValue([]),
    upsert:     vi.fn(),
    update:     vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  // Supports both Prisma $transaction forms: array-of-promises (lease.service.js)
  // and callback (properties.service.js) — real Prisma treats them differently,
  // but for mocking purposes both just need to resolve in order.
  $transaction: vi.fn((arg) => {
    if (Array.isArray(arg)) return Promise.all(arg)
    // Populate txMock lazily so it mirrors prismaMock at call time
    Object.assign(txMock, prismaMock)
    return arg(txMock)
  }),
}
