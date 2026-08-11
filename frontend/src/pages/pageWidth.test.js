/**
 * The page shell width.
 *
 * Three surfaces share one token, and each pairing exists for a different
 * reason:
 *
 *   PropertyPage skeleton ↔ PropertyDetailBody
 *     Different widths mean the page JUMPS SIDEWAYS the moment the skeleton is
 *     replaced by real content. PropertyPage's own comment has warned about
 *     this for as long as the skeleton has existed; nothing checked it.
 *
 *   Services ↔ Guides
 *     Matched by operator decision (2026-08-08), which is precisely the kind of
 *     agreement two literals quietly end. One of them gets widened, nobody
 *     looks at the other, and a decision becomes an accident.
 *
 * Checked as SOURCE rather than as rendered CSS: a jsdom test cannot measure a
 * Tailwind class, and what actually goes wrong here is somebody editing one
 * file and not its partner.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

// Block, line, and JSX `{/* */}` comments. Needed wherever a file DOCUMENTS the
// bad value it used to hold — otherwise the explanation trips the check that
// the explanation exists to justify.
const stripComments = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

// The class as written in the markup, not the pixel value. The pixel value is
// the token's business and is meant to be changed in one place.
const SHELL = /max-w-page/

const SURFACES = {
  'the property page skeleton': 'src/pages/PropertyPage.jsx',
  'the property page itself': 'src/features/properties/components/detail/PropertyDetailBody.jsx',
  'Services': 'src/pages/ServicesPage.jsx',
  'Guides': 'src/pages/BlogPage.jsx',
}

describe('every card-grid page uses the shared shell', () => {
  for (const [name, file] of Object.entries(SURFACES)) {
    it(name, () => {
      expect(read(file), `${file} no longer uses max-w-page`).toMatch(SHELL)
    })
  }

  it('none of them has slipped back to a literal shell width', () => {
    // max-w-7xl is what they all were. A reintroduced literal is not an error
    // anywhere else in the app — it is one HERE, because these four move
    // together or they do not move at all.
    //
    // PropertyDetailBody is read from its PUBLIC section only: its admin
    // variant keeps max-w-7xl deliberately, and a whole-file match would flag
    // that forever. The narrower read is the honest one — and the next test
    // is what stops the admin half being "fixed" by mistake.
    for (const [name, file] of Object.entries(SURFACES)) {
      const src = read(file)
      const scoped = src.includes('Public variant') ? src.slice(src.indexOf('Public variant')) : src
      expect(scoped, `${name} reintroduced a literal shell width`).not.toMatch(/mx-auto max-w-7xl|max-w-7xl mx-auto/)
    }
  })
})

describe('the token exists and is a real width', () => {
  const config = read('tailwind.config.js')

  it('is defined in the theme, not invented in the markup', () => {
    // A Tailwind class with no matching token silently produces NO CSS. The
    // page would render full-bleed and nothing would say why.
    expect(config).toMatch(/maxWidth:\s*\{[\s\S]*?page:/)
  })

  it('is wider than the max-w-7xl it replaced', () => {
    const px = Number(/page:\s*'(\d+)px'/.exec(config)?.[1])
    expect(px).toBeGreaterThan(1280)
    // Not full-bleed either: these are card grids, and past roughly this width
    // a four-up row on a 2560px monitor puts a metre between first and last.
    expect(px).toBeLessThan(1920)
  })
})

describe('the pages that start beneath the fixed header', () => {
  // Same failure as the shell widths above, on the vertical axis, and it had
  // already happened: HomePage said `pt-[132px] md:pt-[166px]` and
  // PropertiesPage `pt-[132px] md:pt-40` for ONE header that measures 134/142.
  // The homepage carried a 24px band between the filter bar and the top of the
  // map, /properties an 18px one, and both tucked 2px under it on mobile.
  //
  // Nothing could have caught it while the numbers were literals — they were
  // written once and the header's controls were resized later, in a third
  // file. Header.jsx now measures the element and publishes --header-h.
  const UNDER_HEADER = {
    'the homepage': 'src/pages/HomePage.jsx',
    'the properties grid': 'src/pages/PropertiesPage.jsx',
  }

  for (const [name, file] of Object.entries(UNDER_HEADER)) {
    it(`${name} takes its offset from the measured header`, () => {
      expect(read(file), `${file} should use var(--header-h)`).toMatch(/pt-\[var\(--header-h\)\]/)
    })

    it(`${name} has not gone back to a hand-written offset`, () => {
      // Any literal top padding on these two is the bug returning, whether it
      // is a pixel value or a spacing step. Both forms shipped.
      //
      // Read from the MARKUP, not the file: both pages name the old values in
      // a comment explaining what went wrong, and a whole-file match flags the
      // explanation as the offence. Same reasoning as
      // backend/tests/enum-config-parity.test.js's `strip`.
      const src = stripComments(read(file))
      expect(src, `${name} hardcodes a px top offset`).not.toMatch(/pt-\[\d+px\]/)
      expect(src, `${name} hardcodes a step top offset`).not.toMatch(/\bmd:pt-\d+\b/)
    })
  }

  it('the header actually publishes the variable', () => {
    // The consumers above render with NO top padding if this stops happening —
    // the map would slide under the header rather than leaving a gap, which is
    // the louder failure but still one nothing else checks.
    const header = read('src/components/layout/Header.jsx')
    expect(header).toMatch(/setProperty\('--header-h'/)
    expect(header, 'the measurement must survive a resize').toMatch(/ResizeObserver/)
  })

  it('and the stylesheet carries a fallback for the first frame', () => {
    expect(read('src/index.css')).toMatch(/--header-h:\s*\d+px/)
  })
})

describe('an article shares the shell but not the measure', () => {
  // This test used to read: assert BlogPostPage contains `max-w-3xl` and NEVER
  // `max-w-page`, on the grounds that "line length has an optimum and it is
  // nowhere near 1560px — widening it would be a regression dressed as
  // consistency."
  //
  // That reasoning is correct and is preserved below. What was wrong was the
  // PROXY: it guarded the reading measure by forbidding a shell class, so the
  // two could only ever move together. On 2026-08-11 the shell was widened to
  // match Guides — the frame no longer jumps inward when you open an article —
  // while the prose stayed at 68ch and the freed width went to the cover, the
  // related-posts grid and the CTA, none of which are prose.
  //
  // So the invariant is now asserted directly. A future change that stretches
  // the text still fails; one that widens the frame around it does not.
  const post = () => read('src/pages/BlogPostPage.jsx')

  it('uses the shared shell, so the page frame matches Guides', () => {
    expect(post()).toMatch(SHELL)
  })

  it('still caps the PROSE at a reading measure', () => {
    // The thing that actually matters, and it survived the measure being
    // WIDENED (68ch → 90ch, 2026-08-11). The number is the operator's to
    // choose; that there is a cap at all is not.
    const src = stripComments(post())
    expect(src, 'the article must cap its prose').toMatch(/max-w-measure/)
    expect(read('src/features/blog/components/ArticleBody.jsx')).toMatch(/max-w-measure/)
  })

  it('measures in CHARACTERS, not in pixels or viewport fractions', () => {
    // The regression the original test was written to prevent, stated as
    // itself. A measure in px stops tracking the font; a measure in vw or a
    // fraction of the shell is not a measure at all.
    const config = read('tailwind.config.js')
    expect(config, 'the measure must be defined in ch').toMatch(/measure:\s*'\d+ch'/)
    const ch = Number(/measure:\s*'(\d+)ch'/.exec(config)?.[1])
    // Generous is fine; unbounded is not. Past ~100 characters the return sweep
    // fails often enough that people stop reading, which is the actual cost.
    expect(ch).toBeGreaterThan(50)
    expect(ch).toBeLessThanOrEqual(100)
  })

  it('keeps the reading group narrower than the shell', () => {
    // The group is measure + gap + sidebar. Delete the cap and it inherits the
    // full 1560, and the sidebar drifts hundreds of px from the text it belongs
    // to — which is what `justify-between` used to do.
    expect(stripComments(post())).toMatch(/max-w-reading/)
    expect(read('tailwind.config.js'), 'the group must be derived from the measure, not a second literal')
      .toMatch(/reading:\s*'calc\(\d+ch\s*\+/)
  })

  it('derives the group from the SAME number as the measure', () => {
    // Two literals that must agree with nothing making them agree is exactly
    // how `max-w-page` came to need a test. If these drift, the prose column
    // and its container disagree and the sidebar shifts.
    const config = read('tailwind.config.js')
    const measure = /measure:\s*'(\d+)ch'/.exec(config)?.[1]
    const inGroup = /reading:\s*'calc\((\d+)ch/.exec(config)?.[1]
    expect(inGroup, 'reading: does not start from measure:').toBe(measure)
  })

  it('the admin property view stays inside its own column', () => {
    // PropertyDetailBody's admin variant renders in the panel's 5fr column,
    // which never reaches either width. Widening it would change nothing and
    // imply the two variants are meant to match.
    const body = read('src/features/properties/components/detail/PropertyDetailBody.jsx')
    const admin = body.slice(body.indexOf('Admin variant'), body.indexOf('Public variant'))
    expect(admin).toMatch(/max-w-7xl/)
  })
})
