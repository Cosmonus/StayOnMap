// The webhook's two gates and its idempotency.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import express from 'express'
import request from 'supertest'
import { Prisma } from '@prisma/client'
import { prismaMock } from './mocks/prisma.js'

const SECRET = 'app-secret-for-tests'
vi.mock('../src/config/env.js', () => ({
  env: {
    nodeEnv: 'test', frontendUrl: 'https://www.stayonmap.com', jwtSecret: 'x'.repeat(40), jwtExpiresIn: '7d',
    whatsapp: { accessToken: 't', phoneNumberId: 'p', businessAccountId: 'b', verifyToken: 'verify-me', appSecret: SECRET, apiVersion: 'v21.0' },
  },
}))
const handleInbound = vi.fn().mockResolvedValue(undefined)
vi.mock('../src/features/whatsapp/engine.js', () => ({ handleInbound: (...a) => handleInbound(...a) }))

const { verifyChallenge, verifySignature } = await import('../src/features/whatsapp/signature.js')
const { webhookRouter } = await import('../src/features/whatsapp/whatsapp.routes.js')
const { recordInbound } = await import('../src/features/whatsapp/conversation.service.js')

const app = express()
app.use('/api/v1/webhooks/whatsapp', webhookRouter)

const sign = (body) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(Buffer.from(body)).digest('hex')
const inbound = (message, from = '919876543210') => JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ id: 'b', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', contacts: [{ wa_id: from, profile: { name: 'Asha' } }], messages: [{ from, id: 'wamid.1', timestamp: '1', ...message }] } }] }],
})

beforeEach(() => handleInbound.mockClear())

describe('verification handshake', () => {
  it('echoes the challenge only for the right token', () => {
    expect(verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '123' }, 'verify-me')).toBe('123')
    expect(verifyChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '123' }, 'verify-me')).toBeNull()
    expect(verifyChallenge({ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '123' }, 'verify-me')).toBeNull()
    expect(verifyChallenge({}, null)).toBeNull()
  })

  it('GET answers the challenge in plain text, 403 otherwise', async () => {
    const ok = await request(app).get('/api/v1/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': 'abc' })
    expect(ok.status).toBe(200)
    expect(ok.text).toBe('abc')
    expect((await request(app).get('/api/v1/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'no' })).status).toBe(403)
  })
})

describe('signature', () => {
  it('verifies HMAC over the raw bytes and refuses everything else', () => {
    const body = Buffer.from('{"a":1}')
    expect(verifySignature(body, sign('{"a":1}'), SECRET)).toBe(true)
    expect(verifySignature(body, sign('{"a":2}'), SECRET)).toBe(false)
    expect(verifySignature(body, 'sha1=abc', SECRET)).toBe(false)
    expect(verifySignature(body, undefined, SECRET)).toBe(false)
    expect(verifySignature(body, sign('{"a":1}'), null)).toBe(false)
    expect(verifySignature('not a buffer', sign('{"a":1}'), SECRET)).toBe(false)
  })

  it('POST without a valid signature is 401 and nothing is processed', async () => {
    const body = inbound({ type: 'text', text: { body: 'hi' } })
    const res = await request(app).post('/api/v1/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', sign(body + ' ')).send(body)
    expect(res.status).toBe(401)
    expect(handleInbound).not.toHaveBeenCalled()
  })

  it('a signed POST is acknowledged 200 and every message is dispatched with its normalised number and contact name', async () => {
    const body = inbound({ type: 'text', text: { body: 'hi' } })
    const res = await request(app).post('/api/v1/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', sign(body)).send(body)
    expect(res.status).toBe(200)
    expect(handleInbound).toHaveBeenCalledTimes(1)
    expect(handleInbound.mock.calls[0][0]).toMatchObject({ phone: '919876543210', contactName: 'Asha', message: { id: 'wamid.1', type: 'text' } })
  })

  it('a status-only webhook (delivered/read) is acknowledged and dispatches nothing', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.1', status: 'read' }] } }] }] })
    const res = await request(app).post('/api/v1/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', sign(body)).send(body)
    expect(res.status).toBe(200)
    expect(handleInbound).not.toHaveBeenCalled()
  })

  it('a message from a non-Indian number is dropped', async () => {
    const body = inbound({ type: 'text', text: { body: 'hi' } }, '447700900123')
    await request(app).post('/api/v1/webhooks/whatsapp').set('content-type', 'application/json').set('x-hub-signature-256', sign(body)).send(body)
    expect(handleInbound).not.toHaveBeenCalled()
  })
})

describe('idempotency — the unique waMessageId', () => {
  it('a redelivered message is reported as a duplicate, never processed twice', async () => {
    prismaMock.whatsAppMessage.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }))
    const r = await recordInbound({ id: 'wamid.1', type: 'text' }, { phone: '919876543210' })
    expect(r).toEqual({ row: null, duplicate: true })
  })

  it('a new message is stored with the raw payload under the sender', async () => {
    const r = await recordInbound({ id: 'wamid.2', type: 'text', text: { body: 'hi' } }, { phone: '919876543210', conversationId: 'c1' })
    expect(r.duplicate).toBe(false)
    expect(r.row).toMatchObject({ waMessageId: 'wamid.2', phone: '919876543210', direction: 'IN', conversationId: 'c1', status: 'RECEIVED' })
  })

  it('any other database error still throws', async () => {
    prismaMock.whatsAppMessage.create.mockRejectedValueOnce(new Error('connection lost'))
    await expect(recordInbound({ id: 'wamid.3', type: 'text' }, { phone: '919876543210' })).rejects.toThrow('connection lost')
  })
})
