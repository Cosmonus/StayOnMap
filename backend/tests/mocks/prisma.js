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
    update:     vi.fn(),
    create:     vi.fn(),
  },
  appointment: {
    findUnique:   vi.fn(),
    findFirst:    vi.fn(),
    findMany:     vi.fn(),
    create:       vi.fn(),
    update:       vi.fn(),
    updateMany:   vi.fn(),
  },
  lease: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    update:     vi.fn(),
  },
  waitlistEntry: {
    create: vi.fn(),
  },
  passwordResetToken: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
  },
  fraudSignal: {
    createMany: vi.fn(),
  },
  trustScore: {
    upsert: vi.fn(),
  },
  propertyRiskScore: {
    upsert: vi.fn(),
  },
  ownerTrustScore: undefined, // not yet in schema — tested services check typeof before calling
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
