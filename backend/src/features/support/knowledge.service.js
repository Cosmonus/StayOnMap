import { prisma } from '../../lib/prisma.js'

/**
 * The help centre.
 *
 * Deliberately small. The point is that a support request can be AVOIDED, not
 * that we have a wiki — so a handful of real articles about things this product
 * actually does, and no generated filler. An article answering a question
 * nobody asked costs a reader the time it takes to discover it is irrelevant.
 *
 * Search is `contains` over title and body rather than full-text. At this
 * article count a tsvector index and its maintenance would be machinery around
 * a list you can read end to end — and Postgres full-text needs a language
 * configuration, which is a decision worth making when there is something to
 * decide it against.
 */

const ARTICLE_SELECT = {
  id: true, slug: true, title: true, body: true, audience: true,
  category: { select: { slug: true, title: true } },
}

/**
 * Published articles for a reader, optionally filtered.
 *
 * `audience: null` means everyone, so the filter is "mine OR everyone's" — an
 * owner is never offered "how to book a viewing", and neither hat loses the
 * articles that apply to both.
 *
 * UNPUBLISHED IS INVISIBLE HERE. A draft that is live is worse than no article,
 * and there is deliberately no `includeUnpublished` flag on this path — the
 * admin panel reads the table directly rather than passing a boolean that could
 * be forwarded from a query string.
 */
export function listArticles({ hat = 'TENANT', category, search } = {}) {
  return prisma.knowledgeArticle.findMany({
    where: {
      published: true,
      OR: [{ audience: null }, { audience: hat }],
      ...(category ? { category: { slug: category } } : {}),
      ...(search
        ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { body: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}),
    },
    orderBy: [{ category: { order: 'asc' } }, { title: 'asc' }],
    take: 50,
    select: ARTICLE_SELECT,
  })
}

export function getArticle(slug) {
  return prisma.knowledgeArticle.findFirst({
    where: { slug, published: true },
    select: ARTICLE_SELECT,
  })
}

export function listCategories() {
  return prisma.knowledgeCategory.findMany({
    orderBy: { order: 'asc' },
    select: {
      id: true, slug: true, title: true, description: true,
      _count: { select: { articles: { where: { published: true } } } },
    },
  })
}
