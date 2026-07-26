import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Copy, CircleCheckBig } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { chatService } from '@services/chat.service'
import { toast } from '@components/common/Toaster'
import TrustBadge from '@components/common/TrustBadge'
import RiskAlert from '@components/common/RiskAlert'
import TrustScoreWidget from '@features/trust/components/TrustScoreWidget'
import ReportButton from '@features/reports/components/ReportButton'
import Lightbox from './Lightbox'
import ImageGallery from './ImageGallery'
import DetailSheet from './DetailSheet'
import ActionCard from './ActionCard'
import PricingCard from './PricingCard'
import DetailTopBar from './DetailTopBar'
import MobileActionBar from './MobileActionBar'
import { availabilityTag, formatType, formatFurnished, bhkLabelFor, directionsUrlFor } from './detailUtils'

// The full presentational body of a property detail — extracted from
// PropertyPage.jsx so the admin panel can show the identical page.
//
// Operator decision (2026-07-22): the ADMIN property detail renders the EXACT
// same UI as the public property page — same sections, same visual design —
// with tenant ACTIONS suppressed. `variant`:
//   'public' — everything as before: top bar (back/share/save), ActionCard
//              (appointment form / chat / login gate), ReportButton,
//              CommuteCalculator, mobile bottom bar.
//   'admin'  — the same informational sections in the tenant design, single
//              column (it renders inside the admin detail view's property
//              column, not a full viewport, so the ≥lg 340px aside collapses
//              into the stacked flow the tenant sees below lg). All
//              interactive tenant actions are suppressed. Every section
//              null-tolerates admin-payload gaps (no rentBenchmark, leaner
//              owner select).
export default function PropertyDetailBody({ property, variant = 'public' }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const [lightboxIdx, setLightboxIdx] = useState(null)

  const isPublic = variant === 'public'
  const avail    = availabilityTag(property)
  const bhkLabel = bhkLabelFor(property)
  const images   = property.images ?? []
  const isOwner  = isPublic && user?.id === property.ownerId
  const directionsUrl = directionsUrlFor(property.lat, property.lng)

  async function startChat() {
    try {
      await chatService.startConversation(property.id)
      navigate('/user?tab=messages')
    } catch {
      toast.error('Error', 'Could not start conversation')
    }
  }

  // Title block — sits above the sheet, not inside it, so the page's
  // one h1 isn't visually boxed in with the detail sections.
  const titleBlock = (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-bold">
        {bhkLabel && <span className="text-brand-600">{bhkLabel}</span>}
        {property.furnished && (
          <span className="font-semibold text-slate-500">· {formatFurnished(property.furnished)}</span>
        )}
        {property.type && (
          <span className="font-semibold text-slate-500">· {formatType(property.type)}</span>
        )}
        {property.trustScore?.badge && (
          <span className="ml-1"><TrustBadge badge={property.trustScore.badge} size="sm" /></span>
        )}
      </div>

      <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{property.title}</h1>

      <div className="mt-2.5 flex items-start gap-1.5 text-slate-500">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" strokeWidth={2} />
        <p className="text-sm leading-snug">
          {property.address}, {property.city}, {property.state}
          {property.pincode ? ` — ${property.pincode}` : ''}
          {property.landmark ? <span className="text-slate-500"> · near {property.landmark}</span> : ''}
        </p>
      </div>

      {property.displayId && (
        <button
          onClick={() => { navigator.clipboard.writeText(property.displayId) }}
          title="Click to copy ID"
          className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-200"
        >
          {property.displayId}
          <Copy size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  )

  const trustCard = (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <h3 className="mb-4 text-sm font-bold text-slate-800">Trust &amp; safety</h3>
      <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
    </div>
  )

  const zeroBrokerageBanner = !property.brokerage && (
    <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5">
      <CircleCheckBig width={18} height={18} color="#059669" strokeWidth={1.9} className="shrink-0" />
      <div>
        <p className="text-sm font-semibold text-emerald-700">Zero brokerage</p>
        <p className="text-xs text-emerald-600/70">Pay the owner directly — no middlemen fees.</p>
      </div>
    </div>
  )

  const lightbox = lightboxIdx !== null && images.length > 0 && (
    <Lightbox images={images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
  )

  // ── Admin variant — identical sections, single-column, actions suppressed ──
  if (!isPublic) {
    return (
      <>
        {lightbox}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6">
          <RiskAlert riskScore={property.riskScore} />
          <ImageGallery images={images} avail={avail} onOpenLightbox={setLightboxIdx} />
          <div className="mt-6 space-y-5">
            {titleBlock}
            <DetailSheet property={property} variant="admin" isOwner={false} directionsUrl={directionsUrl} />
            <PricingCard property={property} />
            {trustCard}
            {zeroBrokerageBanner}
          </div>
        </div>
      </>
    )
  }

  // ── Public variant — the page exactly as it always rendered ────────────────
  return (
    <>
      {/* Lightbox */}
      {lightbox}

      {/* max-w-7xl + px-4/sm:px-6 is the container 13 other pages already use.
          This page was the outlier at max-w-6xl with lg:px-8, which made it the
          narrowest content column in the app — ~1088px of usable width against
          everyone else's ~1232px. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 lg:pb-10">

        {/* ── Top bar: Back + Actions ─────────────────────────────── */}
        <DetailTopBar property={property} />

        {/* ── Risk Alert ──────────────────────────────────────────── */}
        <RiskAlert riskScore={property.riskScore} />

        {/* ── Image Gallery ───────────────────────────────────────── */}
        <ImageGallery images={images} avail={avail} onOpenLightbox={setLightboxIdx} />

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">

          {/* ── Main content column ─────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-5">

            {titleBlock}

            <DetailSheet property={property} variant="public" isOwner={isOwner} directionsUrl={directionsUrl} />

            {/* <lg: the sidebar is hidden — its cards render here instead.
                ActionCard takes a distinct formId because the fixed mobile
                bottom bar scrolls to this anchor. */}
            <div className="space-y-4 lg:hidden">
              <ActionCard
                formId="appointment-form-mobile"
                isOwner={isOwner}
                property={property}
                avail={avail}
                propertyId={property.id}
                user={user}
                onStartChat={startChat}
                onOpenLogin={openLoginModal}
                directionsUrl={directionsUrl}
              />
              <PricingCard property={property} />
              {trustCard}
            </div>

            {/* Report */}
            <div className="flex items-center justify-between py-3">
              <p className="text-xs text-slate-500">Something wrong with this listing?</p>
              <ReportButton propertyId={property.id} />
            </div>
          </div>

          {/* ── Right sidebar ───────────────────────────────────────────
              The column itself scrolls with the page — no nested scrollbar, no
              height cap. Two earlier attempts were both worse: making the whole
              column `sticky` pins it the moment its top hits the offset, so
              everything past the fold is unreachable; capping its height and
              scrolling it internally fixed that but put a scrollbar inside a
              scrollbar. Only the booking card sticks now, which is the one
              thing that actually benefits from following the reader. */}
          <aside className="hidden w-[340px] shrink-0 lg:block">
            <div className="space-y-4">

              {/* 1 — Owner: interested people / tenant: price + appointment.
                  First so the primary action is visible without scrolling. */}
              <div className="sticky top-4 z-10">
                <ActionCard
                  formId="appointment-form"
                  isOwner={isOwner}
                  property={property}
                  avail={avail}
                  propertyId={property.id}
                  user={user}
                  onStartChat={startChat}
                  onOpenLogin={openLoginModal}
                  directionsUrl={directionsUrl}
                />
              </div>

              {/* 2 — Pricing breakdown */}
              <PricingCard property={property} />

              {/* 3 — Trust & safety */}
              {trustCard}

              {/* 4 — Zero brokerage */}
              {zeroBrokerageBanner}

            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile fixed bottom bar ─────────────────────────────── */}
      {!isOwner && <MobileActionBar property={property} directionsUrl={directionsUrl} />}
    </>
  )
}
