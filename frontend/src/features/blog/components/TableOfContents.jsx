import { tableOfContents } from '../markdown'

/**
 * Section links, built from the article's own h2s so it can never list a
 * section that was renamed or removed.
 *
 * Rendered inline above the article on every breakpoint rather than as a
 * sticky sidebar: the property page already learned that a sticky column
 * taller than the viewport pins on contact and strands everything below it
 * (see .claude/ui-ux.md), and a 2,500-word guide has more sections than a
 * listing has cards.
 */
export default function TableOfContents({ markdown }) {
  const items = tableOfContents(markdown)

  // Under four sections it is not navigation, it is a list of the article.
  if (items.length < 4) return null

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
