// The held-listing reminder: one plain-text nudge ~20h after the hold, inside
// the 24h window, stamped so it never repeats, and never moving lastMessageAt.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const sent = []
let configured = true
vi.mock('../src/features/whatsapp/client.js', () => ({
  sendText: vi.fn(async (to, body, o) => { sent.push({ to, body, o }); return 'id' }),
  whatsappConfigured: () => configured,
}))
const { runHeldReminderTick, REMIND_AFTER_MS, WINDOW_MS } = await import('../src/features/whatsapp/reminders.js')

const NOW = Date.parse('2026-09-03T10:00:00Z')
const held = (over = {}) => ({ id: 'c1', phone: '919876543210', userId: 'u1', draft: { fields: {}, flags: {} }, ...over })

beforeEach(() => {
  sent.length = 0; configured = true
  prismaMock.whatsAppConversation.findMany.mockReset().mockResolvedValue([held()])
  prismaMock.whatsAppConversation.update.mockReset().mockResolvedValue({})
  prismaMock.user.findUnique.mockReset().mockResolvedValue({ email: 'asha@example.com' })
})

describe('runHeldReminderTick', () => {
  it('asks only for held rows between 20h and 24h old, sends the reminder with the sign-in link, and stamps the flag without touching lastMessageAt', async () => {
    expect(await runHeldReminderTick(NOW)).toBe(1)
    const where = prismaMock.whatsAppConversation.findMany.mock.calls[0][0].where
    expect(where.status).toBe('AWAITING_PROFILE')
    expect(where.lastMessageAt.lt.getTime()).toBe(NOW - REMIND_AFTER_MS)
    expect(where.lastMessageAt.gt.getTime()).toBe(NOW - WINDOW_MS)
    expect(sent[0].body).toMatch(/not yet sent for verification/)
    expect(sent[0].body).toMatch(/asha@example\.com/)
    expect(sent[0].body).toMatch(/\/\?signin=asha%40example\.com/)
    const update = prismaMock.whatsAppConversation.update.mock.calls[0][0]
    expect(update.where).toEqual({ id: 'c1' })
    expect(update.data.draft.flags.heldReminderAt).toBe(new Date(NOW).toISOString())
    expect(update.data.lastMessageAt).toBeUndefined()
  })

  it('a row already reminded is skipped', async () => {
    prismaMock.whatsAppConversation.findMany.mockResolvedValue([held({ draft: { flags: { heldReminderAt: '2026-09-03T05:00:00Z' } } })])
    expect(await runHeldReminderTick(NOW)).toBe(0)
    expect(sent).toHaveLength(0)
    expect(prismaMock.whatsAppConversation.update).not.toHaveBeenCalled()
  })

  it('one failed send does not stop the others', async () => {
    prismaMock.whatsAppConversation.findMany.mockResolvedValue([held({ id: 'c1' }), held({ id: 'c2', phone: '919876543211' })])
    prismaMock.user.findUnique.mockRejectedValueOnce(new Error('db hiccup'))
    expect(await runHeldReminderTick(NOW)).toBe(1)
    expect(sent[0].to).toBe('919876543211')
  })

  it('does nothing when WhatsApp is not configured', async () => {
    configured = false
    expect(await runHeldReminderTick(NOW)).toBe(0)
    expect(prismaMock.whatsAppConversation.findMany).not.toHaveBeenCalled()
  })
})
