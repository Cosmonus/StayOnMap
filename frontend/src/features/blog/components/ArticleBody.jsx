import { Link } from 'react-router-dom'
import { parseBlocks, parseInline } from '../markdown'

// Renders the parsed blocks as React elements. No HTML string is ever built,
// so there is no `dangerouslySetInnerHTML` here and nothing to sanitise.
//
// Typography follows the ladder in .claude/ui-ux.md — h2 is Heading 3 (24),
// h3 is Heading 5 (18), body is Body (15/16) at 150% line height. Prose gets a
// max width because a 1,400px-wide line of text is unreadable regardless of
// how good the writing is; ~68 characters is the usual comfortable measure.

function Inline({ text }) {
  return parseInline(text).map((node, i) => {
    if (typeof node === 'string') return node

    if (node.kind === 'strong') return <strong key={i} className="font-semibold text-slate-800">{node.text}</strong>
    if (node.kind === 'em') return <em key={i}>{node.text}</em>
    if (node.kind === 'code') {
      return (
        <code key={i} className="font-mono text-[13px] bg-slate-100 text-slate-800 rounded-lg px-1.5 py-0.5">
          {node.text}
        </code>
      )
    }

    // Internal links stay in the SPA — a full page reload to reach another
    // article throws away the router and the query cache for no reason.
    // External ones open in a new tab with `noopener`, and are NOT nofollowed:
    // these are genuine citations to authoritative sources, which is exactly
    // the link a search engine should be allowed to follow.
    const internal = node.href.startsWith('/')
    if (internal) {
      return (
        <Link key={i} to={node.href} className="text-brand-700 underline underline-offset-2 hover:text-brand-600">
          {node.text}
        </Link>
      )
    }
    return (
      <a
        key={i}
        href={node.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-700 underline underline-offset-2 hover:text-brand-600"
      >
        {node.text}
      </a>
    )
  })
}

export default function ArticleBody({ markdown }) {
  const blocks = parseBlocks(markdown)

  return (
    <div className="max-w-measure">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2':
            return (
              <h2
                key={i}
                id={b.id}
                // scroll-mt clears the fixed header when arriving via an anchor,
                // otherwise the heading lands underneath it.
                className="scroll-mt-24 text-2xl font-bold text-slate-800 leading-tight mt-12 mb-4 first:mt-0"
              >
                <Inline text={b.text} />
              </h2>
            )

          case 'h3':
            return (
              <h3 key={i} id={b.id} className="scroll-mt-24 text-lg font-semibold text-slate-800 leading-tight mt-8 mb-3">
                <Inline text={b.text} />
              </h3>
            )

          case 'p':
            return (
              <p key={i} className="text-base text-slate-600 leading-relaxed mb-5">
                <Inline text={b.text} />
              </p>
            )

          case 'ul':
            return (
              <ul key={i} className="mb-5 space-y-2">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-base text-slate-600 leading-relaxed">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />
                    <span><Inline text={item} /></span>
                  </li>
                ))}
              </ul>
            )

          case 'ol':
            return (
              <ol key={i} className="mb-5 space-y-2">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-base text-slate-600 leading-relaxed">
                    <span aria-hidden="true" className="shrink-0 font-mono text-sm font-semibold text-brand-700 min-w-[1.5rem]">
                      {j + 1}.
                    </span>
                    <span><Inline text={item} /></span>
                  </li>
                ))}
              </ol>
            )

          case 'quote':
            return (
              <blockquote key={i} className="my-8 border-l-4 border-brand-600 bg-brand-50 rounded-r-xl px-5 py-4">
                <p className="text-base text-slate-700 leading-relaxed"><Inline text={b.text} /></p>
              </blockquote>
            )

          case 'table':
            return (
              // Wide content scrolls inside its own container — the page body
              // must never scroll horizontally on a 375px screen.
              <div key={i} className="my-8 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
                <table className="w-full min-w-[480px] border-collapse text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j} className="px-4 py-3 text-sm font-semibold text-slate-800 border-b border-slate-200">
                          <Inline text={h} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j} className="border-b border-slate-100 last:border-0">
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-3 text-sm text-slate-600 align-top">
                            <Inline text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )

          case 'hr':
            return <hr key={i} className="my-10 border-slate-200" />

          default:
            return null
        }
      })}
    </div>
  )
}
