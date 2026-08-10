import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { availabilityService } from '@services/availability.service'
import { toast } from '@components/common/Toaster'
import { BecomeHostIntro, BusinessGate } from './HostGates'
import { WizardHeader, WizardFooter } from './WizardChrome'
import ListingFormTabs from '../ListingFormTabs'
import useDraftAutosave, { EMPTY_DRAFT, readSavedDraft, useDraftSync } from './useDraftAutosave'
import { discardDraftEverywhere } from './draftSync'
import { savedStepIndex } from '../../config/wizardSteps.js'
import UnfinishedDraftBanner from './UnfinishedDraftBanner'
import {
  CATEGORIES, BUSINESS_GATED_TYPES, DESCRIBE, STEPS,
  deriveType, missingRequirements, buildPayload, suggestTitle, defaultRules,
} from '../../config/onboarding.js'
import { confirm } from '@components/common/ConfirmDialog'
import ListingManager from '../ListingManager'
import MarkTenantModal from '../MarkTenantModal'
import ReportsModal from '../ReportsModal'
import EditListingPanel from '../EditListingPanel'

function DoneScreen({ category, onListAnother, onGoToListings }) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      <div className="w-16 h-16 rounded-full bg-brand-50 mx-auto mb-6 flex items-center justify-center">
        <div className="w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center">
          <Check size={22} color="#fff" strokeWidth={2.6} />
        </div>
      </div>
      <h1 className="font-display font-bold text-2xl text-slate-900 tracking-tight">Your listing is submitted</h1>
      <p className="text-sm text-slate-600 leading-relaxed mt-3.5">
        Your {category.label} is pending review — we&apos;ll put it on the map the moment
        it&apos;s approved. Want the Verified badge? Add ownership documents any time from
        your listing page.
      </p>
      <div className="flex items-center justify-center gap-2 my-7">
        {['DRAFT', 'PENDING', 'ACTIVE'].map((s, i) => (
          <span key={s} className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${i <= 1 ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>{s}</span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={onListAnother} className="px-5 py-3 rounded-xl border border-slate-200 hover:border-slate-400 text-sm font-semibold text-slate-700 transition-colors">
          List another
        </button>
        <button onClick={onGoToListings} className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-colors">
          Go to my listings
        </button>
      </div>
    </div>
  )
}

function ScreenShell({ children }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 md:py-12">
      <div className="max-w-3xl mx-auto w-full">{children}</div>
    </div>
  )
}

// "2 live · 1 pending review · 1 draft" — the states an owner acts on, and only
// the ones they actually have. A subline listing "0 pending review" invents work
// that isn't there; "Manage your properties on StayOnMap" (what was here) said
// nothing at all.
function statusSummary(listings, hasLocalDraft) {
  const live = listings.filter((p) => p.status === 'ACTIVE').length
  const pending = listings.filter((p) => p.status === 'PENDING').length
  const drafts = listings.filter((p) => p.status === 'DRAFT').length + (hasLocalDraft ? 1 : 0)
  const rejected = listings.filter((p) => p.status === 'REJECTED').length

  const parts = []
  if (live) parts.push(`${live} live`)
  if (pending) parts.push(`${pending} pending review`)
  if (drafts) parts.push(`${drafts} draft${drafts === 1 ? '' : 's'}`)
  if (rejected) parts.push(`${rejected} needs changes`)
  return parts.join(' · ')
}

// One account-level privacy switch (Settings → Privacy → Listing visibility)
// takes EVERY listing off the public map at once, and nothing said so anywhere:
// the row still reads ACTIVE, the admin panel still counts it, and only the map
// disagrees. An owner comparing the two has no way to find the cause, so the
// listing page states it where the listings are.
const VISIBILITY_NOTICE = {
  HIDDEN: {
    title: 'Your listings are hidden from everyone',
    body: 'Listing visibility is set to Hidden, so even a live listing never appears on the map or in search results.',
  },
  LOGGED_IN: {
    title: 'Only signed-in people can see your listings',
    body: 'Listing visibility is set to Logged-in only, so your listings don’t appear for visitors who haven’t signed in.',
  },
}

function VisibilityNotice({ visibility }) {
  const notice = VISIBILITY_NOTICE[visibility]
  if (!notice) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-900">{notice.title}</p>
        <p className="text-sm text-amber-800 mt-1">{notice.body}</p>
      </div>
      <Link
        to="/user?tab=settings"
        className="shrink-0 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-white border border-amber-300 text-sm font-semibold text-amber-900 no-underline hover:bg-amber-100 transition-colors"
      >
        Change this
      </Link>
    </div>
  )
}

function ListingsOverview({
  profile,
  onAdd, onEdit, onPreview, onVisitRequests, onSubmitForReview, onDeleteListing, onToggleStatus,
  onMarkTenant, onVacate, onReports,
  localDraft, localDraftLabel, onResumeLocalDraft, onDiscardLocalDraft,
}) {
  const { data: listings = [] } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then((r) => r.data),
  })
  const summary = statusSummary(listings, !!localDraft)

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-start sm:items-center justify-between gap-3 px-6 md:px-10 py-5 bg-white">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">My listings</h1>
          {summary && <p className="text-sm text-slate-600 mt-1">{summary}</p>}
        </div>
        <button
          onClick={onAdd}
          className="shrink-0 flex items-center gap-2 px-5 py-3 text-sm font-bold text-white rounded-xl hover:bg-[#2a2a2a] transition-colors bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Plus size={15} strokeWidth={2.4} />
          Add listing
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 md:px-10 pt-5 pb-8 space-y-4">
        <VisibilityNotice visibility={profile?.listingVisibility} />
        {localDraft && (
          <UnfinishedDraftBanner draft={localDraft} onResume={onResumeLocalDraft} />
        )}
        <ListingManager
          onAdd={onAdd}
          onEdit={onEdit}
          onPreview={onPreview}
          onVisitRequests={onVisitRequests}
          onResume={onSubmitForReview}
          onDelete={onDeleteListing}
          onToggleStatus={onToggleStatus}
          onMarkTenant={onMarkTenant}
          onVacate={onVacate}
          onReports={onReports}
          localDraft={localDraft}
          localDraftLabel={localDraftLabel}
          onResumeLocalDraft={onResumeLocalDraft}
          onDiscardLocalDraft={onDiscardLocalDraft}
        />
      </div>
    </div>
  )
}

export default function OnboardingWizard({ profile }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  // `/list?new=1` means "start adding", not "show me my listings". Without it
  // every Add-listing button outside this component landed an owner on the My
  // listings overview and made them press Add a second time.
  const [searchParams, setSearchParams] = useSearchParams()
  const wantsNewListing = searchParams.get('new') === '1'
  const [stage, setStage] = useState(
    // A tenant still meets the become-a-host step first, whatever the URL says —
    // listing is an explicit role change, not a side effect of a link.
    profile?.role !== 'OWNER' ? 'become-host' : wantsNewListing ? 'flow' : 'listings',
  )
  const [categoryKey, setCategoryKey] = useState(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [blockError, setBlockError] = useState('')
  const blockErrorRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [editListingId, setEditListingId] = useState(null)
  // Set only when someone asked to ADD and an unfinished draft already exists.
  // While it is set the autosave is paused in both directions — see the comment
  // on useDraftAutosave's `paused`.
  const [pendingDraft, setPendingDraft] = useState(() => (wantsNewListing ? readSavedDraft() : null))

  // Consumed once, then dropped from the URL: otherwise "Save & exit" would
  // return to My listings with ?new=1 still on it, and the next refresh would
  // reopen the add flow the owner had just left.
  useEffect(() => {
    if (!wantsNewListing) return
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }, [wantsNewListing, searchParams, setSearchParams])

  // Pulls the account's draft into this browser and tells us when one lands, so
  // a listing started on a phone shows up here without a reload.
  const syncVersion = useDraftSync()

  const savedAt = useDraftAutosave({
    stage, categoryKey, stepIdx, draft, setCategoryKey, setStepIdx, setDraft,
    paused: !!pendingDraft, syncVersion,
  })

  // Held in state and refreshed on every stage change — NOT read during render.
  // Reading it during render looks fresher but breaks the discard: clearing the
  // draft only touches localStorage, so something must change state for React to
  // render again. Resetting the wizard fields isn't enough — arriving on /list
  // straight from a reload they are already null/EMPTY_DRAFT/0, every setState
  // bails out, and the deleted draft stays on screen until the next reload.
  // Publishing and resuming both move the stage, so this stays current for them.
  // syncVersion is in the deps for the same reason: a draft that arrives from
  // the owner's phone while this page is open must appear on the overview, not
  // wait for a reload.
  const [localDraft, setLocalDraft] = useState(null)
  useEffect(() => {
    setLocalDraft(stage === 'listings' ? readSavedDraft() : null)
  }, [stage, syncVersion])
  const localDraftLabel = localDraft
    ? (localDraft.draft?.title?.trim()
        || suggestTitle(localDraft.categoryKey, { fields: localDraft.draft?.fields ?? {}, location: localDraft.draft?.location ?? {} })
        || CATEGORIES[localDraft.categoryKey]?.label
        || 'Unfinished listing')
    : null

  // A server-side DRAFT is a listing that was created but never sent for
  // review. Its "Resume" is submission, not the wizard — the wizard builds new
  // listings, it does not load existing ones.
  const { mutate: submitForReview } = useMutation({
    mutationFn: (property) => propertyService.publish(property.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Sent for review', 'We’ll put it on the map once it’s approved')
    },
    onError: (err) => toast.error('Couldn’t submit', err.message ?? 'Please try again'),
  })

  const { mutate: deleteListing } = useMutation({
    mutationFn: (property) => propertyService.remove(property.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Deleted', 'The listing is gone')
    },
    onError: (err) => toast.error('Couldn’t delete', err.message ?? 'Please try again'),
  })

  // Pause, not delete, is what an owner usually means when a flat is taken or
  // they're away — ACTIVE↔INACTIVE, enforced server-side by toggleStatus.
  const { mutate: toggleListingStatus } = useMutation({
    mutationFn: (property) => propertyService.toggleStatus(property.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      const paused = res?.data?.status === 'INACTIVE'
      toast.success(
        paused ? 'Listing paused' : 'Listing live again',
        paused ? 'Renters can no longer see it. Resume any time.' : 'It’s back on the map.',
      )
    },
    onError: (err) => toast.error('Couldn’t change that', err.message ?? 'Please try again'),
  })

  // Rented through the platform — ACTIVE → OCCUPIED with the tenant recorded,
  // and back again when they leave. Web parity with mobile's ManageListing
  // (2026-07-27); the picker only offers people who contacted the listing.
  const [markTenantFor, setMarkTenantFor] = useState(null)
  const [reportsFor, setReportsFor] = useState(null)

  const { mutate: markTenant, isPending: markTenantBusy } = useMutation({
    mutationFn: ({ propertyId, tenantId }) => propertyService.markTenant(propertyId, tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      setMarkTenantFor(null)
      toast.success('Marked as rented', 'The listing is off the map while it’s occupied.')
    },
    onError: (err) => toast.error('Couldn’t mark it rented', err.message ?? 'Please try again'),
  })

  const { mutate: vacateListing } = useMutation({
    mutationFn: (property) => propertyService.vacate(property.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Marked as vacant', 'It’s back on the map for renters to find.')
    },
    onError: (err) => toast.error('Couldn’t mark it vacant', err.message ?? 'Please try again'),
  })

  async function pickTenant(tenant) {
    const property = markTenantFor
    if (!property) return
    const name = tenant.name || tenant.email?.split('@')[0] || 'This person'
    const ok = await confirm({
      title: 'Mark as rented?',
      message: `${name} will be recorded as the tenant of ${property.title}, and the listing set to Occupied — it comes off the public map. Mark it vacant later to relist it.`,
      confirmLabel: 'Mark as rented',
    })
    if (ok) markTenant({ propertyId: property.id, tenantId: tenant.id })
  }

  async function confirmVacate(property) {
    const tenantName = property.currentTenant?.name ?? 'the current tenant'
    const ok = await confirm({
      title: 'Mark as vacant?',
      message: `${tenantName} will no longer be recorded as the tenant, and ${property.title} goes back on the map as Active.`,
      confirmLabel: 'Mark as vacant',
    })
    if (ok) vacateListing(property)
  }

  async function confirmToggleStatus(property) {
    if (property.status === 'ACTIVE') {
      const ok = await confirm({
        title: 'Pause this listing?',
        message: `${property.title} will come off the map and stop receiving visit requests. Nothing is deleted — you can resume it whenever you like.`,
        confirmLabel: 'Pause listing',
      })
      if (!ok) return
    }
    toggleListingStatus(property)
  }

  async function confirmDeleteListing(property) {
    // Say what else goes with it. The row already knows how many people are
    // waiting, and finding out afterwards that you cancelled three visits is
    // the kind of surprise a confirm dialog exists to prevent.
    const waiting = property._count?.appointments ?? 0
    const ok = await confirm({
      title: 'Delete this listing?',
      message: waiting > 0
        ? `${property.title} will be removed for good, and ${waiting} pending visit ${waiting === 1 ? 'request' : 'requests'} will be cancelled — they'll be told. If you only want it off the map for a while, pause it instead. This can't be undone.`
        : `${property.title} will be removed for good, along with its photos, messages and reviews. If you only want it off the map for a while, pause it instead. This can't be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteListing(property)
  }

  async function discardLocalDraft() {
    const ok = await confirm({
      title: 'Discard this unfinished listing?',
      message: 'Everything you entered will be lost. This can’t be undone.',
      confirmLabel: 'Discard',
      variant: 'danger',
    })
    if (!ok) return
    // Everywhere, not just this browser: the owner asked for it to be gone, and
    // leaving the server's copy would have their phone push it straight back.
    discardDraftEverywhere()
    setLocalDraft(null)
    setCategoryKey(null)
    setDraft(EMPTY_DRAFT)
    setStepIdx(0)
    toast.success('Draft deleted', 'Your unfinished listing is gone, on this device and your others')
  }

  // The one way back into a saved draft, used by the banner on My listings and
  // by the fork inside the add flow. Restores explicitly rather than leaning on
  // the autosave hook, so it behaves the same whether or not that hook is
  // currently paused.
  function resumeLocalDraft() {
    const saved = pendingDraft ?? readSavedDraft()
    setBlockError('')
    setPendingDraft(null)
    if (saved?.categoryKey) {
      setCategoryKey(saved.categoryKey)
      setDraft({ ...EMPTY_DRAFT, ...saved.draft })
      // Via the key, never the raw index — this draft may have been written on
      // a phone, whose step list is seven long.
      setStepIdx(savedStepIndex(saved))
    }
    setStage('flow')
  }

  // Starting fresh DISCARDS the saved one — there is a single draft slot, so
  // this is a real deletion and it asks first.
  async function startFreshOverDraft() {
    const ok = await confirm({
      title: 'Start a new listing?',
      message: 'Your unfinished listing will be discarded on all your devices — only one draft is kept at a time.',
      confirmLabel: 'Discard and start new',
      variant: 'danger',
    })
    if (!ok) return
    discardDraftEverywhere()
    setCategoryKey(null)
    setDraft(EMPTY_DRAFT)
    setStepIdx(0)
    setPendingDraft(null)
  }

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
      // The draft has become a real listing, so it stops existing as a draft on
      // every device — otherwise the owner's phone still offers to resume a
      // listing they already published.
      discardDraftEverywhere()
      toast.success('Submitted', 'Your listing is now pending review')
      setStage('done')
    },
    onError: (err) => toast.error('Couldn’t publish', err.message ?? 'Please try again'),
  })

  // Changing the category mid-step-1 resets the answers that only made sense
  // for the old one — a plot's approval status is not a flat's furnishing.
  function pickCategory(key) {
    setBlockError('')
    if (BUSINESS_GATED_TYPES.includes(key) && !profile?.isBusiness) {
      setCategoryKey(key)
      setStage('business-gate')
      return
    }
    setCategoryKey(key)
    setDraft((d) => ({ ...d, fields: {}, amenityNames: [], rules: defaultRules(key), terms: {}, pricing: {}, pricingModel: 'RENT' }))
  }

  function startNewListing() {
    setCategoryKey(null)
    setDraft(EMPTY_DRAFT)
    setStepIdx(0)
    setBlockError('')
    setPendingDraft(readSavedDraft())
    setStage('flow')
  }

  if (stage === 'become-host') {
    return <ScreenShell><BecomeHostIntro onDone={startNewListing} /></ScreenShell>
  }

  if (stage === 'listings') {
    if (editListingId) {
      return (
        <div className="flex-1 overflow-hidden">
          <EditListingPanel propertyId={editListingId} onBack={() => setEditListingId(null)} />
        </div>
      )
    }
    return (
      <>
        <ListingsOverview
          profile={profile}
          onAdd={startNewListing}
          onEdit={setEditListingId}
          // Preview opens the listing a renter actually sees, in THIS tab — the
          // property page's own back button (navigate(-1)) returns to this list.
          // A new tab looked like keeping your place but actually lost it: the
          // opened tab had no history, so back was dead.
          onPreview={(property) => navigate(`/property/${property.id}`)}
          // Visit requests live in the Appointments tab (host mode shows the
          // incoming side) — the listing row links there rather than growing its
          // own half-copy of it.
          onVisitRequests={() => navigate('/user?tab=appointments')}
          onSubmitForReview={submitForReview}
          onDeleteListing={confirmDeleteListing}
          onToggleStatus={confirmToggleStatus}
          onMarkTenant={setMarkTenantFor}
          onVacate={confirmVacate}
          onReports={setReportsFor}
          localDraft={localDraft}
          localDraftLabel={localDraftLabel}
          onResumeLocalDraft={resumeLocalDraft}
          onDiscardLocalDraft={discardLocalDraft}
        />
        <MarkTenantModal
          property={markTenantFor}
          busy={markTenantBusy}
          onClose={() => setMarkTenantFor(null)}
          onPick={pickTenant}
        />
        {/* Reports filed against a listing, and the owner's one reply. Both
            endpoints shipped with the reports feature and had no caller on
            either platform until 2026-08-10 — so a listing could be reported,
            and suspended on a risk score built partly from those reports, with
            its owner unable to see what was said. */}
        <ReportsModal property={reportsFor} onClose={() => setReportsFor(null)} />
      </>
    )
  }

  if (stage === 'business-gate') {
    return (
      <ScreenShell>
        <BusinessGate
          onUpgraded={() => { setStage('flow'); pickCategory(categoryKey) }}
          onChooseDifferent={() => { setCategoryKey(null); setStage('flow') }}
        />
      </ScreenShell>
    )
  }

  if (stage === 'done') {
    return (
      <ScreenShell>
        <DoneScreen
          category={CATEGORIES[categoryKey]}
          onListAnother={startNewListing}
          onGoToListings={() => { setCategoryKey(null); setStage('listings') }}
        />
      </ScreenShell>
    )
  }

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1
  const goToTab = (k) => goTo(STEPS.findIndex((t) => t.k === k))
  const missing = categoryKey ? missingRequirements(categoryKey, draft) : []
  const missingProfile = profile?.missingProfileFields ?? []

  function goTo(idx) {
    setBlockError('')
    // Offer a title the moment we have enough to write one, and only into an
    // empty field — never overwrite what the owner typed.
    if (STEPS[idx]?.k === 'features' && !draft.title.trim()) {
      const suggested = suggestTitle(categoryKey, draft)
      if (suggested) setDraft((d) => ({ ...d, title: suggested, titlePrefilled: true }))
    }
    setStepIdx(idx)
  }

  // The blocking message renders at the BOTTOM of a scrolling step body while
  // Next lives in a fixed footer — so on a tall step (the very first one) the
  // owner pressed Next, nothing appeared to happen, and the reason sat ~570px
  // below the fold. Bring it into view and focus it.
  function blockWith(message) {
    setBlockError(message)
    requestAnimationFrame(() => {
      blockErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      blockErrorRef.current?.focus({ preventScroll: true })
    })
  }

  function next() {
    if (!categoryKey) { blockWith('Pick what you’re listing to continue.'); return }
    // Publish is no longer DISABLED for an incomplete profile — it explains
    // itself instead. A grey button that does nothing and says nothing is how
    // this read as "the phone field is broken": an owner filled in the phone
    // the gate asked for, the button stayed dead, and nothing on screen said
    // the real blocker was an unverified email. (User report, 2026-08-07: "we
    // have a phone number blocker if we enter ph number it doesnt work also".)
    // .claude/ui-ux.md's rule is to disable AND show why; showing nothing is
    // the half that was missing.
    if (isLast && missingProfile.length > 0) {
      const labels = missingProfile.map((m) => m.label.toLowerCase())
      blockWith(
        labels.length === 1
          ? `One thing left before you can publish: ${labels[0]}. It’s in the box above.`
          : `Before you can publish, finish these in the box above: ${labels.join(', ')}.`,
      )
      return
    }
    // The one mid-flow gate: step branching and type derivation hang off it.
    if (step.k === 'basics' && draft.fields[DESCRIBE[categoryKey].k] === undefined) {
      blockWith(`${DESCRIBE[categoryKey].q} Make a selection to continue.`)
      return
    }
    if (isLast) { publish(); return }
    goTo(stepIdx + 1)
  }

  function back() {
    setBlockError('')
    if (stepIdx > 0) { setStepIdx(stepIdx - 1); return }
    setStage(profile?.role === 'OWNER' ? 'listings' : 'become-host')
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <WizardHeader
        title={categoryKey ? `Listing a ${CATEGORIES[categoryKey].short.toLowerCase()}` : 'New listing'}
        savedAt={savedAt}
        onExit={() => setStage(profile?.role === 'OWNER' ? 'listings' : 'become-host')}
      />

      {/* Same tab bar the edit flow uses — one design for both, since both are
          filling in the same listing (see ListingFormTabs.jsx). The Next button
          stays: on a NEW listing the order is guidance, and the tabs are there
          for anyone who'd rather jump. */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto w-full">
          {pendingDraft ? (
            <UnfinishedDraftBanner
              draft={pendingDraft}
              onResume={resumeLocalDraft}
              onStartFresh={startFreshOverDraft}
            />
          ) : (
          <ListingFormTabs
            mode="create"
            categoryKey={categoryKey}
            draft={draft}
            setDraft={setDraft}
            activeTab={step.k}
            onTabChange={goToTab}
            onPickCategory={pickCategory}
            missing={missing}
            profile={profile}
            onUploadingChange={setUploading}
          />
          )}
          {/* tabIndex + ref so the message can be scrolled to AND announced —
              role="alert" alone leaves a sighted user staring at a Next button
              that looks broken (see the scroll in next()). */}
          {blockError && (
            <p
              ref={blockErrorRef}
              tabIndex={-1}
              role="alert"
              className="mt-6 text-sm text-red-600 scroll-mt-24 focus:outline-none"
            >
              {blockError}
            </p>
          )}
        </div>
      </div>

      {/* No footer while the resume-or-start-fresh choice is open: the two
          buttons in that card are the only moves, and a "Next" beside them would
          advance a form nobody has chosen yet. */}
      {!pendingDraft && (
        <WizardFooter
          backLabel={stepIdx === 0 ? 'Cancel' : 'Back'}
          onBack={back}
          note={isLast ? 'Editable any time after publishing' : 'Autosaved · safe to close and come back'}
          nextLabel={isLast ? (isPending ? 'Publishing…' : 'Publish listing') : `Next — ${step.next}`}
          // `uploading` and `isPending` are transient and self-explanatory —
          // the label already says "Publishing…". A missing profile field is
          // NOT transient, so it must be pressable and explain itself rather
          // than leaving a dead control on screen.
          nextDisabled={uploading || isPending || (isLast && missing.length > 0)}
          primary={isLast}
          onNext={next}
        />
      )}
    </div>
  )
}
