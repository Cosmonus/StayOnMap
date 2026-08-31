// LLM extraction — structured output only, never a database write.
//
// The model sees the owner's message, the category, and the list of fields
// that category can accept. It returns JSON: an intent, a `fields` object and
// a per-field confidence. That JSON is parsed here, validated against a Zod
// shape here, and then re-validated field by field by the questionnaire
// engine before it is stored — three gates, so a hallucinated value cannot
// reach a Property row by any path.
//
// Off in production today (AI_PROVIDER=stub) and the flow is complete without
// it: rules.js reads the common phrasings and the questionnaire asks for the
// rest. Switching it on makes the bot understand more sentences; it never
// makes it do anything new.
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { env } from '../../../config/env.js'
import { aiEnabled } from '../../ai/ai.service.js'
import { intelLog, intelError } from '../../../lib/intelLog.js'
import { getQuestionnaire, CATEGORY_KEYS } from '../questionnaire/schemas.js'

const MODEL = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 8_000

const Output = z.object({
  intent: z.enum(['provide_property_details', 'answer_question', 'ask_help', 'cancel', 'restart', 'confirm', 'deny', 'edit', 'other']).default('other'),
  property_type: z.enum(CATEGORY_KEYS).nullable().optional(),
  fields: z.record(z.unknown()).default({}),
  confidence: z.record(z.number().min(0).max(1)).default({}),
  location_text: z.string().max(200).nullable().optional(),
})

function describeFields(category) {
  const qs = getQuestionnaire(category) ?? []
  return qs
    .filter((q) => !['location', 'image'].includes(q.type))
    .map((q) => {
      const opts = q.options ? ` one of: ${q.options.map((o) => JSON.stringify(o.value)).join(', ')}` : ''
      return `- ${q.field} (${q.type}${opts}): ${q.label}`
    })
    .join('\n')
}

function parseJson(text) {
  const match = String(text ?? '').match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

/**
 * @returns {Promise<null | { intent, propertyType, fields, confidence, locationText }>}
 *   null when AI is off, times out, or replies with something unusable — the
 *   caller treats null exactly like "the model had nothing to add".
 */
export async function extractByAi(text, { category = null, currentQuestion = null } = {}) {
  if (!aiEnabled() || !text?.trim()) return null

  const fieldDoc = category
    ? describeFields(category)
    : CATEGORY_KEYS.map((k) => `### ${k}\n${describeFields(k)}`).join('\n\n')

  const prompt = `You extract structured listing facts from a property owner's WhatsApp message for StayOnMap, an Indian rental platform.

Category: ${category ?? 'unknown — infer property_type if the message says'}
${currentQuestion ? `The bot just asked: "${currentQuestion.label}" (field: ${currentQuestion.field}). If the message answers it, put the answer under that field.` : ''}

Allowed fields for this category (use ONLY these keys, with values of the given type; for option fields use exactly one of the listed values):
${fieldDoc}

Rules:
- Indian money: "28k" = 28000, "1 lakh" = 100000, "1.5 lac" = 150000, "2 cr" = 20000000. Return integers in rupees.
- Never guess rent, deposit, price or property type. If not stated, leave the key out.
- A place name ("Velachery", "near Phoenix Mall") goes in location_text, never in a coordinate.
- Dates: return ISO 8601 (YYYY-MM-DD). "September" means the 1st of next September.
- confidence: 0..1 per field you return.
- intent: provide_property_details | answer_question | ask_help | cancel | restart | confirm | deny | edit | other

Message:
"""${text.slice(0, 1500)}"""

Respond with ONLY valid JSON: {"intent": "...", "property_type": "...|null", "fields": {...}, "confidence": {...}, "location_text": "...|null"}`

  const started = Date.now()
  try {
    const client = new Anthropic({ apiKey: env.anthropicApiKey })
    const message = await client.messages.create(
      { model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] },
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    )
    const parsed = Output.safeParse(parseJson(message.content?.[0]?.text))
    if (!parsed.success) {
      intelError('whatsapp.ai_extract_unparseable', new Error('model reply failed schema'), { category })
      return null
    }
    const d = parsed.data
    intelLog('whatsapp.ai_extract', { category, intent: d.intent, fieldCount: Object.keys(d.fields).length, ms: Date.now() - started })
    return {
      intent: d.intent,
      propertyType: d.property_type ?? null,
      fields: d.fields,
      confidence: d.confidence,
      locationText: d.location_text ?? null,
    }
  } catch (err) {
    intelError('whatsapp.ai_extract_failed', err, { category, ms: Date.now() - started })
    return null
  }
}
