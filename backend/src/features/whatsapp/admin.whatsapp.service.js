// The admin's view of WhatsApp listings: who is talking to the bot, how far
// they got, what broke, and the funnel across all of them.
//
// Everything here is a READ except the three interventions at the bottom,
// each of which goes through the engine's own paths — an admin retrying a
// publish runs the same code the owner's Publish button does.
import { prisma } from '../../lib/prisma.js'
import { WHATSAPP_FUNNEL, WHATSAPP_FAILURES } from '../analytics/events.js'
import { OPEN_STATUSES } from './conversation.service.js'
import { retryPublish, nudge } from './engine.js'
import { sendText } from './client.js'
import { toMasked } from './phone.js'
import { CATEGORIES } from './questionnaire/schemas.js'

const CONVERSATION_SELECT = {
  id: true, phone: true, userId: true, status: true, propertyType: true, currentQuestion: true,
  completionPct: true, propertyId: true, lastError: true, errorCount: true,
  lastMessageAt: true, completedAt: true, cancelledAt: true, createdAt: true, updatedAt: true,
  user: { select: { id: true, name: true, email: true, phone: true, phoneVerifiedAt: true, isBlocked: true } },
}

async function attachProperties(rows) {
  const ids = rows.map((r) => r.propertyId).filter(Boolean)
  if (!ids.length) return rows.map((r) => ({ ...r, property: null }))
  const props = await prisma.property.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, title: true, status: true, city: true, type: true, publishedAt: true,
      trustScore: { select: { badge: true, overallScore: true } },
      riskScore: { select: { level: true, score: true } },
      verification: { select: { status: true } },
      _count: { select: { images: true } },
    },
  })
  const byId = new Map(props.map((p) => [p.id, p]))
  return rows.map((r) => ({ ...r, property: r.propertyId ? byId.get(r.propertyId) ?? null : null }))
}

function shape(row) {
  const draft = row.draft ?? {}
  return {
    ...row,
    phoneMasked: toMasked(row.phone),
    propertyTypeLabel: row.propertyType ? CATEGORIES[row.propertyType]?.label ?? row.propertyType : null,
    location: draft.location?.confirmed ? { city: draft.location.city, locality: draft.location.locality, lat: draft.location.lat, lng: draft.location.lng } : null,
    photoCount: Array.isArray(draft.photos) ? draft.photos.length : 0,
  }
}

export async function listConversations({ status, page = 1, limit = 30, search } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 30))
  const where = {}
  if (status === 'open') where.status = { in: OPEN_STATUSES }
  else if (status === 'errors') where.errorCount = { gt: 0 }
  else if (status) where.status = status
  if (search) {
    const digits = search.replace(/\D/g, '')
    where.OR = [
      ...(digits ? [{ phone: { contains: digits } }] : []),
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { propertyId: search },
    ]
  }
  const [rows, total] = await Promise.all([
    prisma.whatsAppConversation.findMany({
      where, orderBy: { lastMessageAt: 'desc' }, skip: (pageNum - 1) * take, take,
      select: { ...CONVERSATION_SELECT, draft: true },
    }),
    prisma.whatsAppConversation.count({ where }),
  ])
  const withProps = await attachProperties(rows)
  return { conversations: withProps.map(shape).map(({ draft: _d, ...r }) => r), total, page: pageNum, limit: take }
}

export async function getConversation(id) {
  const row = await prisma.whatsAppConversation.findUnique({ where: { id }, select: { ...CONVERSATION_SELECT, draft: true } })
  if (!row) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  const [withProp] = await attachProperties([row])
  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, direction: true, type: true, payload: true, status: true, error: true, createdAt: true, processedAt: true },
  })
  const draft = row.draft ?? {}
  return {
    ...shape(withProp),
    draft: {
      fields: draft.fields ?? {},
      location: draft.location ?? null,
      photos: (draft.photos ?? []).map((p) => ({ url: p.url, order: p.order })),
      photosDone: !!draft.photosDone,
      pending: draft.pending?.kind ?? null,
    },
    messages: messages.map((m) => ({ ...m, text: summarise(m) })),
  }
}

// A one-line rendering of a message for the transcript — never media bytes.
function summarise(m) {
  const p = m.payload ?? {}
  if (m.direction === 'OUT') {
    if (p.type === 'text') return p.text?.body ?? ''
    if (p.type === 'interactive') {
      const body = p.interactive?.body?.text ?? ''
      const opts = p.interactive?.action?.buttons?.map((b) => b.reply?.title) ?? p.interactive?.action?.sections?.flatMap((s) => s.rows.map((r) => r.title)) ?? []
      return `${body}${opts.length ? `\n[${opts.join(' | ')}]` : ''}`
    }
    if (p.type === 'template') return `(template: ${p.template?.name})`
    return `(${p.type})`
  }
  switch (p.type) {
    case 'text': return p.text?.body ?? ''
    case 'interactive': return `→ ${(p.interactive?.button_reply ?? p.interactive?.list_reply)?.title ?? ''}`
    case 'button': return `→ ${p.button?.text ?? ''}`
    case 'location': return `📍 ${p.location?.latitude}, ${p.location?.longitude}${p.location?.name ? ` (${p.location.name})` : ''}`
    case 'image': return `📸 image${p.image?.caption ? `: ${p.image.caption}` : ''}`
    default: return `(${p.type ?? 'unknown'})`
  }
}

/**
 * The WhatsApp funnel, counted in CONVERSATIONS. Every rate is quoted against
 * wa_conversation_started; the drop-off table is where OPEN conversations
 * that have gone quiet are stuck.
 */
export async function getFunnel({ days = 30 } = {}) {
  const since = new Date(Date.now() - Math.min(365, Math.max(1, days)) * 86_400_000)

  const [stepRows, failureRows, typeRows, stuckRows, durations, counts] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ['name'], where: { name: { in: WHATSAPP_FUNNEL }, createdAt: { gte: since } }, _count: { _all: true },
    }).catch(() => []),
    prisma.analyticsEvent.groupBy({
      by: ['name'], where: { name: { in: WHATSAPP_FAILURES }, createdAt: { gte: since } }, _count: { _all: true },
    }).catch(() => []),
    prisma.whatsAppConversation.groupBy({
      by: ['propertyType'], where: { createdAt: { gte: since }, propertyType: { not: null } }, _count: { _all: true },
    }).catch(() => []),
    prisma.whatsAppConversation.groupBy({
      by: ['currentQuestion'],
      where: { status: { in: OPEN_STATUSES }, lastMessageAt: { lt: new Date(Date.now() - 24 * 3_600_000) }, createdAt: { gte: since } },
      _count: { _all: true },
    }).catch(() => []),
    prisma.whatsAppConversation.findMany({
      where: { status: { in: ['VERIFICATION', 'COMPLETED'] }, createdAt: { gte: since }, propertyId: { not: null } },
      select: { createdAt: true, updatedAt: true, completedAt: true },
      take: 1000,
    }).catch(() => []),
    Promise.all([
      prisma.whatsAppConversation.count({ where: { createdAt: { gte: since } } }),
      prisma.whatsAppConversation.count({ where: { createdAt: { gte: since }, propertyId: { not: null } } }),
      prisma.whatsAppConversation.count({ where: { createdAt: { gte: since }, status: 'COMPLETED' } }),
      prisma.whatsAppConversation.count({ where: { status: { in: OPEN_STATUSES } } }),
    ]).catch(() => [0, 0, 0, 0]),
  ])

  // groupBy counts EVENTS; a conversation may log one step more than once
  // (review shown twice after an edit). Cap each step at "started" so a rate
  // can never exceed 100%, and note it is an upper bound.
  const byName = Object.fromEntries(stepRows.map((r) => [r.name, r._count._all]))
  const started = byName.wa_conversation_started ?? counts[0] ?? 0
  const steps = WHATSAPP_FUNNEL.map((name) => {
    const n = Math.min(byName[name] ?? 0, started || Infinity)
    return { name, count: n, rate: started ? Math.round((n / started) * 1000) / 10 : 0 }
  })

  const ms = durations.map((d) => new Date(d.completedAt ?? d.updatedAt).getTime() - new Date(d.createdAt).getTime()).filter((n) => n > 0).sort((a, b) => a - b)
  const median = ms.length ? ms[Math.floor(ms.length / 2)] : null

  return {
    days,
    started: counts[0],
    listingsCreated: counts[1],
    listingsPublished: counts[2],
    openNow: counts[3],
    completionRate: counts[0] ? Math.round((counts[1] / counts[0]) * 1000) / 10 : 0,
    medianMinutesToSubmit: median != null ? Math.round(median / 60_000) : null,
    sampleSize: ms.length,
    steps,
    failures: WHATSAPP_FAILURES.map((name) => ({ name, count: failureRows.find((r) => r.name === name)?._count._all ?? 0 })),
    byType: typeRows.map((r) => ({ propertyType: r.propertyType, label: CATEGORIES[r.propertyType]?.label ?? r.propertyType, count: r._count._all })),
    // Where quiet conversations are stuck — the question that loses people.
    dropOff: stuckRows.map((r) => ({ question: r.currentQuestion ?? '(before first question)', count: r._count._all })).sort((a, b) => b.count - a.count),
  }
}

// ── Interventions ──────────────────────────────────────────────────────────

export async function intervene(id, { action, text }, adminId) {
  const conv = await prisma.whatsAppConversation.findUnique({ where: { id } })
  if (!conv) throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })

  let result
  switch (action) {
    case 'cancel':
      if (!OPEN_STATUSES.includes(conv.status)) throw Object.assign(new Error('Conversation is not open'), { statusCode: 409 })
      result = await prisma.whatsAppConversation.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
      await sendText(conv.phone, 'Our team has closed this listing conversation. Say *hi* any time to start again.', { conversationId: id })
      break
    case 'retry_publish':
      result = await retryPublish(id)
      break
    case 'nudge':
      result = await nudge(id)
      break
    case 'message': {
      const body = String(text ?? '').trim()
      if (!body) throw Object.assign(new Error('Message text is required'), { statusCode: 400 })
      await sendText(conv.phone, body, { conversationId: id })
      result = conv
      break
    }
    default:
      throw Object.assign(new Error('Unknown action'), { statusCode: 400 })
  }

  await prisma.activityLog.create({
    data: { adminId, action: 'WHATSAPP_INTERVENTION', entity: 'WhatsAppConversation', entityId: id, meta: { action } },
  }).catch(() => {})
  return { id: result?.id ?? id, status: result?.status ?? conv.status }
}
