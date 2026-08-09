// Admin sign-in, and the reason a correct password could be refused.
//
// `adminLogin` gives the SAME "Invalid credentials" for an unknown email as for
// a wrong password — correct, and it means the endpoint can never tell an
// operator which of the two went wrong. So anything that makes a valid account
// unfindable is indistinguishable from a typo in the password, and stays that
// way until somebody reads the query.
//
// That is what happened: user login has normalised its email since it was
// written (`trim().toLowerCase()`), admin login used `findUnique` on the raw
// string, and a keyboard that capitalises the first letter of an email field is
// the default on every phone.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { prismaMock } from './mocks/prisma.js'
import { adminLogin } from '../src/features/admin/admin.service.js'

const PASSWORD = 'correct horse battery'
let hash

beforeEach(async () => {
  vi.clearAllMocks()
  process.env.ADMIN_JWT_SECRET = 'test-admin-secret-at-least-32-characters-long'
  hash = await bcrypt.hash(PASSWORD, 4) // cheap rounds: this is not a cost test
  prismaMock.admin.findFirst.mockResolvedValue({
    id: 'a1', email: 'ops@stayonmap.com', name: 'Ops', passwordHash: hash,
  })
})

describe('finding the account', () => {
  it('signs in with the exact address', async () => {
    const res = await adminLogin('ops@stayonmap.com', PASSWORD)
    expect(res.admin.email).toBe('ops@stayonmap.com')
    expect(res.token).toBeTruthy()
  })

  it('matches case-insensitively', async () => {
    // What a phone keyboard produces unprompted.
    await expect(adminLogin('Ops@StayOnMap.com', PASSWORD)).resolves.toBeTruthy()
    expect(prismaMock.admin.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'Ops@StayOnMap.com', mode: 'insensitive' } },
    })
  })

  it('ignores whitespace around a pasted address', async () => {
    await expect(adminLogin('  ops@stayonmap.com  ', PASSWORD)).resolves.toBeTruthy()
    expect(prismaMock.admin.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'ops@stayonmap.com', mode: 'insensitive' } },
    })
  })

  it('does not use findUnique, which cannot express either of the above', async () => {
    await adminLogin('ops@stayonmap.com', PASSWORD)
    expect(prismaMock.admin.findUnique).not.toHaveBeenCalled()
  })
})

describe('what it still refuses', () => {
  it('rejects a wrong password', async () => {
    await expect(adminLogin('ops@stayonmap.com', 'not the password'))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects an unknown account with the identical error', async () => {
    // Same message on purpose: distinguishing them turns this into a "which
    // addresses are admins" oracle on a public endpoint.
    prismaMock.admin.findFirst.mockResolvedValue(null)
    const unknown = await adminLogin('nobody@example.com', PASSWORD).catch((e) => e)
    const wrongPw = await adminLogin('ops@stayonmap.com', 'nope').catch((e) => e)
    expect(unknown.message).toBe(wrongPw.message)
  })

  it('never returns the password hash', async () => {
    const res = await adminLogin('ops@stayonmap.com', PASSWORD)
    expect(JSON.stringify(res)).not.toContain(hash)
  })
})

// ── The AI gate, which decides whether a button may exist ──────────────────
describe('scans are offered only where they can run', () => {
  it('rides an aiEnabled flag along with the admin property payload', async () => {
    // `scoreFraud` and `detectFakeReview` both short-circuit to an empty result
    // unless AI_PROVIDER is anthropic — which production is not. The panel reads
    // this flag to decide whether to draw "Run AI fraud scan", the same rule
    // that hides the SMS sign-in button where no provider is configured.
    // Without it the panel offers a scan that can only ever answer "score 0".
    const { getAdminPropertyById } = await import('../src/features/admin/admin.service.js')
    prismaMock.property.findUnique.mockResolvedValue({
      id: 'p1', title: 'A flat', lat: 13.08, lng: 80.27, type: 'APARTMENT', images: [],
    })

    const property = await getAdminPropertyById('p1')
    expect(property).toHaveProperty('aiEnabled')
    expect(property.aiEnabled).toBe(false) // the mocked default = production
  })
})
