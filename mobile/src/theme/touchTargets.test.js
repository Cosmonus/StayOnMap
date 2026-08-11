/**
 * Tap targets: the arithmetic, and then the app measured against it.
 *
 * The second half is the unusual part. It does not check that call sites SPELL
 * things a particular way — it resolves each icon-only control's actual box out
 * of the source and adds its slop, because the bug this is about was never a
 * style violation. Twelve controls were written by people who knew the 48dp
 * rule and landed on 44 or 46: a 32dp button with `hitSlop={6}`, an 18dp icon
 * with `hitSlop={14}`. Every one of them reads as correct. Only the sum is
 * wrong, so only the sum is worth asserting.
 */
import { join } from 'node:path'
import { readSource } from '../test/sourceScan'
import { MIN_TAP_SIZE, tapSlop } from './touchTargets'

describe('tapSlop', () => {
  it('lifts a control to exactly the minimum', () => {
    for (const visual of [11, 13, 14, 16, 18, 20, 24, 32, 40]) {
      expect(visual + tapSlop(visual) * 2).toBeGreaterThanOrEqual(MIN_TAP_SIZE)
    }
  })

  it('rounds up, never down', () => {
    // An odd shortfall halves to a fraction. Rounding down would leave the
    // target a pixel short — which is the whole class of bug this file is
    // about, reintroduced by the helper meant to end it.
    expect(tapSlop(13)).toBe(18) // 48-13 = 35 → 17.5 → 18
    expect(13 + tapSlop(13) * 2).toBeGreaterThanOrEqual(MIN_TAP_SIZE)
  })

  it('asks for nothing once the control is already big enough', () => {
    expect(tapSlop(MIN_TAP_SIZE)).toBe(0)
    expect(tapSlop(64)).toBe(0)
  })

  it('takes the larger of the two standards', () => {
    // WCAG 2.5.8 asks 24, Android asks 48. Dropping to 24 would pass an audit
    // and still fail the person it is for.
    expect(MIN_TAP_SIZE).toBe(48)
  })
})

// ---------------------------------------------------------------------------

const files = readSource(join(__dirname, '..'))

/** `name: { … }` bodies inside StyleSheet.create, by brace matching. */
function styleBodies(src) {
  const out = {}
  const create = src.indexOf('StyleSheet.create(')
  if (create < 0) return out
  const re = /(\w+):\s*\{/g
  re.lastIndex = create
  let m
  while ((m = re.exec(src))) {
    let depth = 1
    let i = re.lastIndex
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
    }
    out[m[1]] = src.slice(re.lastIndex, i - 1)
    re.lastIndex = i
  }
  return out
}

/**
 * Every `hitSlop={N}` / `hitSlop={tapSlop(N)}`, with the visual box it belongs
 * to resolved from the styled container if there is one, else from the icon
 * inside it. A site whose box cannot be resolved is returned with `visual:
 * null` rather than guessed — see the count assertion below for why that is not
 * a quiet escape hatch.
 */
function tapSites() {
  const sites = []
  for (const { path, src } of files) {
    if (!/hitSlop=\{/.test(src)) continue
    const bodies = styleBodies(src)
    const dim = (body, key) => {
      const m = body?.match(new RegExp(`\\b${key}:\\s*(\\d+)`))
      return m ? +m[1] : null
    }

    for (const m of src.matchAll(/hitSlop=\{(?:tapSlop\((\d+)\)|(\d+))\}/g)) {
      const slop = m[1] != null ? Math.ceil(Math.max(0, MIN_TAP_SIZE - +m[1]) / 2) : +m[2]
      const line = src.slice(0, m.index).split('\n').length

      // The whole opening tag, both directions: `style` is written before
      // `hitSlop` on some call sites and after it on others, and reading only
      // backwards reported ScreenHeader's 44dp back button as an 22dp icon.
      const from = Math.max(0, m.index - 800)
      const back = src.slice(from, m.index)
      const at = Math.max(back.lastIndexOf('<Pressable'), back.lastIndexOf('<TouchableOpacity'))
      if (at < 0) continue
      const start = from + at
      let depth = 0
      let end = start
      for (; end < src.length; end++) {
        if (src[end] === '{') depth++
        else if (src[end] === '}') depth--
        else if (src[end] === '>' && depth === 0) break
      }
      const tag = src.slice(start, end + 1)

      let visual = null
      for (const name of [...tag.matchAll(/styles\.(\w+)/g)].map((s) => s[1])) {
        const h = dim(bodies[name], 'height') ?? dim(bodies[name], 'minHeight')
        if (h != null) { visual = h; break }
      }
      if (visual == null) {
        const icon = src.slice(end, end + 400).match(/(?:<Icon|<X)[^>]*\bsize=\{(\d+)\}/)?.[1]
        if (icon) visual = +icon
      }
      sites.push({ path, line, slop, visual })
    }
  }
  return sites
}

describe('the app measured against it', () => {
  const sites = tapSites()
  const resolved = sites.filter((s) => s.visual != null)

  it('still resolves most of the tap sites', () => {
    // The resolver reads source, so a refactor can quietly stop understanding a
    // call site — and an assertion that only checks what it resolved would then
    // pass by checking nothing. This is the floor that makes that loud. The
    // unresolved remainder are text buttons ("Cancel", "Try again"), whose box
    // is a line of type that grows with the OS font setting and so has no fixed
    // number to check.
    expect(sites.length).toBeGreaterThan(40)
    expect(resolved.length / sites.length).toBeGreaterThan(0.75)
  })

  it('gives every icon control a 48dp target', () => {
    const short = resolved
      .filter((s) => s.visual + s.slop * 2 < MIN_TAP_SIZE)
      .map((s) => `${s.path}:${s.line} — ${s.visual}dp + 2×${s.slop} = ${s.visual + s.slop * 2}dp`)
    // The array IS the message: jest prints each offender with its arithmetic,
    // which is the thing a reviewer cannot do by eye.
    expect(short).toEqual([])
  })
})
