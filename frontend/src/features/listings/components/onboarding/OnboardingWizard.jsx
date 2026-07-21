import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { availabilityService } from '@services/availability.service'
import { toast } from '@components/common/Toaster'
import TypePicker, { BecomeHostIntro, BusinessGate } from './TypePicker'
import PhaseInterstitial from './PhaseInterstitial'
import {
  DescribeScreen, FieldsScreen, LocationScreen, FeaturesScreen, PhotosScreen,
  TitleScreen, DescriptionScreen, PricingScreen, ContactScreen, ReviewScreen,
} from './WizardScreens'
import { CATEGORIES, BUSINESS_GATED_TYPES, DESCRIBE, getScreens, phaseOf, deriveType, missingRequirements } from '../../config/onboarding.js'
import ListingManager from '../ListingManager'
import ListingDetailContent from '../ListingDetailContent'
import { CreateLeaseModal } from '@features/leases/components/LeaseManager'

const EMPTY_DRAFT = {
  fields: {},
  amenityNames: [],
  location: { address: '', city: '', state: '', pincode: '', landmark: '', lat: null, lng: null },
  images: [],
  title: '',
  description: '',
  // RENT unless the owner picks Lease on the pricing screen (only offered for
  // LEASE_CATEGORIES). Lives beside `pricing` rather than inside it because
  // everything in `pricing` is a money string; this is a mode.
  pricingModel: 'RENT',
  pricing: {},
  appointmentWindowStart: '',
  appointmentWindowEnd: '',
  instantBook: false,
  blockedDates: [],
}

const NUMERIC_FIELD_KEYS = new Set([
  'bhk', 'sharing', 'bathrooms', 'floor', 'totalFloors', 'area', 'extent', 'roadWidth',
  'carpetArea', 'frontage', 'totalBeds', 'availableBeds', 'noticePeriodDays', 'maxGuests', 'beds',
])

function buildPayload(categoryKey, type, draft, amenityIds) {
  const { fields, location, pricing } = draft
  const typedFields = {}
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'genderPreference' || value === undefined || value === '') continue
    typedFields[key] = NUMERIC_FIELD_KEYS.has(key) ? Number(value) : value
  }

  const isStay = categoryKey === 'stay'
  const primaryRent = isStay ? Number(pricing.nightlyRate || 0) : Number(pricing.rent || 0)
  // On a lease, `rent` carries the lump sum and there is no second deposit
  // (the backend rejects one). See PricingModel in schema.prisma.
  const isLease = draft.pricingModel === 'LEASE'

  const payload = {
    title: draft.title.trim(),
    description: draft.description.trim(),
    type,
    address: location.address.trim(),
    city: location.city,
    state: location.state,
    pincode: location.pincode,
    landmark: location.landmark?.trim() || undefined,
    lat: location.lat,
    lng: location.lng,
    images: draft.images,
    amenityIds,
    ...typedFields,
    pricingModel: draft.pricingModel,
    rent: primaryRent,
    deposit: isLease ? 0 : Number(pricing.deposit ?? 0),
    ...(pricing.maintenance !== undefined && pricing.maintenance !== '' && { maintenance: Number(pricing.maintenance) }),
    ...(isStay && {
      nightlyRate: primaryRent,
      cleaningFee: Number(pricing.cleaningFee || 0),
      ...(pricing.weekendRate && { weekendRate: Number(pricing.weekendRate) }),
      minNights: 1,
      maxNights: 28,
      instantBook: draft.instantBook,
    }),
    ...(draft.appointmentWindowStart && { appointmentWindowStart: draft.appointmentWindowStart }),
    ...(draft.appointmentWindowEnd && { appointmentWindowEnd: draft.appointmentWindowEnd }),
  }

  if (fields.genderPreference) payload.rules = { genderPreference: fields.genderPreference }

  return payload
}

function DoneScreen({ category, onListAnother, onGoToListings }) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="w-16 h-16 rounded-full bg-brand-50 mx-auto mb-6 flex items-center justify-center">
        <div className="w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center">
          <Check size={22} color="#fff" strokeWidth={2.6} />
        </div>
      </div>
      <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Your listing is submitted</h1>
      <p className="text-sm text-slate-500 leading-relaxed mt-3.5">
        Your {category.label} is pending review — we&apos;ll put it on the map the moment
        it&apos;s approved. Want the Verified badge? Add ownership documents any time from
        your listing page.
      </p>
      <div className="flex items-center justify-center gap-2 my-7">
        {['DRAFT', 'PENDING', 'ACTIVE'].map((s, i) => (
          <span key={s} className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${i <= 1 ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>{s}</span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onListAnother} className="px-5 py-3 rounded-xl border border-slate-200 hover:border-slate-400 text-sm font-semibold text-slate-700 transition-colors">
          List another type
        </button>
        <button onClick={onGoToListings} className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors">
          Go to my listings
        </button>
      </div>
    </div>
  )
}

// Wraps the become-host/picker/business-gate/flow/done screens in a scrollable,
// width-capped region — the 'listings' stage renders full-bleed instead (it
// hosts ListingManager/ListingDetailContent, which expect the full viewport).
function ScreenShell({ children }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 md:py-12">
      <div className="max-w-3xl mx-auto w-full">{children}</div>
    </div>
  )
}

function ListingsOverview({ onAdd, onView, onOfferLease }) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-start sm:items-center justify-between gap-3 px-6 md:px-10 py-5 border-b border-slate-200 bg-white">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Your listings</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage your properties on StayOnMap</p>
        </div>
        <button
          onClick={onAdd}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition-all bg-[#111111]"
        >
          <Plus size={15} strokeWidth={2.2} />
          Add listing
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <ListingManager onAdd={onAdd} onViewDetails={onView} onOfferLease={onOfferLease} />
      </div>
    </div>
  )
}

export default function OnboardingWizard({ profile }) {
  const qc = useQueryClient()
  const [stage, setStage] = useState(profile?.role === 'OWNER' ? 'listings' : 'become-host')
  // Survives the mutation without re-rendering mid-publish; read in onSuccess.
  const [categoryKey, setCategoryKey] = useState(null)
  const [screenIdx, setScreenIdx] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [blockError, setBlockError] = useState('')
  const [viewListingId, setViewListingId] = useState(null)
  const [offerLeaseFor, setOfferLeaseFor] = useState(null)

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  const { mutate: publish, isPending } = useMutation({
    mutationFn: async () => {
      const type = deriveType(categoryKey, draft.fields[DESCRIBE[categoryKey].k])
      const amenityIds = amenities.filter((a) => draft.amenityNames.includes(a.name)).map((a) => a.id)
      const payload = buildPayload(categoryKey, type, draft, amenityIds)
      const property = await propertyService.create(payload).then((r) => r.data)

      if (categoryKey === 'stay' && draft.blockedDates.length > 0) {
        await availabilityService.set(property.id, draft.blockedDates.map((date) => ({ date: `${date}T00:00:00.000Z`, isBlocked: true }))).catch(() => {})
      }

      await propertyService.publish(property.id)
      return property
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Submitted', 'Your listing is now pending review')
      setStage('done')
    },
    onError: (err) => toast.error('Couldn’t publish', err.message ?? 'Please try again'),
  })

  function pickCategory(key) {
    if (BUSINESS_GATED_TYPES.includes(key) && !profile?.isBusiness) {
      setCategoryKey(key)
      setStage('business-gate')
      return
    }
    setCategoryKey(key)
    setDraft(EMPTY_DRAFT)
    setScreenIdx(0)
    setBlockError('')
    setStage('flow')
  }

  function startNewListing() {
    setCategoryKey(null)
    setStage('picker')
  }

  if (stage === 'become-host') return <ScreenShell><BecomeHostIntro onDone={() => setStage('picker')} /></ScreenShell>

  if (stage === 'listings') {
    if (viewListingId) {
      return (
        <div className="flex-1 overflow-hidden">
          <ListingDetailContent propertyId={viewListingId} onBack={() => setViewListingId(null)} />
        </div>
      )
    }
    return (
      <>
        <ListingsOverview onAdd={startNewListing} onView={setViewListingId} onOfferLease={setOfferLeaseFor} />
        {offerLeaseFor && (
          <CreateLeaseModal
            propertyId={offerLeaseFor.id}
            propertyTitle={offerLeaseFor.title}
            isOpen
            onClose={() => setOfferLeaseFor(null)}
          />
        )}
      </>
    )
  }

  if (stage === 'picker') {
    return (
      <ScreenShell>
        <TypePicker onPick={pickCategory} onBack={profile?.role === 'OWNER' ? () => setStage('listings') : undefined} />
      </ScreenShell>
    )
  }

  if (stage === 'business-gate') {
    return (
      <ScreenShell>
        <BusinessGate
          onUpgraded={() => pickCategory(categoryKey)}
          onChooseDifferent={() => { setCategoryKey(null); setStage('picker') }}
        />
      </ScreenShell>
    )
  }

  if (stage === 'done') {
    return (
      <ScreenShell>
        <DoneScreen
          category={CATEGORIES[categoryKey]}
          onListAnother={() => { setCategoryKey(null); setStage('picker') }}
          onGoToListings={() => { setCategoryKey(null); setStage('listings') }}
        />
      </ScreenShell>
    )
  }

  const screens = getScreens()
  const screen = screens[screenIdx]
  const isPhase = screen.k === 'phase'
  const phase = phaseOf(screenIdx)
  const totalScreens = screens.filter((s) => s.k !== 'phase').length
  const doneCount = screens.slice(0, screenIdx).filter((s) => s.k !== 'phase').length
  const pct = Math.round((doneCount / totalScreens) * 100)
  const isLast = screenIdx === screens.length - 1
  const missing = missingRequirements(categoryKey, draft)
  const showFinishLater = !isPhase && !['describe', 'review'].includes(screen.k)
    && missing.some((m) => m.screenK === screen.k)

  function next() {
    // The describe choice is the one mid-flow gate — screen branching and type
    // derivation hang off it, and it's a single tap. Everything else surfaces
    // at review via missingRequirements.
    if (screen.k === 'describe' && draft.fields[DESCRIBE[categoryKey].k] === undefined) {
      setBlockError('Make a selection to continue.')
      return
    }
    setBlockError('')
    if (isLast) { publish(); return }
    setScreenIdx((i) => i + 1)
  }

  function jumpTo(screenK) {
    const idx = screens.findIndex((s) => s.k === screenK)
    if (idx >= 0) { setBlockError(''); setScreenIdx(idx) }
  }

  function back() {
    setBlockError('')
    if (screenIdx > 0) { setScreenIdx((i) => i - 1); return }
    setCategoryKey(null)
    setStage('picker')
  }

  return (
    <ScreenShell>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-900">{CATEGORIES[categoryKey].label}</span>
          <button onClick={() => { setCategoryKey(null); setStage('listings') }} className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-full px-3.5 py-1.5 hover:border-slate-400 transition-colors">
            Save &amp; exit
          </button>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex-1">
              <div className={`h-1 rounded-full ${n <= phase ? 'bg-brand-600' : 'bg-slate-200'}`} />
              <p className={`text-[11px] mt-1.5 ${n === phase ? 'text-brand-700 font-bold' : 'text-slate-400'}`}>
                {['Tell us about your place', 'Make it stand out', 'Finish & publish'][n - 1]}
              </p>
            </div>
          ))}
        </div>

        <div className="px-8 py-8 min-h-[380px]">
          {isPhase && <PhaseInterstitial n={screen.n} title={screen.title} blurb={screen.blurb} />}
          {screen.k === 'describe' && <DescribeScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'fields' && <FieldsScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'location' && <LocationScreen draft={draft} setDraft={setDraft} />}
          {screen.k === 'features' && <FeaturesScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'photos' && <PhotosScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'title' && <TitleScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'description' && <DescriptionScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'pricing' && <PricingScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'contact' && <ContactScreen categoryKey={categoryKey} draft={draft} setDraft={setDraft} />}
          {screen.k === 'review' && <ReviewScreen categoryKey={categoryKey} draft={draft} missing={missing} onJump={jumpTo} />}
        </div>

        {blockError && <p className="px-8 -mt-4 pb-4 text-sm text-red-500">{blockError}</p>}
        {showFinishLater && (
          <p className="px-8 -mt-4 pb-4 text-xs text-slate-400">
            You can finish this later — we&apos;ll flag anything missing at review.
          </p>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button onClick={back} className="text-sm font-bold text-slate-700 underline underline-offset-2">Back</button>
          <div className="flex items-center gap-4">
            {!isPhase && <span className="text-xs font-mono text-slate-400">{pct}%</span>}
            <button
              onClick={next}
              disabled={isPending || (isLast && missing.length > 0)}
              className="px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPhase ? 'Get started →' : isLast ? (isPending ? 'Publishing…' : 'Publish listing') : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}
