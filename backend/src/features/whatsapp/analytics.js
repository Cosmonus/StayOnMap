// The WhatsApp funnel — one call per step, recorded through the existing
// first-party analytics table. The session is the CONVERSATION, so the
// readout's "sessions" are owners who started, and every rate is quoted
// against wa_conversation_started (see admin.whatsapp.service.js).
//
// Fire-and-forget by construction: record() never throws to its caller and a
// lost event must never cost an owner a reply.
import { record } from '../analytics/analytics.service.js'

export function track(conversation, name, props = {}) {
  if (!conversation?.id) return
  try {
    record(name, {
      sessionId: conversation.id,
      userId: conversation.userId ?? null,
      propertyId: conversation.propertyId ?? null,
      city: conversation.draft?.location?.city ?? null,
      props: { propertyType: conversation.propertyType ?? null, ...props },
    })
  } catch { /* never */ }
}
