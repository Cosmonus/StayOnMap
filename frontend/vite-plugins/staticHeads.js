// Build step: write dist/<page>.html for each entry in STATIC_PAGES, the SPA shell
// with that page's own <title>, description, canonical and social tags.
//
// Served by nginx's `try_files $uri $uri.html $uri/ /index.html` (stayonmap.conf):
// /about finds about.html, every other route still gets the plain shell. Without
// that `$uri.html` the files are simply never served. A directory per page
// (about/index.html) is not used: nginx answers /about with a 301 to /about/.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { STATIC_PAGES } from '../src/config/staticPages.js'

const ORIGIN = 'https://www.stayonmap.com'
const BRAND = 'StayOnMap'

const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The shell with one page's head. Pure, so it is unit-tested without a build. */
export function renderStaticHead(shell, pagePath, page) {
  const title = escapeAttr(`${page.title} | ${BRAND}`)
  const description = escapeAttr(page.description)
  const url = `${ORIGIN}${pagePath}`
  const set = (html, re, replacement) => {
    if (!re.test(html)) throw new Error(`staticHeads: the shell has no ${re} to replace`)
    return html.replace(re, replacement)
  }
  let html = shell
  html = set(html, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
  html = set(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${description}" />\n    <link rel="canonical" href="${url}" />`)
  html = set(html, /<meta\s+property="og:title"[^>]*>/i, `<meta property="og:title" content="${title}" />`)
  html = set(html, /<meta\s+property="og:description"[^>]*>/i, `<meta property="og:description" content="${description}" />`)
  html = set(html, /<meta\s+property="og:url"[^>]*>/i, `<meta property="og:url" content="${url}" />`)
  html = set(html, /<meta\s+name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${title}" />`)
  html = set(html, /<meta\s+name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${description}" />`)
  return html
}

/** Vite plugin: runs once the shell is written. */
export function staticHeads() {
  let outDir
  return {
    name: 'stayonmap-static-heads',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir) },
    closeBundle() {
      const shell = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      for (const [pagePath, page] of Object.entries(STATIC_PAGES)) {
        writeFileSync(path.join(outDir, `${pagePath.slice(1)}.html`), renderStaticHead(shell, pagePath, page))
      }
    },
  }
}
