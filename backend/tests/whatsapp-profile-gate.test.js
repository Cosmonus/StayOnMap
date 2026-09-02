// The profile hold's release: a WhatsApp listing held on an incomplete
// profile goes to the admin queue the moment the profile is complete —
// from a profile edit, the emailed sign-in code, or the verification link.
// onProfileCompleted re-checks the gate itself, so a call on an incomplete
// profile is a no-op and never a way to skip the rule.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const sent = []
vi.mock('../src/features/whatsapp/client.js', () => ({
  sendText: vi.fn(async (to, body, o) => { sent.push({ to, body, o }); return 'id' }),
  sendTemplate: vi.fn(async () => 'id'),
  whatsappConfigured: () => true,
}))
const publishProperty = vi.fn()
vi.mock('../src/features/properties/properties.service.js', () => ({ publishProperty: (...a) => publishProperty(...a) }))
vi.mock('../src/features/whatsapp/analytics.js', () => ({ track: vi.fn() }))
vi.mock('../src/features/whatsapp/loginLink.service.js', () => ({ createLoginLink: vi.fn(async () => 'https://x/wa/login?token=t') }))

const { onProfileCompleted } = await import('../src/features/whatsapp/listingEvents.js')

const COMPLETE = { id: 'u1', name: 'Asha', phone: '9876543210', city: 'Chennai', isVerified: true, isBlocked: false }
const HELD = { id: 'c1', phone: '919876543210', propertyId: 'p1', propertyType: 'apartment', draft: { fields: {} } }

beforeEach(() => {
  sent.length = 0
  publishProperty.mockReset().mockImplementation(async (id) => ({ id, status: 'PENDING' }))
  prismaMock.user.findUnique.mockReset().mockResolvedValue({ ...COMPLETE })
  prismaMock.whatsAppConversation.findMany.mockReset().mockResolvedValue([{ ...HELD }])
  prismaMock.whatsAppConversation.update.mockReset().mockImplementation(async ({ data }) => data)
  prismaMock.property.findUnique.mockReset().mockResolvedValue({ status: 'DRAFT', ownerId: 'u1' })
})

describe('onProfileCompleted', () => {
  it('a complete profile releases the held DRAFT: published, re-labelled VERIFICATION, and the owner is told', async () => {
    const released = await onProfileCompleted('u1')
    expect(released).toEqual(['p1'])
    expect(publishProperty).toHaveBeenCalledWith('p1', 'u1')
    expect(prismaMock.whatsAppConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', status: 'AWAITING_PROFILE', propertyId: { not: null } },
    }))
    expect(prismaMock.whatsAppConversation.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'c1' }, data: expect.objectContaining({ status: 'VERIFICATION' }),
    }))
    expect(sent[0].body).toMatch(/sent to our team for verification/)
  })

  it('an incomplete profile releases nothing — the gate is re-checked here, not trusted from the caller', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...COMPLETE, isVerified: false })
    expect(await onProfileCompleted('u1')).toEqual([])
    expect(prismaMock.whatsAppConversation.findMany).not.toHaveBeenCalled()
    expect(publishProperty).not.toHaveBeenCalled()
  })

  it('nothing held is a quiet no-op', async () => {
    prismaMock.whatsAppConversation.findMany.mockResolvedValue([])
    expect(await onProfileCompleted('u1')).toEqual([])
    expect(publishProperty).not.toHaveBeenCalled()
    expect(sent).toHaveLength(0)
  })

  it('a listing already moved on the website is only re-labelled: ACTIVE completes, PENDING is not re-published', async () => {
    prismaMock.property.findUnique.mockResolvedValueOnce({ status: 'ACTIVE', ownerId: 'u1' })
    await onProfileCompleted('u1')
    expect(publishProperty).not.toHaveBeenCalled()
    expect(prismaMock.whatsAppConversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }))

    prismaMock.whatsAppConversation.update.mockClear()
    prismaMock.property.findUnique.mockResolvedValueOnce({ status: 'PENDING', ownerId: 'u1' })
    await onProfileCompleted('u1')
    expect(publishProperty).not.toHaveBeenCalled()
    expect(prismaMock.whatsAppConversation.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'VERIFICATION' }) }))
  })

  it('a property that is gone, or somebody else\'s, is skipped — never published for the wrong owner', async () => {
    prismaMock.property.findUnique.mockResolvedValue({ status: 'DRAFT', ownerId: 'somebody-else' })
    expect(await onProfileCompleted('u1')).toEqual([])
    expect(publishProperty).not.toHaveBeenCalled()
  })

  it('a blocked account releases nothing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...COMPLETE, isBlocked: true })
    expect(await onProfileCompleted('u1')).toEqual([])
  })
})
