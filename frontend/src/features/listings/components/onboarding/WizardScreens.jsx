import { useQuery } from '@tanstack/react-query'
import { Check, Home } from 'lucide-react'
import Select from '@components/common/Select'
import Toggle from '@components/common/Toggle'
import ImageUploader from '../ImageUploader'
import LocationPicker from '../LocationPicker'
import FieldControl from './FieldControl'
import AvailabilityCalendar from './AvailabilityCalendar'
import { CATEGORIES, DESCRIBE, FIELDS, FEATURES, pricingRows, LEASE_CATEGORIES, VERIFY } from '../../config/onboarding.js'
import { CITIES, CITY_NAMES, CITY_LIST_LABEL } from '@/config/cities'
import { placesService } from '@services/places.service'

function Head({ kicker, title, sub }) {
  return (
    <div className="mb-7">
      {kicker && <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-3">{kicker}</p>}
      <h2 className="font-display font-bold text-2xl text-slate-900 tracking-tight leading-tight">{title}</h2>
      {sub && <p className="text-sm text-slate-500 leading-relaxed mt-3 max-w-lg">{sub}</p>}
    </div>
  )
}

function setField(setDraft) {
  return (key, value) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))
}

export function DescribeScreen({ categoryKey, draft, setDraft }) {
  const cat = CATEGORIES[categoryKey]
  const d = DESCRIBE[categoryKey]
  const value = draft.fields[d.k]
  return (
    <div>
      <Head kicker={cat.long} title={d.q} sub="This sets the shape of the rest of your listing." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
        {d.opts.map(([val, label, hint]) => {
          const on = value === val
          return (
            <button
              key={val}
              type="button"
              onClick={() => setField(setDraft)(d.k, val)}
              className={`text-left p-4 rounded-2xl border transition-colors flex flex-col gap-1 ${on ? 'bg-brand-50 border-brand-600' : 'bg-white border-slate-200 hover:border-slate-400'}`}
            >
              <span className="text-base font-bold text-slate-900">{label}</span>
              <span className="text-xs text-slate-500">{hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FieldsScreen({ categoryKey, draft, setDraft }) {
  return (
    <div>
      <Head title="A few key details" sub="These vary by property type — renters filter on exactly these." />
      {FIELDS[categoryKey].map((f) => (
        <FieldControl key={f.k} field={f} values={draft.fields} onChange={setField(setDraft)} />
      ))}
    </div>
  )
}

// What India Post says the typed pincode is — so a typo dies here, in front of
// the owner, instead of reaching a moderator after publish.
//
// Three states and a deliberate silence:
//   matches / no city   → the ground truth, quietly confirming
//   contradicts city    → amber warning naming BOTH places
//   unknown pincode     → amber, phrased as "double-check" — a typo is far more
//                         likely than fraud, and this line talks to the owner
//   directory unseeded  → nothing at all. "We cannot check" must never wear
//                         the clothes of a warning.
function PincodeTruth({ pincode, city }) {
  const valid = /^\d{6}$/.test(pincode ?? '')
  const { data } = useQuery({
    queryKey: ['pincode', pincode, city],
    queryFn: () => placesService.getPincode(pincode, city).then((r) => r.data),
    enabled: valid,
    staleTime: 24 * 60 * 60 * 1000, // pincodes change glacially
  })

  if (!valid || !data || !data.available) return null

  if (!data.found) {
    return (
      <p className="text-xs text-amber-700 mt-1.5">
        India Post has no pincode {pincode} — double-check for a typo.
      </p>
    )
  }

  const office = data.found.offices?.[0]?.name
  const place = `${data.found.districts.join('/')}, ${data.found.state}`

  if (data.matchesCity === false) {
    return (
      <p className="text-xs text-amber-700 mt-1.5">
        This pincode is in {place} — not {city}. Double-check before publishing.
      </p>
    )
  }

  return (
    <p className="text-xs text-slate-400 mt-1.5">
      {office ? `${office} — ` : ''}{place} (India Post)
    </p>
  )
}

export function LocationScreen({ draft, setDraft }) {
  const loc = draft.location
  function set(key, value) { setDraft((d) => ({ ...d, location: { ...d.location, [key]: value } })) }
  return (
    <div>
      <Head kicker="Shared · core" title="Where is it?" sub="Address and an exact pin. The pin is what places you on the StayOnMap map." />
      <div className="space-y-4 max-w-lg">
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Full address</p>
          <input value={loc.address} onChange={(e) => set('address', e.target.value)} placeholder="Door no, street, area" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400" />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1.5">City — live in {CITY_LIST_LABEL}</p>
            <Select
              value={loc.city}
              onChange={(city) => { set('city', city); set('state', CITIES.find((c) => c.name === city)?.state ?? '') }}
              placeholder="Select city"
              options={CITY_NAMES.map((n) => ({ value: n, label: n }))}
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1.5">Pincode</p>
            <input value={loc.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="600028" maxLength={6} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400" />
            <PincodeTruth pincode={loc.pincode} city={loc.city} />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Landmark (optional)</p>
          <input value={loc.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Near bus stop" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400" />
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1.5">Drop the pin</p>
          <LocationPicker value={loc.lat != null ? { lat: loc.lat, lng: loc.lng } : null} onChange={({ lat, lng }) => setDraft((d) => ({ ...d, location: { ...d.location, lat, lng } }))} />
        </div>
      </div>
    </div>
  )
}

export function FeaturesScreen({ categoryKey, draft, setDraft }) {
  const f = FEATURES[categoryKey]
  const selected = draft.amenityNames
  function toggle(name) {
    setDraft((d) => ({ ...d, amenityNames: selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name] }))
  }
  return (
    <div>
      <Head title={f.label} sub="Pick everything that applies. More detail means better matches." />
      <div className="flex flex-wrap gap-2 max-w-lg">
        {f.opts.map((name) => {
          const on = selected.includes(name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${on ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PhotosScreen({ draft, setDraft }) {
  return (
    <div>
      <Head kicker="Shared · core" title="Add some photos" sub="Add at least 5. The first is your cover — lead with the best light." />
      <div className="max-w-lg">
        <ImageUploader value={draft.images} onChange={(urls) => setDraft((d) => ({ ...d, images: urls }))} />
      </div>
    </div>
  )
}

export function TitleScreen({ draft, setDraft }) {
  return (
    <div>
      <Head title="Now, give it a title" sub="Short titles work best. You can always change it later." />
      <input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value.slice(0, 100) }))}
        placeholder="e.g. Sunlit 2BHK steps from the beach"
        className="w-full max-w-lg px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400"
      />
      <p className="text-xs text-slate-400 mt-2">{draft.title.length}/100 characters</p>
    </div>
  )
}

export function DescriptionScreen({ draft, setDraft }) {
  return (
    <div>
      <Head title="Create your description" sub="Tell renters what makes it special and what's nearby." />
      <textarea
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        rows={5}
        placeholder="Describe the space, the light, the neighbourhood…"
        className="w-full max-w-xl px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400 resize-none leading-relaxed"
      />
    </div>
  )
}

export function PricingScreen({ categoryKey, draft, setDraft }) {
  const isLease = draft.pricingModel === 'LEASE'
  const rows = pricingRows(categoryKey, draft.pricingModel)
  const isStay = categoryKey === 'stay'
  const canLease = LEASE_CATEGORIES.includes(categoryKey)
  function set(key, value) { setDraft((d) => ({ ...d, pricing: { ...d.pricing, [key]: value } })) }
  // Switching modes clears the money fields: the rows differ between modes and
  // a ₹28,000 monthly rent left behind in `rent` would silently become a
  // ₹28,000 lease amount.
  function setMode(pricingModel) { setDraft((d) => ({ ...d, pricingModel, pricing: {} })) }
  return (
    <div>
      <Head kicker={isStay ? 'Nightly' : 'Pricing'} title="Now, set your price" sub={isStay ? 'Your nightly rate plus fees — the calendar is unique to short-stay.' : 'Category-specific — land shows a sale price, PG a per-bed rate, commercial a lock-in.'} />
      {canLease && (
        <div className="mb-7 max-w-lg">
          <p className="text-xs font-semibold text-slate-700 mb-2">How are you offering it?</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'RENT', label: 'Monthly rent', hint: 'Tenant pays every month' },
              { value: 'LEASE', label: 'Lease', hint: 'One lump sum, returned when they leave' },
            ].map((m) => {
              const active = (draft.pricingModel ?? 'RENT') === m.value
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    active ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`text-sm ${active ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'}`}>{m.label}</span>
                  <span className="text-[11px] text-slate-400 leading-tight">{m.hint}</span>
                </button>
              )
            })}
          </div>
          {isLease && (
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              You&apos;ll hold the lease amount for the full term and return it when the tenant
              leaves. No monthly rent and no separate deposit.
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-4 max-w-lg">
        {rows.map(([key, label, ph]) => (
          <div key={key} className="flex-1 min-w-[150px]">
            <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono font-semibold text-slate-400">₹</span>
              <input
                value={draft.pricing[key] ?? ''}
                onChange={(e) => set(key, e.target.value)}
                placeholder={ph}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 font-mono text-sm outline-none focus:border-slate-400"
              />
            </div>
          </div>
        ))}
      </div>
      {isStay && (
        <AvailabilityCalendar
          blockedDates={draft.blockedDates}
          onChange={(dates) => setDraft((d) => ({ ...d, blockedDates: dates }))}
        />
      )}
    </div>
  )
}

export function ContactScreen({ categoryKey, draft, setDraft }) {
  const isStay = categoryKey === 'stay'
  return (
    <div>
      <Head kicker="Shared · core" title="Contact & visibility" sub="Your account phone number is used — visit window controls when tenants can request one." />
      {isStay ? (
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-slate-800 mb-2.5">Booking</p>
          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-800">Instant book</p>
              <p className="text-xs text-slate-400 mt-0.5">Guests can book without waiting for approval</p>
            </div>
            <Toggle checked={!!draft.instantBook} onChange={(v) => setDraft((d) => ({ ...d, instantBook: v }))} />
          </div>
        </div>
      ) : (
        <div className="flex gap-4 max-w-sm">
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1.5">Visits from</p>
            <input type="time" value={draft.appointmentWindowStart} onChange={(e) => setDraft((d) => ({ ...d, appointmentWindowStart: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500 mb-1.5">Visits to</p>
            <input type="time" value={draft.appointmentWindowEnd} onChange={(e) => setDraft((d) => ({ ...d, appointmentWindowEnd: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-slate-400" />
          </div>
        </div>
      )}
    </div>
  )
}

export function VerifyScreen({ categoryKey, draft, setDraft }) {
  const v = VERIFY[categoryKey]
  const docs = draft.docs
  function setUrl(type, url) {
    setDraft((d) => ({ ...d, docs: url ? [...d.docs.filter((x) => x.type !== type), { type, url }] : d.docs.filter((x) => x.type !== type) }))
  }
  return (
    <div>
      {v.biz && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-[11px] font-bold tracking-wide mb-5">BUSINESS KYC</span>
      )}
      <Head title={v.biz ? 'Verify your business' : 'Verify ownership'} sub="Your listing saves as a draft and goes live once the trust team approves these. Paste a link to each document (Google Drive, Dropbox, etc.)." />
      <div className="max-w-lg flex flex-col gap-3">
        {v.docs.map(([type, label]) => {
          const existing = docs.find((x) => x.type === type)
          return (
            <div key={type} className="flex items-center gap-3 p-4 rounded-xl border border-slate-200">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <input
                  defaultValue={existing?.url ?? ''}
                  onBlur={(e) => setUrl(type, e.target.value.trim())}
                  placeholder="Paste document URL"
                  className="w-full mt-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-slate-400"
                />
              </div>
              {existing && <Check size={18} color="#0284c7" strokeWidth={2.5} className="shrink-0" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReviewScreen({ categoryKey, draft }) {
  const cat = CATEGORIES[categoryKey]
  const priceRow = pricingRows(categoryKey, draft.pricingModel)[0]
  const facts = [
    ['Type', cat.label],
    [DESCRIBE[categoryKey].q.replace(/\?$/, ''), draft.fields[DESCRIBE[categoryKey].k] ?? '—'],
    ['City', draft.location.city || '—'],
    [priceRow[1], draft.pricing[priceRow[0]] ? `₹${draft.pricing[priceRow[0]]}` : '—'],
    ['Amenities', draft.amenityNames.length ? draft.amenityNames.slice(0, 4).join(', ') + (draft.amenityNames.length > 4 ? ` +${draft.amenityNames.length - 4}` : '') : '—'],
    ['Photos', `${draft.images.length} uploaded`],
  ]
  return (
    <div>
      <Head kicker="Almost there" title="Review your listing" sub="Confirm the details. On publish it saves as DRAFT and moves to PENDING for verification." />
      <div className="max-w-lg bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-4 p-5 border-b border-slate-100">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cat.tier === 'biz' ? 'bg-slate-900' : 'bg-brand-50'}`}>
            <Home size={22} color={cat.tier === 'biz' ? '#fff' : '#0284c7'} strokeWidth={1.7} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{draft.title || `New ${cat.label} listing`}</p>
            <p className="text-xs text-slate-400 mt-0.5">{draft.location.city || 'Your city'} · {cat.long}</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full shrink-0">Draft</span>
        </div>
        <div className="px-5 py-2">
          {facts.map(([label, value], i) => (
            <div key={i} className={`flex items-center justify-between gap-4 py-3 ${i < facts.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <span className="text-xs text-slate-500">{label}</span>
              <span className="text-sm font-semibold text-slate-800 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
