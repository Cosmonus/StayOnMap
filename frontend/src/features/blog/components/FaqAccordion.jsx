import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * The article's FAQ.
 *
 * The answers are ALWAYS in the DOM — `hidden` toggles visibility rather than
 * conditionally rendering. Two reasons, and the second one is the load-bearing
 * one: the page carries `FAQPage` structured data for exactly these questions,
 * and Google's policy requires marked-up content to be present on the page.
 * Mounting an answer only after a click makes the markup a claim about content
 * that is not there.
 *
 * The first one starts open so the pattern is obvious without a click.
 */
export default function FaqAccordion({ items }) {
  const [openIdx, setOpenIdx] = useState(0)

  if (!items?.length) return null

  return (
    <section aria-labelledby="faq-heading" className="mt-14">
      <h2 id="faq-heading" className="scroll-mt-24 text-2xl font-bold text-slate-800 mb-5">
        Frequently asked questions
      </h2>

      <div className="divide-y divide-slate-200 rounded-2xl ring-1 ring-slate-200 bg-white">
        {items.map((item, i) => {
          const open = openIdx === i
          return (
            <div key={i}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? -1 : i)}
                  aria-expanded={open}
                  aria-controls={`faq-answer-${i}`}
                  className="flex w-full min-h-[44px] items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl"
                >
                  <span className="text-base font-semibold text-slate-800">{item.q}</span>
                  <ChevronDown
                    size={20}
                    aria-hidden="true"
                    className={`shrink-0 text-slate-500 transition-transform duration-fast ${open ? 'rotate-180' : ''}`}
                  />
                </button>
              </h3>
              <div id={`faq-answer-${i}`} hidden={!open} className="px-5 pb-5 -mt-1">
                <p className="text-base text-slate-600 leading-relaxed">{item.a}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
