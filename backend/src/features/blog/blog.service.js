// The blog, loaded from JSON files on disk.
//
// WHY FILES AND NOT A TABLE. A post is written once, edited rarely, and read
// by strangers — it has no per-user state and nothing about it needs a query
// planner. Putting it in Postgres would mean a model, a migration, admin CRUD
// and a rich-text editor before the first article could exist, and the editor
// is the expensive part. Files ship the first article today, keep every draft
// in git history for free, and make a bad edit a revert rather than a
// data-recovery exercise.
//
// Same shape as metro.service.js and areas.service.js: read the directory once
// at startup, serve from memory. A deploy restarts the API (deploy.sh →
// systemctl restart), so the cache cannot outlive the files it came from.
//
// If this ever outgrows files — scheduled publishing, non-technical authors,
// per-post analytics — swap the loader. `listPosts`/`getPost` are the whole
// surface the routes and the frontend see, so a move to Prisma touches this
// file and nothing else.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data/blog')

// The clusters from the content plan. A post declares one, and an unknown
// value is a load error rather than a silently uncategorised post — the
// clusters ARE the internal-linking structure, so a typo here quietly costs
// the topical authority the structure exists to build.
export const CLUSTERS = {
  'renting-in-india': 'Renting in India',
  'city-guides': 'City & Neighbourhood Guides',
  'home-search': 'Home Search & Decisions',
  'market-intelligence': 'Market Intelligence',
}

const REQUIRED = ['slug', 'title', 'seoTitle', 'description', 'cluster', 'author', 'publishedAt', 'body']

/**
 * Words per minute for reading time. 200 is the low end of the usual 200-250
 * range for adult prose, chosen deliberately: over-estimating how long an
 * article takes is a smaller sin than promising a 6-minute read that runs 12.
 */
const WPM = 200

/** DERIVED, never authored — an authored reading time drifts on the first edit. */
function readingMinutes(body) {
  const words = body.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / WPM))
}

/**
 * Load and validate one file. Returns null for anything malformed rather than
 * throwing, so a single bad post degrades to "that post is missing" instead of
 * taking the whole API down at boot. The real gate is
 * tests/blog-content.test.js, which fails the build — a broken post should
 * never reach a deploy in the first place.
 */
function parsePost(file, raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch (err) {
    console.error(JSON.stringify({ src: 'blog', event: 'parse_failed', file, error: err.message }))
    return null
  }

  const missing = REQUIRED.filter((k) => !data[k])
  if (missing.length) {
    console.error(JSON.stringify({ src: 'blog', event: 'invalid_post', file, missing }))
    return null
  }
  if (!CLUSTERS[data.cluster]) {
    console.error(JSON.stringify({ src: 'blog', event: 'unknown_cluster', file, cluster: data.cluster }))
    return null
  }
  // The filename IS the slug. Two sources of truth for a URL is how a post
  // ends up reachable at one address and linked at another.
  const expected = `${data.slug}.json`
  if (file !== expected) {
    console.error(JSON.stringify({ src: 'blog', event: 'slug_filename_mismatch', file, expected }))
    return null
  }

  return {
    ...data,
    updatedAt: data.updatedAt ?? data.publishedAt,
    tags: data.tags ?? [],
    faq: data.faq ?? [],
    related: data.related ?? [],
    sources: data.sources ?? [],
    clusterLabel: CLUSTERS[data.cluster],
    readingMinutes: readingMinutes(data.body),
  }
}

function loadAll() {
  let files
  try {
    files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
  } catch {
    // No directory yet is a legitimate state on a fresh checkout — an empty
    // blog, not a crash.
    return []
  }

  const posts = files
    .map((file) => parsePost(file, readFileSync(path.join(DATA_DIR, file), 'utf-8')))
    .filter(Boolean)
    // Newest first, everywhere. The list page, the sitemap and "related"
    // all inherit this, so ordering is decided once.
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

  console.log(JSON.stringify({ src: 'blog', event: 'loaded', posts: posts.length, files: files.length }))
  return posts
}

const POSTS = loadAll()
const BY_SLUG = new Map(POSTS.map((p) => [p.slug, p]))

/**
 * The card shape — everything a list needs and nothing it doesn't. `body` is
 * the biggest field by two orders of magnitude and no list renders it, so
 * shipping it would make the index page's payload grow with every article
 * ever written.
 */
function toSummary(p) {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    excerpt: p.excerpt ?? p.description,
    cluster: p.cluster,
    clusterLabel: p.clusterLabel,
    tags: p.tags,
    author: p.author,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    readingMinutes: p.readingMinutes,
    hero: p.hero ?? null,
  }
}

/** @param {{cluster?: string, tag?: string, limit?: number}} opts */
export function listPosts({ cluster, tag, limit } = {}) {
  let rows = POSTS
  if (cluster) rows = rows.filter((p) => p.cluster === cluster)
  if (tag) rows = rows.filter((p) => p.tags.includes(tag))
  if (limit) rows = rows.slice(0, limit)
  return rows.map(toSummary)
}

/**
 * One post, with its related posts resolved to summaries.
 *
 * An unknown slug in `related` is DROPPED rather than rendered as a dead link
 * — a post can legitimately reference an article that has not been written
 * yet, and the plan explicitly builds clusters that way. The test asserts the
 * shipped set has no dangling references, so a real typo still fails the build;
 * this only keeps a forward reference from breaking the page.
 */
export function getPost(slug) {
  const post = BY_SLUG.get(slug)
  if (!post) return null

  const related = post.related.map((s) => BY_SLUG.get(s)).filter(Boolean).map(toSummary)

  // If the author named no reachable related posts, fall back to the newest
  // others in the same cluster. An article with no way onward is a dead end,
  // and the internal-linking structure is the point of the clusters.
  const fallback = related.length
    ? []
    : POSTS.filter((p) => p.slug !== slug && p.cluster === post.cluster).slice(0, 3).map(toSummary)

  return { ...post, related: related.length ? related : fallback }
}

export function allSlugs() {
  return POSTS.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt }))
}

/** Test seam — the module-level load is what production uses. */
export function _loadAllForTest() {
  return loadAll()
}
