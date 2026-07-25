import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import ModuleDetailModal from './ModuleDetailModal'
import { factIcon } from '../factIcons'
import { MODULE_META, BAND_LABEL } from '../meta'

// One spatial intelligence module, as a summary card that opens its full report.
//
// Generic by design: every module returns the same envelope
// (backend/src/features/spatial/envelope.js), so adding Cost of Living later is
// a backend-only change. Nothing here knows what a metro station is.
//
// The card answers one question in one shape, top to bottom:
//
//   Getting around                      ← which question this is (quiet)
//   Car or auto needed to reach metro   ← the answer (loud)
//   Nearest metro     Koyambedu 12.5 km ← the evidence
//   Bus stops         None within 800 m
//   Moderate · what we don't know       ← how much to trust it
//
// Two things were cut to get here, both duplication rather than content:
// the module's question-prompt ("Could you live here without a car?"), which
// restated the title while the answer sat directly beneath it, and the
// assessment's `detail` prose, which re-narrates the very measurements listed
// under it ("Nearest station is 12563 m away. No bus stop within 800 m."). Both
// still show in the report, where there's room for them.
//
// What is NOT cut, and must not be: the assessment, the confidence band, and
// the marker that something is unknown. A finding shown with no sign of how
// examined it is reads as far more certain than it is, so those three travel
// together or not at all.

// Three fills the card without turning it into the report it links to.
const PREVIEW_FACTS = 3

export default function ModuleCard({ envelope, coords }) {
  const [open, setOpen] = useState(false)
  const meta = MODULE_META[envelope.key] ?? { title: envelope.key, Icon: null }
  const band = BAND_LABEL[envelope.confidence?.band]
  const { Icon } = meta
  const preview = envelope.facts.slice(0, PREVIEW_FACTS)
  const hasMissing = envelope.missing?.length > 0

  // A module that couldn't run has no assessment. Its own `missing` notes take
  // the answer's place — all of them, not just the first. That is what keeps
  // the card from reading as broken: "we haven't loaded this city's data yet,
  // and broadband speed is never available" is a real answer, where one short
  // line above a stretch of blank card is not. This is the normal state for
  // infrastructure in a city whose POIs haven't been fetched.
  const hasAnswer = Boolean(envelope.assessment?.label)

  return (
    <>
      {/* A div, not a button: the card contains a heading and a description
          list, which are flow content and not legal inside <button>. The
          overlay button below keeps the whole card clickable while leaving the
          h3 in the document outline where screen readers can navigate to it. */}
      <div
        id={`spatial-module-${envelope.key}`}
        className="group relative flex h-full scroll-mt-24 flex-col rounded-2xl border border-slate-100 bg-white p-5 transition-all hover:border-brand-200 hover:shadow-card focus-within:ring-2 focus-within:ring-brand-500"
      >

        {/* Which question this card answers — a quiet eyebrow, so the answer
            below is the only bold thing competing for the eye. */}
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden="true" />}
          <h3 className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {meta.title}
          </h3>
          <ChevronRight
            className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-brand-600"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>

        {/* The answer. Deliberately uncoloured — the envelope carries no
            good/bad tone, and tinting it here would be this component inventing
            the judgement the backend declined to make. */}
        {hasAnswer && (
          <p className="mt-2.5 text-[15px] font-bold leading-snug text-slate-900">
            {envelope.assessment.label}
          </p>
        )}

        {!hasAnswer && hasMissing && (
          <ul className="mt-2.5 space-y-1.5">
            {envelope.missing.map((note, i) => (
              <li key={i} className="flex gap-1.5 text-xs leading-snug text-slate-500">
                <span aria-hidden="true" className="shrink-0 text-slate-300">·</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        )}

        {preview.length > 0 && (
          <div className="mt-4 space-y-2">
            {preview.map((f) => {
              const FIcon = factIcon(f.key)
              return (
                <div key={f.key} className="flex items-start gap-2.5">
                  <FIcon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2} aria-hidden="true" />
                  {/* flex-wrap, not a fixed two-column split: a short pair sits
                      on one line with the value right-aligned, while a long one
                      ("Lines served" / "Green Line: Chennai Central — St.
                      Thomas Mount") drops the value onto its own line instead
                      of crushing the label into a two-word column. */}
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="text-[11px] text-slate-500">{f.label}</span>
                    <span className="ml-auto text-right text-[11px] font-semibold text-slate-700">
                      {f.display}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* mt-auto pins the footer to the card's base so the confidence line and
            the report link stay aligned across a grid row of cards. */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          {band ? (
            <span className={`text-[11px] ${band.cls}`}>
              {band.text}
              {hasMissing && <> · what we don&apos;t know</>}
            </span>
          ) : <span />}
          <span className="shrink-0 text-[11px] font-semibold text-brand-600 group-hover:underline">
            Full report
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-0 z-10 rounded-2xl focus:outline-none"
        >
          <span className="sr-only">View the full {meta.title} report</span>
        </button>
      </div>

      <ModuleDetailModal envelope={envelope} isOpen={open} onClose={() => setOpen(false)} coords={coords} />
    </>
  )
}
