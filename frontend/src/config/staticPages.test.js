import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { STATIC_PAGES } from './staticPages.js'
import { renderStaticHead } from '../../vite-plugins/staticHeads.js'

const SHELL = readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8')

describe('static page heads', () => {
  it('keeps every title inside a search result once " | StayOnMap" is added', () => {
    for (const [p, { title }] of Object.entries(STATIC_PAGES)) {
      expect(`${title} | StayOnMap`.length, p).toBeLessThanOrEqual(60)
    }
  })

  it('keeps every description long enough to use and short enough not to be cut', () => {
    for (const [p, { description }] of Object.entries(STATIC_PAGES)) {
      expect(description.length, p).toBeGreaterThanOrEqual(70)
      expect(description.length, p).toBeLessThanOrEqual(160)
    }
  })

  it('writes the page own title, description, canonical and social tags, once each', () => {
    const html = renderStaticHead(SHELL, '/about', STATIC_PAGES['/about'])
    expect(html.match(/<title>/g)).toHaveLength(1)
    expect(html).toContain('<title>About — Broker-Free, Map-First Renting | StayOnMap</title>')
    expect(html).toContain('<link rel="canonical" href="https://www.stayonmap.com/about" />')
    expect(html).toContain('<meta property="og:url" content="https://www.stayonmap.com/about" />')
    expect(html).toContain(`<meta property="og:description" content="${STATIC_PAGES['/about'].description}" />`)
    expect(html.match(/<meta name="description"/g)).toHaveLength(1)
    expect(html).not.toContain('Rent with intelligence.</title>')
  })

  it('leaves the app shell itself alone', () => {
    const html = renderStaticHead(SHELL, '/terms', STATIC_PAGES['/terms'])
    expect(html).toContain('<div id="root">')
    expect(html.replace(/<head>[\s\S]*<\/head>/, '')).toBe(SHELL.replace(/<head>[\s\S]*<\/head>/, ''))
  })

  it('escapes text so a quote in a title cannot break the attribute', () => {
    const html = renderStaticHead(SHELL, '/x', { title: 'A "quoted" <b>', description: 'd'.repeat(80) })
    expect(html).toContain('A &quot;quoted&quot; &lt;b&gt; | StayOnMap')
  })
})
