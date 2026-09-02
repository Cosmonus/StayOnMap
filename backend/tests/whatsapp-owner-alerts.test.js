// Owner alerts: a renter's visit request or chat message reaches an owner who
// listed over WhatsApp ON WhatsApp. Template when configured, plain text when
// not; a no-op for owners with no WhatsApp conversation; chat debounced per
// thread; never throws into the request that triggered it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'

const sent = []
let configured = true
vi.mock('../src/features/whatsapp/client.js', () => ({
  sendText: vi.fn(async (to, body, o) => { sent.push({ kind: 'text', to, body, o }); return 'id' }),
  sendTemplate: vi.fn(async (to, t, o) => { sent.push({ kind: 'template', to, ...t, o }); return 'id' }),
  whatsappConfigured: () => configured,
}))
vi.mock('../src/features/whatsapp/loginLink.service.js', () => ({ createLoginLink: vi.fn(async (_u, { next }) => `https://x/wa/login?token=t&next=${encodeURIComponent(next)}`) }))
const cache = new Map()
vi.mock('../src/lib/redis.js', () => ({
  redis: null,
  cacheGet: vi.fn(async (k) => cache.get(k) ?? null),
  cacheSet: vi.fn(async (k, v) => { cache.set(k, v) }),
  cacheDel: vi.fn(async () => {}),
}))
const { env } = await import('../src/config/env.js')
const { alertOwner } = await import('../src/features/whatsapp/ownerAlerts.js')

beforeEach(() => {
  sent.length = 0; cache.clear(); configured = true
  env.whatsapp = { ownerAlertTemplate: null, templateLanguage: 'en' }
  prismaMock.whatsAppConversation.findFirst.mockReset().mockResolvedValue({ id: 'c1', phone: '919876543210' })
  prismaMock.property.findUnique.mockReset().mockResolvedValue({ title: '2 BHK in Velachery' })
})

describe('alertOwner', () => {
  it('a visit request reaches the owner as a plain text naming the listing, the slot, and a host-mode sign-in link', async () => {
    const ok = await alertOwner('owner-1', { kind: 'visit', propertyId: 'p1', detail: '5 Sep at 10:00 AM' })
    expect(ok).toBe(true)
    expect(sent[0].kind).toBe('text')
    expect(sent[0].to).toBe('919876543210')
    expect(sent[0].body).toMatch(/New visit request/)
    expect(sent[0].body).toMatch(/2 BHK in Velachery/)
    expect(sent[0].body).toMatch(/5 Sep at 10:00 AM/)
    expect(sent[0].body).toMatch(/tab%3Dappointments%26mode%3Dhost/)
  })

  it('uses the template when one is configured — what happened, the title, the link', async () => {
    env.whatsapp.ownerAlertTemplate = 'stayonmap_owner_alert'
    await alertOwner('owner-1', { kind: 'message', propertyId: 'p1', detail: 'Is it still available?' })
    expect(sent[0].kind).toBe('template')
    expect(sent[0].name).toBe('stayonmap_owner_alert')
    expect(sent[0].params[0]).toMatch(/new message/)
    expect(sent[0].params[1]).toBe('2 BHK in Velachery')
    expect(sent[0].params[2]).toMatch(/tab%3Dmessages%26mode%3Dhost/)
  })

  it('an owner with no WhatsApp conversation is a quiet no-op', async () => {
    prismaMock.whatsAppConversation.findFirst.mockResolvedValue(null)
    expect(await alertOwner('owner-2', { kind: 'visit', propertyId: 'p1' })).toBe(false)
    expect(sent).toHaveLength(0)
  })

  it('chat is debounced per thread: the second message within the hour sends nothing', async () => {
    expect(await alertOwner('owner-1', { kind: 'message', propertyId: 'p1', detail: 'hi', debounceKey: 'message:conv-1' })).toBe(true)
    expect(await alertOwner('owner-1', { kind: 'message', propertyId: 'p1', detail: 'hello?', debounceKey: 'message:conv-1' })).toBe(false)
    expect(await alertOwner('owner-1', { kind: 'message', propertyId: 'p2', detail: 'other thread', debounceKey: 'message:conv-2' })).toBe(true)
    expect(sent).toHaveLength(2)
  })

  it('unconfigured WhatsApp sends nothing, and a thrown error is swallowed', async () => {
    configured = false
    env.nodeEnv = 'test'
    expect(await alertOwner('owner-1', { kind: 'visit', propertyId: 'p1' })).toBe(false)
    configured = true
    prismaMock.whatsAppConversation.findFirst.mockRejectedValue(new Error('db down'))
    expect(await alertOwner('owner-1', { kind: 'visit', propertyId: 'p1' })).toBe(false)
  })
})
