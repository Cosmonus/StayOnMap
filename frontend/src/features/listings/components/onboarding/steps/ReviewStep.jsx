import { ImageIcon } from 'lucide-react'
import { formatCurrency } from '@utils/format'
import { CATEGORIES, DESCRIBE, pricingRows, resolveMode } from '../../../config/onboarding.js'
import PublishGate from '../PublishGate'
import { StepHead } from '../WizardChrome'

// Step 6 — how it will read on the map, what is still missing, and the one
// or two personal details we have deliberately not asked for until now.

function Row({ label, value, onEdit }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-4 border-b border-slate-100">
      <span className="text-sm text-slate-500 w-28 shrink-0">{label}</span>
      <span className="flex-1 text-sm font-medium text-slate-900 min-w-0">{value}</span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
      >
        Edit
      </button>
    </div>
  )
}

// The renter's view of the same data. An owner who can see how thin their
// listing looks fixes it here, not after nobody enquires.
function RenterPreview({ categoryKey, draft, priceLabel, price }) {
  const cat = CATEGORIES[categoryKey]
  const describeValue = draft.fields[DESCRIBE[categoryKey].k]
  const specs = [
    categoryKey === 'apartment' ? `${describeValue ?? '—'} BHK` : describeValue,
    draft.fields.furnished && { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }[draft.fields.furnished],
    draft.fields.area && `${draft.fields.area} sq.ft`,
    draft.fields.carpetArea && `${draft.fields.carpetArea} sq.ft carpet`,
    draft.fields.extent && `${draft.fields.extent} ${draft.fields.extentUnit || 'sq.ft'}`,
  ].filter(Boolean)

  return (
    <div>
      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">How renters will see it</p>
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <div className="aspect-[16/10] bg-slate-100 flex items-center justify-center">
          {draft.images[0]
            ? <img src={draft.images[0]} alt="" className="w-full h-full object-cover" />
            : <ImageIcon size={28} className="text-slate-500" strokeWidth={1.6} aria-hidden="true" />}
        </div>
        <div className="p-4">
          <p className="font-mono font-bold text-xl text-slate-900">
            {price ? formatCurrency(price) : '—'}
            <span className="text-sm font-normal text-slate-500">{priceLabel}</span>
          </p>
          <p className="text-sm font-semibold text-slate-900 mt-1">{draft.title || `New ${cat.label} listing`}</p>
          <p className="text-sm text-slate-500 mt-0.5">{specs.join(' · ') || cat.long}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {['DRAFT', 'PENDING', 'ACTIVE'].map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {/* eslint-disable-next-line no-restricted-syntax -- aria-hidden breadcrumb separator, not text */}
            {i > 0 && <span className="text-slate-300" aria-hidden="true">›</span>}
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${i <= 1 ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{s}</span>
          </span>
        ))}
      </div>
      <p className="text-sm text-slate-500 mt-3 leading-relaxed">
        We review every listing before it goes on the map — usually within a few hours.
      </p>
    </div>
  )
}

export default function ReviewStep({ categoryKey, draft, missing, onJump, profile }) {
  const cat = CATEGORIES[categoryKey]
  const mode = resolveMode(categoryKey, draft)
  const [priceKey, priceRowLabel] = pricingRows(categoryKey, mode)[0]
  const price = Number(draft.pricing[priceKey] || 0)
  // Mirrors utils/format.js's priceUnit, from the draft rather than a saved
  // property: nothing may suffix this number without knowing the mode.
  const priceLabel = categoryKey === 'stay' ? '/night' : mode === 'SALE' ? '' : mode === 'LEASE' ? ' lease' : '/mo'
  const describeValue = draft.fields[DESCRIBE[categoryKey].k]
  const missingProfile = profile?.missingProfileFields ?? []

  const amenities = draft.amenityNames.length
    ? draft.amenityNames.slice(0, 3).join(', ') + (draft.amenityNames.length > 3 ? ` +${draft.amenityNames.length - 3}` : '')
    : 'None selected'

  const rows = [
    ['Type', [cat.short, describeValue ?? '—'].join(' · '), 'basics'],
    ['Location', [draft.location.address, draft.location.city, draft.location.pincode].filter(Boolean).join(', ') || '—', 'location'],
    ['Photos', draft.images.length ? `${draft.images.length} photos · cover set` : 'None yet', 'photos'],
    ['Amenities', amenities, 'features'],
    [priceRowLabel, price ? `${formatCurrency(price)}${priceLabel}` : '—', 'pricing'],
  ]

  return (
    <div>
      <StepHead
        title="Check it over, then publish"
        sub="This is how it will read on the map. Anything we still need is called out below."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10">
        <div>
          {missing.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="text-sm font-bold text-amber-900 mb-3">
                {missing.length} {missing.length === 1 ? 'thing' : 'things'} left before publish
              </p>
              <div className="flex flex-wrap gap-2">
                {missing.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onJump(m.stepK)}
                    className="px-3.5 py-1.5 rounded-full text-sm font-medium bg-white border border-amber-200 text-amber-900 hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
                  >
                    {m.label} →
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            {rows.map(([label, value, stepK]) => (
              <Row key={label} label={label} value={value} onEdit={() => onJump(stepK)} />
            ))}
          </div>

          {missingProfile.length > 0 && (
            <div className="mt-6">
              <PublishGate missing={missingProfile} profile={profile} />
            </div>
          )}
        </div>

        <RenterPreview categoryKey={categoryKey} draft={draft} priceLabel={priceLabel} price={price} />
      </div>
    </div>
  )
}
