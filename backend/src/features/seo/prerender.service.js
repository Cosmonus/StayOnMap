// Server-rendered <head> for the pages a crawler has to understand.
//
// WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT.
//
// It is not SSR. The body is still rendered by React in the browser. What the
// server injects is the part that decides whether a page can be found and
// shared at all: a real <title>, description, canonical, OG/Twitter tags and
// `RealEstateListing` structured data, present in the FIRST response.
//
// Full SSR of a Vite SPA would mean a second render process (or teaching
// Express to render React), a new build target and a new deploy path, on a
// single VM — a large change whose main extra benefit, body HTML, is something
// Googlebot already gets by executing our JS.
//
// What no crawler does is execute JS for a link preview. WhatsApp, Facebook,
// Twitter and Slack read the raw HTML and stop. Until now every listing shared
// on WhatsApp — the dominant sharing channel in Indian rentals — previewed as
// the same generic "StayOnMap — Rent with intelligence." with the same default
// image. That is the gap this closes, and it closes the indexing half too,
// because a title in the initial response never depends on a render budget.
//
// If anything here fails, nginx falls back to the plain SPA shell (see
// infra/server/nginx/stayonmap.conf's @spa named location) — exactly today's
// behaviour, never a broken page.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../config/env.js'

const ORIGIN = 'https://www.stayonmap.com'

// The built SPA shell. Read once and cached: a deploy restarts the API
// (deploy.sh → systemctl restart), so the cache cannot outlive the build it
// came from. A read failure is a supported state — see the module comment.
let templateCache = null

export async function loadTemplate() {
  if (templateCache) return templateCache
  try {
    const file = path.resolve(env.frontendDist, 'index.html')
    templateCache = await readFile(file, 'utf8')
    return templateCache
  } catch {
    return null
  }
}

/** Test seam — the template is cached for the process lifetime otherwise. */
export function resetTemplateCache() {
  templateCache = null
}

const escapeHtml = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]
))

// JSON-LD sits inside a <script> block, where the danger is not HTML escaping
// but `</script>` appearing inside a string and ending the block early. The
// standard fix, and the only one that is actually correct here.
const safeJsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c')

/**
 * Strip the template's OWN head tags before injecting ours, rather than
 * appending. Appending leaves two <title> elements and two og:title metas in
 * one document; browsers take the first, various crawlers take the last, and
 * which one wins becomes a coin flip per consumer.
 */
function stripDefaults(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:(?:title|description|image|url|type)"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:(?:title|description|image|card)"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
}

/**
 * @param {object} meta { title, description, canonical, image, type, jsonLd, noindex }
 */
export function renderHead(template, meta) {
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex,follow" />' : null,
    `<meta property="og:type" content="${escapeHtml(meta.type ?? 'website')}" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    meta.image ? `<meta property="og:image" content="${escapeHtml(meta.image)}" />` : null,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    meta.image ? `<meta name="twitter:image" content="${escapeHtml(meta.image)}" />` : null,
    meta.jsonLd
      ? `<script type="application/ld+json">${safeJsonLd(meta.jsonLd)}</script>`
      : null,
  ].filter(Boolean).join('\n    ')

  return stripDefaults(template).replace('</head>', `    ${tags}\n  </head>`)
}

export { ORIGIN }
