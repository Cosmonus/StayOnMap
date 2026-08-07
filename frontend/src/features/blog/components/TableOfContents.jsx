import { tableOfContents, hasTableOfContents } from '../markdown'

/**
 * Section links, built from the article's own h2s so it can never list a
 * section that was renamed or removed.
 *
 * Inline above the article below `lg`, and a sticky sidebar at `lg` and up —
 * BlogPostPage decides which, and mounts exactly one (this renders a `<nav>`
 * with a fixed id, so two copies would collide).
 *
 * The sticky half carries the property page's lesson with it: a sticky column
 * taller than the viewport pins on contact and strands everything below it
 * (see .claude/ui-ux.md), so the sidebar is height-capped. That is a backstop —
 * this list is h2s only and hides itself under four of them, so a 2,500-word
 * guide still produces a short list.
 */
export default function TableOfContents({ markdown }) {
  const items = tableOfContents(markdown)

  if (!hasTableOfContents(markdown)) return null

  return (
    <nav aria-labelledby="toc-heading" className="my-8 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-5">
      <h2 id="toc-heading" className="text-sm font-semibold text-slate-800 mb-3">
        What&apos;s in this guide
      </h2>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex gap-3 text-sm leading-relaxed">
            <span aria-hidden="true" className="font-mono text-xs font-semibold text-slate-500 min-w-[1.25rem]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <a
              href={`#${item.id}`}
              className="text-slate-600 underline-offset-2 hover:text-brand-700 hover:underline"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
