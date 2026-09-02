import Toggle from '@components/common/Toggle'
import Select from '@components/common/Select'
import { pricingRows, termRows, pricingModes, resolveMode, MODE_COPY } from '../../../config/onboarding.js'
import AvailabilityCalendar from '../AvailabilityCalendar'
import BenchmarkCard from '../BenchmarkCard'
import { StepHead } from '../WizardChrome'
import { FieldLabel, Txt } from '../FieldControl'
import TimeSelect from '@components/common/TimeSelect'
import { VISIT_SLOTS } from '@utils/time'

// Property.visitContactMethod — the same three values the API's Zod enum
// accepts (VISIT_CONTACT_METHODS in properties.validation.js).
const VISIT_CONTACT_OPTIONS = [
  { value: 'CALL', label: 'Phone call' },
  { value: 'WHATSAPP', label: 'WhatsApp message' },
  { value: 'CHAT', label: 'Message in the app' },
]

// Step 5 — price, and the terms that go with it, with the locality benchmark
// beside the field rather than after publishing.

function Money({ label, value, onChange, ph }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono font-semibold text-slate-500">₹</span>
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={ph}
          inputMode="numeric"
          aria-label={label}
          className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 font-mono text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500"
        />
      </div>
    </div>
  )
}

export default function PriceStep({ categoryKey, draft, setDraft }) {
  // Land's mode comes from its own "Sale or lease?" answer on step 1, so it
  // gets no picker here — see resolveMode().
  const mode = resolveMode(categoryKey, draft)
  const modes = pricingModes(categoryKey)
  const isLease = mode === 'LEASE'
  const isSale = mode === 'SALE'
  const isStay = categoryKey === 'stay'
  const rows = pricingRows(categoryKey, mode)
  const terms = termRows(categoryKey, mode)

  const setPrice = (k, v) => setDraft((d) => ({ ...d, pricing: { ...d.pricing, [k]: v } }))
  const setTerm = (k, v) => setDraft((d) => ({ ...d, terms: { ...d.terms, [k]: v } }))
  // Switching modes clears the money fields AND the terms: the rows differ
  // between modes, so a ₹28,000 monthly rent left behind in `rent` would
  // silently become a ₹28,000 asking price, and an 11-month minimum stay would
  // ride along onto a sale.
  const setMode = (pricingModel) => setDraft((d) => ({ ...d, pricingModel, pricing: {}, terms: {} }))

  return (
    <div>
      <StepHead
        title={isSale ? 'Set your asking price' : 'Set your price'}
        sub="Priced with the locality beside you, not after you publish."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        <div className="space-y-6">
          {modes.length > 1 && (
            <div>
              <FieldLabel>How are you offering it?</FieldLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
                {modes.map((value) => {
                  const m = MODE_COPY[value]
                  const active = mode === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      aria-pressed={active}
                      className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${active ? 'text-brand-700' : 'text-slate-700'}`}>{m.label}</span>
                      <span className="text-xs text-slate-500 leading-tight">{m.hint}</span>
                    </button>
                  )
                })}
              </div>
              {isLease && (
                <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-md">
                  You&apos;ll hold the lease amount for the full term and return it when the tenant leaves.
                  No monthly rent and no separate deposit.
                </p>
              )}
              {isSale && (
                <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-md">
                  Buyers request a site visit the same way renters do. A sale has no rent, no
                  deposit and no lease agreement — only the advance you take to hold it.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {rows.map(([key, label, ph], i) => (
              <div key={key} className={i === 0 ? 'sm:col-span-2' : ''}>
                <Money label={label} value={draft.pricing[key]} onChange={(v) => setPrice(key, v)} ph={ph} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {terms.map((t) => (
              <div key={t.k}>
                {t.t === 'bool' ? (
                  <div className="flex items-center justify-between gap-4 h-full py-3 px-4 rounded-xl bg-slate-50">
                    <span className="text-sm text-slate-700">{t.label}</span>
                    <Toggle checked={!!draft.terms?.[t.k]} onChange={(v) => setTerm(t.k, v)} />
                  </div>
                ) : (
                  <>
                    <FieldLabel>{t.label}</FieldLabel>
                    {t.t === 'seg' ? (
                      <Select
                        value={draft.terms?.[t.k]}
                        onChange={(v) => setTerm(t.k, v)}
                        options={t.opts.map(([value, label]) => ({ value, label }))}
                        placeholder="Select…"
                      />
                    ) : (
                      <Txt
                        type={t.t === 'date' ? 'date' : 'text'}
                        value={draft.terms?.[t.k]}
                        onChange={(v) => setTerm(t.k, t.t === 'num' ? v.replace(/[^\d]/g, '') : v)}
                        ph={t.ph}
                        suf={t.suf}
                        label={t.label}
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {isStay ? (
            <div>
              <div className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-slate-50 max-w-md">
                <div>
                  <p className="text-sm font-medium text-slate-800">Instant book</p>
                  <p className="text-xs text-slate-500 mt-0.5">Guests can book without waiting for approval</p>
                </div>
                <Toggle checked={!!draft.instantBook} onChange={(v) => setDraft((d) => ({ ...d, instantBook: v }))} />
              </div>
              <AvailabilityCalendar
                blockedDates={draft.blockedDates}
                onChange={(dates) => setDraft((d) => ({ ...d, blockedDates: dates }))}
              />
            </div>
          ) : (
            <div>
              <FieldLabel>{isSale ? 'When can buyers visit?' : 'When can renters visit?'}</FieldLabel>
              {/* The two ends constrain each other, so an inverted window is
                  unpickable rather than rejected at Publish four steps later.
                  Moving the start past the end CLEARS the end rather than
                  silently nudging it — an owner who set 6 PM did mean 6 PM, and
                  quietly rewriting it is worse than asking again. */}
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <TimeSelect
                  label="Visits from" placeholder="From" slots={VISIT_SLOTS}
                  before={draft.appointmentWindowEnd || undefined}
                  value={draft.appointmentWindowStart}
                  onChange={(v) => setDraft((d) => ({
                    ...d,
                    appointmentWindowStart: v,
                    appointmentWindowEnd: d.appointmentWindowEnd && v >= d.appointmentWindowEnd ? '' : d.appointmentWindowEnd,
                  }))}
                />
                <TimeSelect
                  label="Visits until" placeholder="Until" slots={VISIT_SLOTS}
                  after={draft.appointmentWindowStart || undefined}
                  value={draft.appointmentWindowEnd}
                  onChange={(v) => setDraft((d) => ({ ...d, appointmentWindowEnd: v }))}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                We offer {isSale ? 'buyers' : 'renters'} slots inside this window.
              </p>
            </div>
          )}

          {/* Same question the WhatsApp bot asks last; the booking form shows
              the answer beside the slot picker. Every type — a stay's guests
              also need to know how to reach the host. */}
          <div className="max-w-md">
            <Select
              label={`How should ${isStay ? 'guests' : isSale ? 'buyers' : 'renters'} contact you to arrange a visit?`}
              placeholder="Choose one"
              value={draft.visitContactMethod || ''}
              onChange={(v) => setDraft((d) => ({ ...d, visitContactMethod: v }))}
              options={VISIT_CONTACT_OPTIONS}
            />
          </div>
        </div>

        <div className="space-y-4">
          <BenchmarkCard categoryKey={categoryKey} draft={draft} />

          <div className="p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-slate-900">Zero brokerage</p>
              <Toggle
                checked={draft.zeroBrokerage !== false}
                onChange={(v) => setDraft((d) => ({ ...d, zeroBrokerage: v, brokerage: v ? '' : d.brokerage }))}
              />
            </div>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Shown as a badge on your listing. Turn it off only if you charge a fee.
            </p>
            {draft.zeroBrokerage === false && (
              <div className="mt-4">
                <Money
                  label="Brokerage you charge"
                  value={draft.brokerage}
                  onChange={(v) => setDraft((d) => ({ ...d, brokerage: v }))}
                  ph="15000"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
