import { Lock, MessageCircleMore, Navigation } from 'lucide-react'
import { formatPrice, formatCurrency } from '@utils/format'
import { rentBenchmarkLabel } from './detailUtils'
import InterestedPeoplePanel from './InterestedPeoplePanel'
import AppointmentSection from './AppointmentSection'

// ── Login Gate — shown to guests in place of action forms ────────────────────
function LoginGate({ onLogin }) {
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-7 h-7 text-brand-600" strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-1">Sign in to contact the owner</h3>
      <p className="text-sm text-slate-500 mb-5 max-w-[240px] mx-auto">
        Create a free account to request visits, chat with owners, and save properties.
      </p>
      <button
        onClick={onLogin}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
        style={{ background: '#111111' }}
      >
        Sign in or create account
      </button>
      <p className="text-xs text-slate-500 mt-3">Zero brokerage. Always free for tenants.</p>
    </div>
  )
}

// ── Action card — owner: interested people / tenant: price + appointment ────
// Rendered twice (sticky aside ≥lg, in-flow <lg), so the appointment anchor
// id must differ per instance — the mobile bottom bar scrolls to the <lg one.
export default function ActionCard({ formId, isOwner, property, avail, propertyId, user, onStartChat, onOpenLogin, directionsUrl }) {
  const bench = rentBenchmarkLabel(Number(property.rent), property.rentBenchmark)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      {/* Price leads the card in every state — an owner looking at their own
          listing needs to see what it's advertised at just as much as a renter
          does, so this sits above the owner/tenant split rather than inside it. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900">{formatPrice(property)}</p>
          {property.deposit > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {property.pricingModel === 'SALE' ? 'Booking advance' : 'Deposit'} {formatCurrency(Number(property.deposit))}
            </p>
          )}
          {bench && <p className={`mt-1 text-[11px] font-medium ${bench.className}`}>{bench.text}</p>}
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${avail.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
          <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
        </div>
      </div>

      {isOwner ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Interested people</h3>
          <InterestedPeoplePanel propertyId={propertyId} property={property} />
        </div>
      ) : user ? (
        <>
          <div id={formId} className="mt-4 border-t border-slate-100 pt-4">
            <AppointmentSection
              propertyId={propertyId}
              type={property.type}
              minNights={property.minNights}
              maxNights={property.maxNights}
              windowStart={property.appointmentWindowStart}
              windowEnd={property.appointmentWindowEnd}
            />
          </div>
          {/* A listing with no coordinates gets a full-width Chat button rather
              than a half-width one beside an empty cell. */}
          <div className={`mt-4 grid gap-2 border-t border-slate-100 pt-4 ${directionsUrl ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              onClick={onStartChat}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <MessageCircleMore className="w-4 h-4" strokeWidth={2} />
              Chat
            </button>
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-800 no-underline transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Navigation className="w-4 h-4 text-brand-600" strokeWidth={2} />
                Directions
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <LoginGate onLogin={onOpenLogin} />
        </div>
      )}
    </div>
  )
}
