import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../../lib/prisma.js'

const provider = process.env.AI_PROVIDER ?? 'stub'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export async function scoreFraud(propertyId) {
  if (provider === 'stub') return { score: 0, signals: [] }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      title: true, rent: true, deposit: true, city: true, address: true,
      description: true, createdAt: true,
      reports:      { select: { category: true, severity: true } },
      fraudSignals: { select: { type: true, detail: true } },
      images:       { select: { url: true } },
    },
  })

  if (!property) return { score: 0, signals: [] }

  const context = JSON.stringify({
    title:        property.title,
    rent:         property.rent,
    deposit:      property.deposit,
    city:         property.city,
    address:      property.address,
    description:  property.description?.slice(0, 500),
    reportCount:  property.reports.length,
    reportTypes:  property.reports.map((r) => `${r.severity} ${r.category}`),
    existingSignals: property.fraudSignals.map((s) => s.type),
    imageCount:   property.images.length,
  })

  const prompt = `You are a fraud detection system for a rental property platform in India.
Analyze the following property listing and return a JSON object with:
- score: integer 0-100 (0=definitely legit, 100=definitely fraud)
- signals: array of strings describing specific red flags found (empty array if none)

Criteria to check:
- Unusually low rent for the city (potential bait listing)
- Vague or copied description
- High report count or CRITICAL/HIGH severity reports
- Already has fraud signals logged
- Very recently listed with suspicious patterns
- Deposit-to-rent ratio anomalies (deposit > 10x rent is suspicious)

Property data:
${context}

Respond with ONLY valid JSON in this exact format:
{"score": 42, "signals": ["reason 1", "reason 2"]}`

  try {
    const client = getClient()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0]?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { score: 0, signals: [] }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      score:   Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      signals: Array.isArray(parsed.signals) ? parsed.signals.filter((s) => typeof s === 'string') : [],
    }
  } catch {
    return { score: 0, signals: [] }
  }
}

export async function moderateReview(_reviewId) {
  if (provider === 'stub') return { approved: true, reason: 'stub-pass' }
  // Future: toxicity classifier
}

export async function detectDuplicateImages(_propertyId) {
  if (provider === 'stub') return { duplicates: [] }
  // Future: perceptual hash comparison
}

export async function generatePropertySummary(_propertyId) {
  if (provider === 'stub') return { summary: '' }
  // Future: GPT summary from reviews + trust score
}

export async function detectFakeReview(_reviewId) {
  if (provider === 'stub') return { isFake: false, confidence: 0 }
  // Future: fake review classifier
}

export async function runFraudScan(propertyId) {
  const result = await scoreFraud(propertyId)
  if (result.score > 70) {
    await prisma.fraudSignal.create({ data: { propertyId, type: 'AI_FLAGGED', detail: `AI fraud score: ${result.score}` } })
  }
  return result
}
