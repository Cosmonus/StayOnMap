/**
 * The help centre.
 *
 * Two rules, and both are about not showing somebody the wrong thing:
 *
 *   1. UNPUBLISHED IS INVISIBLE. A draft that is live is worse than no article,
 *      and there is deliberately no `includeUnpublished` flag on the read path —
 *      a boolean like that gets forwarded from a query string eventually.
 *   2. AUDIENCE NARROWS, IT DOES NOT EXCLUDE. `audience: null` means everyone,
 *      so an owner sees owner articles AND general ones, and is never offered
 *      "how to book a viewing".
 *
 * Plus the seed itself: it is checked for size and honesty, because a help
 * centre padded to fifty makes the ten that matter harder to find, and an
 * article describing a feature we do not have is worse than none.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { prismaMock } from './mocks/prisma.js'
import { listArticles, getArticle, listCategories } from '../src/features/support/knowledge.service.js'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.knowledgeArticle.findMany.mockResolvedValue([])
  prismaMock.knowledgeCategory.findMany.mockResolvedValue([])
})

describe('what a reader is shown', () => {
  it('never returns an unpublished article', async () => {
    await listArticles({ hat: 'TENANT' })
    expect(prismaMock.knowledgeArticle.findMany.mock.calls[0][0].where.published).toBe(true)
  })

  it('gives a hat its own articles AND the general ones', async () => {
    await listArticles({ hat: 'OWNER' })
    const { where } = prismaMock.knowledgeArticle.findMany.mock.calls[0][0]
    expect(where.OR).toEqual([{ audience: null }, { audience: 'OWNER' }])
  })

  it('searches bodies as well as titles', async () => {
    // Typing "deposit" should find the lease article even though the word is
    // not in its title — which is most of what a help search is for.
    await listArticles({ hat: 'TENANT', search: 'deposit' })
    const { where } = prismaMock.knowledgeArticle.findMany.mock.calls[0][0]
    const fields = where.AND?.flatMap((c) => c.OR ?? []) ?? where.OR
    expect(JSON.stringify(where)).toMatch(/body/)
    expect(fields).toBeTruthy()
  })

  it('bounds the result set', async () => {
    await listArticles({})
    expect(prismaMock.knowledgeArticle.findMany.mock.calls[0][0].take).toBeGreaterThan(0)
  })

  it('will not fetch an unpublished article by slug either', async () => {
    prismaMock.knowledgeArticle.findFirst.mockResolvedValue(null)
    await getArticle('what-lease-means')
    expect(prismaMock.knowledgeArticle.findFirst.mock.calls[0][0].where.published).toBe(true)
  })

  it('counts only published articles per category', async () => {
    // A category reading "4 articles" that opens onto one is a category that
    // has counted its drafts.
    await listCategories()
    const { select } = prismaMock.knowledgeCategory.findMany.mock.calls[0][0]
    expect(select._count.select.articles.where.published).toBe(true)
  })
})

describe('the seed', () => {
  const src = readFileSync(new URL('../scripts/seed-knowledge.mjs', import.meta.url), 'utf8')
  const slugs = [...src.matchAll(/^\s*slug: '([a-z0-9-]+)',$/gm)].map((m) => m[1])

  it('stays small enough to read end to end', () => {
    // The point is that a support request can be AVOIDED, not that we have a
    // wiki. Fifty articles makes the ten that matter harder to find.
    expect(slugs.length).toBeGreaterThan(8)
    expect(slugs.length).toBeLessThan(30)
  })

  it('has no duplicate slugs — the upsert key', () => {
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('is idempotent, so re-running edits rather than duplicates', () => {
    expect(src).toMatch(/upsert/)
    expect(src).not.toMatch(/deleteMany/)
  })

  it('covers the things this product actually raises', () => {
    // Written from the behaviour in the code, not from what a rental platform
    // generally does: the lease lump sum, the lock-in, anonymous reporting,
    // the city gate.
    for (const topic of ['what-lease-means', 'lock-in-and-notice', 'reporting-a-listing', 'city-not-supported']) {
      expect(slugs, topic).toContain(topic)
    }
  })
})
