import { vi } from 'vitest'

// A transaction mock that executes the callback with the same mock client (tx === prismaMock)
const txMock = {}

export const prismaMock = {
  property: {
    // Defaults to "no inventory", which is a fresh database's real state.
    // listLocalities() reads this now (it grouped by (city, landmark) in SQL
    // until the Locality entity shipped 2026-08-07 — the grouping key is now
    // "resolved locality, else owner text", which SQL cannot express cleanly).
    findMany:  vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
    count:      vi.fn(),
    groupBy:    vi.fn().mockResolvedValue([]),
    create:     vi.fn(),
    update:     vi.fn(),
    delete:     vi.fn(),
  },
  propertyAmenity: {
    deleteMany: vi.fn(),
  },
  propertyImage: {
    // Reused-photo detection reads this; empty = a listing with no photos, which
    // is the path that must return "no signal" rather than throwing.
    findMany:   vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn(),
  },
  // The area a listing is IN, as an entity. Defaults to "nothing resolved yet",
  // which is every pre-2026-08-07 listing and the state readers fall back from.
  locality: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany:   vi.fn().mockResolvedValue([]),
    create:     vi.fn(),
    update:     vi.fn(),
  },
  localityAlias: {
    findUnique: vi.fn().mockResolvedValue(null),
    create:     vi.fn(),
  },
  // Aggregate search demand. No personal data in it by construction — see
  // features/analytics/demand.service.js.
  searchDemand: {
    upsert:     vi.fn().mockResolvedValue({}),
    groupBy:    vi.fn().mockResolvedValue([]),
    aggregate:  vi.fn().mockResolvedValue({ _sum: { searches: 0, zeroResults: 0 } }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  // Perceptual hashes of uploaded photos. Empty = nothing fingerprinted, which
  // is a fresh install and must read as "no evidence", never as "no match".
  imageFingerprint: {
    findMany: vi.fn().mockResolvedValue([]),
    upsert:   vi.fn().mockResolvedValue({}),
  },
  // The SIMILAR_TO edge. Empty = nothing computed yet, which is every listing
  // before the first refresh and the state the read path must render as "no
  // similar homes" rather than as an error.
  propertySimilarity: {
    findMany:   vi.fn().mockResolvedValue([]),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  // Ranking weights. Null = no stored profile, which is the intended state:
  // code owns the defaults, so an empty table ranks exactly like production.
  rankingWeights: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert:     vi.fn(),
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
    // Same reasoning as conversation.findFirst above.
    findFirst:  vi.fn().mockResolvedValue(null),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    count:      vi.fn().mockResolvedValue(0),
  },
  // Host dashboard surfaces (features/host/host.service.js) + admin moderation
  communityReview: {
    findMany: vi.fn(),
    count:    vi.fn(),
    update:   vi.fn(),
  },
  activityLog: {
    create: vi.fn().mockResolvedValue({}),
  },
  moderationAction: {
    create: vi.fn().mockResolvedValue({}),
  },
  // ── Support & Trust ──────────────────────────────────────────────────────
  // Defaults are "no cases, empty threads", which is a fresh install and the
  // state every unrelated suite runs in — a report now creates a case as a side
  // effect, so these are reached by tests that are not about support at all.
  supportCase: {
    create:     vi.fn().mockResolvedValue({ id: 'case-1', number: 1 }),
    findUnique: vi.fn().mockResolvedValue(null),
    findMany:   vi.fn().mockResolvedValue([]),
    update:     vi.fn().mockResolvedValue({}),
    count:      vi.fn().mockResolvedValue(0),
    groupBy:    vi.fn().mockResolvedValue([]),
  },
  supportMessage: {
    findMany:   vi.fn().mockResolvedValue([]),
    create:     vi.fn().mockResolvedValue({ id: 'msg-1' }),
    update:     vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    count:      vi.fn().mockResolvedValue(0),
  },
  supportAttachment: {
    create:   vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  supportEvent: {
    create:   vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  knowledgeCategory: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  knowledgeArticle: {
    findMany:   vi.fn().mockResolvedValue([]),
    // findFirst, not findUnique: an article is fetched by slug AND published,
    // so the read cannot be a unique lookup on slug alone.
    findFirst:  vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  savedListing: {
    count: vi.fn(),
  },
  listingDraft: {
    findUnique: vi.fn(),
    findMany:   vi.fn().mockResolvedValue([]),
    upsert:     vi.fn(),
    deleteMany: vi.fn(),
  },
  // Product telemetry. Defaults are "nothing recorded, nothing to read", which
  // is a fresh install's real state and the one every other test runs in —
  // publishing a property now reads listingDraft and may write here.
  analyticsEvent: {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    groupBy:    vi.fn().mockResolvedValue([]),
    findMany:   vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  // Append-only status log — supply measured net. Defaults resolve, because
  // every writer is fire-and-forget and an unmocked reject would surface as an
  // unhandled rejection in whichever suite happened to publish a listing.
  // Platform operators — a separate table and a separate JWT secret from User
  // (see .claude/auth.md). findFirst, not findUnique: admin sign-in matches the
  // address case-insensitively.
  admin: {
    findFirst:  vi.fn().mockResolvedValue(null),
    findUnique: vi.fn(),
    update:     vi.fn(),
    upsert:     vi.fn(),
  },
  propertyStatusEvent: {
    create:     vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    findMany:   vi.fn().mockResolvedValue([]),
    groupBy:    vi.fn().mockResolvedValue([]),
  },
  propertyDailyView: {
    aggregate: vi.fn(),
    groupBy:   vi.fn().mockResolvedValue([]),
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
    // Defaults to null, and that default is the safe one: the report thread
    // scopes the reporter's read by (id, reporterId) through findFirst, so a
    // mock returning something by accident would look like access granted.
    findFirst:  vi.fn().mockResolvedValue(null),
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
    // Null by default, and that default is the safe one: createCaseForUser
    // verifies a related reference belongs to the caller before storing it, so
    // "not yours" is what an unmocked call should look like.
    findFirst:  vi.fn().mockResolvedValue(null),
    findMany:   vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
    count:      vi.fn().mockResolvedValue(0),
    groupBy:    vi.fn().mockResolvedValue([]),
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
  // Raw SQL. Defaults to no rows, which is what an empty database returns —
  // the marketplace metrics read owner reply times and the weekly supply
  // series this way, and an unmocked call would reject rather than come back
  // empty, failing every unrelated suite that touches the admin controller.
  $queryRaw: vi.fn().mockResolvedValue([]),
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
