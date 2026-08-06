import { Link } from 'react-router-dom'

/**
 * Shared chrome for long-form legal documents (Privacy Policy, Terms of Service).
 * Renders a light header, a jump-to table of contents, and a closing contact CTA
 * around whatever numbered <Section> children are passed in.
 */
export function LegalPageLayout({ title, lastUpdated, sections, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-16" />

      {/* Header */}
      <section className="bg-white border-b border-slate-200 px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
            {title}
          </h1>
          <p className="text-sm text-slate-500">Last updated: {lastUpdated}</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Table of contents */}
        <nav className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">On this page</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {sections.map(({ id, label }, i) => (
              <li key={id}>
                <a href={`#${id}`} className="text-sm text-slate-600 hover:text-brand-600 transition-colors no-underline">
                  {i + 1}. {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Body */}
        <div className="flex flex-col gap-10">
          {children}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 rounded-2xl bg-[#111111] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-1">
            <h3 className="font-display font-bold text-base text-white mb-1">Questions about this document?</h3>
            {/* eslint-disable-next-line no-restricted-syntax -- the #111111 legal CTA card — slate-400 is ~8:1 on it, and correct */}
            <p className="text-sm text-slate-400 leading-relaxed">
              Reach out and we will get back to you.
            </p>
          </div>
          <Link
            to="/contact"
            className="min-h-[44px] shrink-0 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors no-underline whitespace-nowrap"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  )
}

export function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="font-display font-bold text-lg text-slate-900 mb-3">{title}</h2>
      <div className="text-sm text-slate-600 leading-relaxed flex flex-col gap-3">
        {children}
      </div>
    </section>
  )
}

/** Highlights a fact that must be confirmed/replaced before this document is legally reliable. */
export function Placeholder({ children }) {
  return (
    <span className="inline bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
      {children}
    </span>
  )
}
