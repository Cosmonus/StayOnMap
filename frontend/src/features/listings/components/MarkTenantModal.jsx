import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import Modal from '@components/common/Modal'

// Who can be marked as the tenant: someone who contacted this listing through
// StayOnMap — a visit request or a chat. Same rule as mobile's ManageListing
// contact rows: the server would accept any user id, but the UI only offers
// real contacts so "marked as tenant" always traces back to platform activity.
function contactedTenants(data) {
  const map = new Map()
  for (const a of data?.appointments ?? []) {
    if (a.tenant && !map.has(a.tenant.id)) map.set(a.tenant.id, { ...a.tenant, via: 'Requested a visit' })
  }
  for (const c of data?.conversations ?? []) {
    if (c.tenant && !map.has(c.tenant.id)) map.set(c.tenant.id, { ...c.tenant, via: 'Chatted with you' })
  }
  return [...map.values()]
}

function TenantRow({ tenant, disabled, onPick }) {
  const display = tenant.name || tenant.email?.split('@')[0] || 'Member'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(tenant)}
      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
        {tenant.avatarUrl
          ? <img src={tenant.avatarUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-slate-500">{display[0].toUpperCase()}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{display}</p>
        <p className="text-xs text-slate-500 truncate mt-0.5">{tenant.email}</p>
      </div>
      <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">{tenant.via}</span>
    </button>
  )
}

export default function MarkTenantModal({ property, busy, onClose, onPick }) {
  const open = !!property
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['property-contacts', property?.id],
    queryFn: () => propertyService.getContacts(property.id).then(r => r.data),
    enabled: open,
  })
  const tenants = contactedTenants(data)

  return (
    <Modal isOpen={open} onClose={onClose} title="Who moved in?">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          Pick the person who rented <span className="font-semibold text-slate-800">{property?.title}</span>.
          The listing is set to Occupied and comes off the public map — you can mark it vacant later to relist it.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600">Couldn&apos;t load who contacted this listing.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 min-h-[44px] px-5 py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors"
            >
              Try again
            </button>
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm font-semibold text-slate-700">Nobody has contacted this listing yet</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              A tenant can be marked once they&apos;ve requested a visit or messaged you through StayOnMap.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto thin-scrollbar">
            {tenants.map(t => (
              <TenantRow key={t.id} tenant={t} disabled={busy} onPick={onPick} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
