/**
 * The blog's content gate.
 *
 * Articles are JSON files in the repo, so there is no CMS, no admin form and no
 * database constraint standing between a typo and production. This file is that
 * gate — everything a form would normally validate is asserted here instead.
 *
 * The loader (features/blog/blog.service.js) deliberately SKIPS a malformed post
 * and logs rather than throwing, so one bad file cannot take the API down at
 * boot. That is the right runtime behaviour and the wrong build behaviour: a
 * skipped post is a silently missing article. These tests fail the build, which
 * is where a broken post should be caught.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { listPosts, getPost, allSlugs, CLUSTERS } from '../src/features/blog/blog.service.js'
import { metaForPost, metaForBlogIndex, postUrl } from '../src/features/seo/blogMeta.js'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'blog')
const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
const raw = files.map((f) => ({ file: f, data: JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')) }))

describe('blog content files', () => {
  it('ships at least one article', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('every file parses and loads — none silently skipped', () => {
    // The loader drops anything malformed. If these two numbers disagree, a
    // post exists on disk that the site will never serve.
    expect(listPosts().length).toBe(files.length)
  })

  it.each(raw)('$file has the required fields', ({ data }) => {
    for (const key of ['slug', 'title', 'seoTitle', 'description', 'cluster', 'author', 'publishedAt', 'body']) {
      expect(data[key], `missing ${key}`).toBeTruthy()
    }
    expect(data.author.name).toBeTruthy()
  })

  it.each(raw)('$file filename matches its slug', ({ file, data }) => {
    expect(file).toBe(`${data.slug}.json`)
  })

  it.each(raw)('$file declares a known cluster', ({ data }) => {
    expect(Object.keys(CLUSTERS)).toContain(data.cluster)
  })

  it('slugs are unique', () => {
    const slugs = raw.map((r) => r.data.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it.each(raw)('$file uses a URL-safe slug', ({ data }) => {
    expect(data.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it.each(raw)('$file has dates that parse, with updatedAt not before publishedAt', ({ data }) => {
    const published = new Date(data.publishedAt)
    const updated = new Date(data.updatedAt ?? data.publishedAt)
    expect(Number.isNaN(published.getTime())).toBe(false)
    expect(Number.isNaN(updated.getTime())).toBe(false)
    expect(updated.getTime()).toBeGreaterThanOrEqual(published.getTime())
  })
})

describe('blog SEO fields', () => {
  // The <title> a search result shows is seoTitle + " | StayOnMap" (12 chars).
  // 60 is the usual truncation point, so the stored title has ~48 to work with.
  it.each(raw)('$file seoTitle fits a search result with the brand suffix', ({ data }) => {
    expect(data.seoTitle.length + ' | StayOnMap'.length).toBeLessThanOrEqual(60)
  })

  it.each(raw)('$file seoTitle does not already carry the brand', ({ data }) => {
    // Both renderers append it. A stored suffix renders "… | StayOnMap | StayOnMap".
    expect(data.seoTitle).not.toMatch(/StayOnMap/)
  })

  it.each(raw)('$file description is a usable meta description', ({ data }) => {
    expect(data.description.length).toBeGreaterThanOrEqual(140)
    expect(data.description.length).toBeLessThanOrEqual(160)
  })

  it.each(raw)('$file is long enough to be a guide rather than a note', ({ data }) => {
    expect(data.body.trim().split(/\s+/).length).toBeGreaterThanOrEqual(1200)
  })

  it.each(raw)('$file body has section headings', ({ data }) => {
    const h2s = data.body.split('\n').filter((l) => /^##\s+\S/.test(l.trim()))
    expect(h2s.length).toBeGreaterThanOrEqual(4)
  })
})

describe('internal references', () => {
  it('every related slug resolves to a real post', () => {
    const known = new Set(raw.map((r) => r.data.slug))
    for (const { file, data } of raw) {
      for (const slug of data.related ?? []) {
        expect(known.has(slug), `${file} → related "${slug}" does not exist`).toBe(true)
      }
    }
  })

  it('no post links to a blog URL that does not exist', () => {
    // A dead internal link is worse than no link: it costs a reader and tells a
    // crawler the site links to 404s. Forward references belong in the content
    // plan, not in shipped prose.
    const known = new Set(raw.map((r) => r.data.slug))
    for (const { file, data } of raw) {
      for (const m of data.body.matchAll(/\]\(\/blog\/([^)#\s]+)/g)) {
        expect(known.has(m[1]), `${file} → links to /blog/${m[1]} which does not exist`).toBe(true)
      }
    }
  })

  it('no FRONTEND page links to a blog post that does not exist', () => {
    // The test above covers post→post. This covers page→post, which is the
    // riskier direction: a slug hardcoded in JSX has nothing validating it, and
    // renaming or retiring an article would leave a 404 behind a button that
    // still looks fine in review. /rules links to the walkthrough this way.
    //
    // Scans source rather than a list of known call sites — a guard that has to
    // be told where to look stops covering the next one somebody adds.
    const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'src')
    const known = new Set(raw.map((r) => r.data.slug))

    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = join(dir, e.name)
      if (e.isDirectory()) return walk(full)
      return /\.jsx?$/.test(e.name) ? [full] : []
    })

    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/["'`]\/blog\/([a-z0-9][a-z0-9-]*)["'`]/g)) {
        expect(known.has(m[1]), `${file} → links to /blog/${m[1]} which does not exist`).toBe(true)
      }
    }
  })

  it('no post links to a bare apex URL', () => {
    // The apex 302s and DROPS the path (see .claude/roadmap.md P5), so an apex
    // link in an article is a redirect to the homepage.
    for (const { file, data } of raw) {
      expect(data.body, `${file} uses an apex URL`).not.toMatch(/https:\/\/stayonmap\.com/)
    }
  })
})

describe('structured data', () => {
  const post = getPost(raw[0].data.slug)

  it('emits BlogPosting plus FAQPage when the article has questions', () => {
    const meta = metaForPost(post)
    const blocks = [].concat(meta.jsonLd)
    const types = blocks.map((b) => b['@type'])
    expect(types).toContain('BlogPosting')
    if (post.faq.length) expect(types).toContain('FAQPage')
  })

  it('BlogPosting carries the fields a rich result needs', () => {
    const article = [].concat(metaForPost(post).jsonLd).find((b) => b['@type'] === 'BlogPosting')
    expect(article.headline).toBe(post.title)
    expect(article.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(article.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(article.author.name).toBe(post.author.name)
    expect(article.publisher.name).toBe('StayOnMap')
    expect(article.mainEntityOfPage['@id']).toBe(postUrl(post.slug))
  })

  it('every FAQ entry marked up is one the page actually renders', () => {
    // The article template always renders `faq`. Google requires marked-up
    // content to be visible; if a future template hides it, this must change
    // with it rather than quietly claiming content that is not there.
    const faq = [].concat(metaForPost(post).jsonLd).find((b) => b['@type'] === 'FAQPage')
    if (!faq) return
    expect(faq.mainEntity).toHaveLength(post.faq.length)
    expect(faq.mainEntity[0].acceptedAnswer.text).toBe(post.faq[0].a)
  })

  it('canonical URLs are absolute and on www', () => {
    expect(metaForPost(post).canonical).toMatch(/^https:\/\/www\.stayonmap\.com\/blog\//)
    expect(metaForBlogIndex(listPosts()).canonical).toBe('https://www.stayonmap.com/blog')
  })

  it('the index title also stays inside the search-result budget', () => {
    expect(metaForBlogIndex(listPosts()).title.length).toBeLessThanOrEqual(60)
  })
})

describe('lookup behaviour', () => {
  it('returns null for an unknown slug', () => {
    expect(getPost('no-such-article')).toBeNull()
  })

  it('does not treat a path-traversal slug as a post', () => {
    expect(getPost('../../../etc/passwd')).toBeNull()
  })

  it('lists newest first', () => {
    const dates = listPosts().map((p) => new Date(p.publishedAt).getTime())
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
  })

  it('summaries omit the body — the index payload must not carry every article', () => {
    for (const p of listPosts()) expect(p.body).toBeUndefined()
  })

  it('allSlugs covers every post, for the sitemap', () => {
    expect(allSlugs().map((s) => s.slug).sort()).toEqual(raw.map((r) => r.data.slug).sort())
  })

  it('filters by cluster', () => {
    const cluster = raw[0].data.cluster
    const filtered = listPosts({ cluster })
    expect(filtered.length).toBeGreaterThan(0)
    for (const p of filtered) expect(p.cluster).toBe(cluster)
    expect(listPosts({ cluster: 'city-guides' }).every((p) => p.cluster === 'city-guides')).toBe(true)
  })
})
