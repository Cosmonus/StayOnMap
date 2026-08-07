// A deliberately small Markdown subset — block parsing only, no HTML.
//
// WHY NOT react-markdown. The renderer that consumes this produces React
// elements directly, so there is no HTML string anywhere and no
// `dangerouslySetInnerHTML` (which CLAUDE.md forbids outright). A full
// Markdown library would add a dependency and a raw-HTML escape hatch to
// support syntax our articles do not use. The input is not user content — it
// is a JSON file in our own repo — so the parser's job is layout, not
// sanitisation.
//
// Supported, because the articles need exactly this much:
//   ## / ###        section and sub-section headings (anchored, feed the TOC)
//   paragraphs      blank-line separated
//   - / 1.          unordered and ordered lists
//   >               blockquote (used for callouts and pull-quotes)
//   | a | b |       tables, for cost breakdowns and comparisons
//   ---             horizontal rule
//   **b** *i*       bold, italic
//   `code`          inline code
//   [text](url)     links, internal and external
//
// Anything else renders as literal text rather than silently vanishing. A
// swallowed line in a 3,000-word article is very hard to notice.

/** Stable, readable heading anchors — `## Hidden costs` → `hidden-costs`. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

const isTableRow = (l) => l.trim().startsWith('|') && l.trim().endsWith('|')
// The |---|---| separator under a table's header row.
const isTableDivider = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes('-')

const splitRow = (line) =>
  line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

/**
 * Markdown string → flat array of block descriptors.
 * @returns {Array<{type: string, [k: string]: unknown}>}
 */
export function parseBlocks(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let i = 0

  const flushParagraph = (buf) => {
    if (buf.length) blocks.push({ type: 'p', text: buf.join(' ').trim() })
    return []
  }

  let para = []

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line ends a paragraph.
    if (!trimmed) { para = flushParagraph(para); i++; continue }

    // Headings.
    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed)
    if (heading) {
      para = flushParagraph(para)
      const text = heading[2].trim()
      blocks.push({ type: heading[1].length === 2 ? 'h2' : 'h3', text, id: slugify(text) })
      i++
      continue
    }

    // Horizontal rule.
    if (/^-{3,}$/.test(trimmed)) {
      para = flushParagraph(para)
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Blockquote — consecutive `>` lines are ONE quote, so a multi-sentence
    // callout does not render as a stack of separate boxes.
    if (trimmed.startsWith('>')) {
      para = flushParagraph(para)
      const buf = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'quote', text: buf.join(' ').trim() })
      continue
    }

    // Table — a header row, a divider, then body rows.
    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      para = flushParagraph(para)
      const head = splitRow(lines[i])
      i += 2
      const rows = []
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', head, rows })
      continue
    }

    // Lists. Consecutive items of the SAME kind group into one list; a change
    // of kind starts a new one.
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed)
    if (bullet || numbered) {
      para = flushParagraph(para)
      const ordered = Boolean(numbered)
      const items = []
      while (i < lines.length) {
        const t = lines[i].trim()
        const b = /^[-*]\s+(.*)$/.exec(t)
        const n = /^\d+[.)]\s+(.*)$/.exec(t)
        if (ordered && n) items.push(n[1])
        else if (!ordered && b) items.push(b[1])
        else break
        i++
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items })
      continue
    }

    para.push(trimmed)
    i++
  }

  flushParagraph(para)
  return blocks
}

// Inline tokens, matched in one pass. Order inside the alternation is the
// precedence: code first so `**not bold**` inside backticks stays literal,
// then links (their text may contain asterisks), then bold before italic —
// `**x**` must not be read as an empty italic wrapping `*x*`.
const INLINE = /(`[^`]+`)|(\[[^\]]*\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)/g

/**
 * Inline markdown → an array of descriptors the renderer turns into elements.
 * Returns plain strings for literal runs, objects for everything else.
 */
export function parseInline(text) {
  const src = String(text ?? '')
  const out = []
  let last = 0

  for (const m of src.matchAll(INLINE)) {
    if (m.index > last) out.push(src.slice(last, m.index))
    const [tok] = m

    if (tok.startsWith('`')) {
      out.push({ kind: 'code', text: tok.slice(1, -1) })
    } else if (tok.startsWith('[')) {
      const link = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(tok)
      out.push({ kind: 'link', text: link[1], href: link[2] })
    } else if (tok.startsWith('**')) {
      out.push({ kind: 'strong', text: tok.slice(2, -2) })
    } else {
      out.push({ kind: 'em', text: tok.slice(1, -1) })
    }
    last = m.index + tok.length
  }

  if (last < src.length) out.push(src.slice(last))
  return out
}

/** Headings only — what the table of contents is built from. */
export function tableOfContents(markdown) {
  return parseBlocks(markdown)
    .filter((b) => b.type === 'h2')
    .map((b) => ({ id: b.id, text: b.text }))
}
