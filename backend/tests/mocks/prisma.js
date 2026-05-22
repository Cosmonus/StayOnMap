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
  $transaction: vi.fn((callback) => {
    // Populate txMock lazily so it mirrors prismaMock at call time
    Object.assign(txMock, prismaMock)
    return callback(txMock)
  }),
}
