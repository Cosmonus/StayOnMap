// AIExtractionService — rules first, model second, questionnaire always.
//
// Merge policy, in priority order:
//   1. A rules hit is kept (it is a literal match on the owner's words).
//   2. A model field fills a gap only when its confidence clears the bar.
//   3. CRITICAL fields (rent, deposit, nightlyRate, propertyType, location)
//      need >= 0.9 from whichever source. Below that they are surfaced as
//      `uncertain` so the engine asks, never stored.
//   4. Every surviving value is run through parseAnswer() for its question,
//      which is the same validation a typed reply gets. A value that fails
//      is dropped — a wrong number the owner never typed is worse than a
//      question they answer twice.
import { extractByRules } from './rules.js'
import { extractByAi } from './ai.js'
import { findQuestion, parseAnswer, isVisible } from '../questionnaire/engine.js'
import { getQuestionnaire } from '../questionnaire/schemas.js'

const CRITICAL = new Set(['rent', 'deposit', 'nightlyRate', 'foodCharges'])
const CRITICAL_MIN = 0.9
const MODEL_MIN = 0.75

/**
 * @param {string} text
 * @param {{ category?: string|null, draft?: object, currentQuestion?: object|null }} ctx
 * @returns {Promise<{ fields: object, propertyType: string|null, locationText: string|null,
 *                     uncertain: string[], intent: string|null, applied: string[], rejected: string[] }>}
 */
export async function extractFields(text, { category = null, draft = {}, currentQuestion = null } = {}) {
  const rules = extractByRules(text, { category })
  const ai = await extractByAi(text, { category, currentQuestion })

  const merged = { ...rules.fields }
  const confidence = { ...rules.confidence }
  if (ai) {
    for (const [field, value] of Object.entries(ai.fields)) {
      if (field in merged) continue
      const c = ai.confidence[field] ?? 0
      if (c < MODEL_MIN) continue
      merged[field] = value
      confidence[field] = c
    }
  }

  const propertyType = rules.propertyType ?? ai?.propertyType ?? null
  const locationText = rules.fields.locationText ?? ai?.locationText ?? null
  delete merged.locationText

  const uncertain = [...rules.uncertain]
  const fields = {}
  const applied = []
  const rejected = []

  const cat = category ?? propertyType
  const schema = cat ? getQuestionnaire(cat) : null

  for (const [field, value] of Object.entries(merged)) {
    if (CRITICAL.has(field) && (confidence[field] ?? 0) < CRITICAL_MIN) {
      uncertain.push(`${field}: ${value}`)
      continue
    }
    if (!schema) { fields[field] = value; continue }
    const q = schema.find((x) => x.field === field)
    // A field this category never asks (bathrooms on a plot) is silently
    // dropped — appliesTo is encoded by absence from the questionnaire.
    if (!q) continue
    if (!isVisible(q, { fields: { ...(draft.fields ?? {}), ...fields } })) continue
    const parsed = parseAnswer(q, value)
    if (parsed.ok && parsed.value !== null) { fields[field] = parsed.value; applied.push(field) }
    else rejected.push(field)
  }

  return {
    fields,
    propertyType,
    locationText,
    uncertain,
    intent: ai?.intent ?? null,
    applied,
    rejected,
    // Exposed for the engine's "did the model see anything at all" check.
    hadSignal: Object.keys(merged).length > 0 || !!propertyType || !!locationText,
    currentQuestionAnswered: !!currentQuestion && currentQuestion.field in fields && !!findQuestion(cat, currentQuestion.id),
  }
}
