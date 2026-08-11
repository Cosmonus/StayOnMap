import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronDown, Phone, MessageCircle, KeyRound } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { chatService } from '@services/chat.service'
import Modal from '@components/common/Modal'
import { toast } from '@components/common/Toaster'

// Who contacted this listing, and what the owner can DO about each of them:
// call, chat, or mark as the renter. Redesigned 2026-08-12 on operator
// request — the old rows showed name + EMAIL and clicking a person INSTANTLY
// marked them as tenant, which put the highest-consequence action on the
// lowest-intent gesture. Now the row toggles open (chevron), and the actions
// sit behind that one deliberate tap.
//
// Only people who contacted this listing through StayOnMap appear — a visit
// request or a chat. The server enforces the same rule, so "marked as tenant"
// always traces back to platform activity.
function contactedTenants(data) {
  const map = new Map()
  for (const a of data?.appointments ?? []) {
    if (a.tenant && !map.has(a.tenant.id)) {
      map.set(a.tenant.id, {
        ...a.tenant,
        via: 'Requested a visit',
        // The profile phone arrives GATED (contactVisibility is enforced
        // server-side); the visit's own contactNumber is an explicit share in
        // context and stands in when the profile number is withheld or unset.
        phone: a.tenant.phone || a.contactNumber || null,
      })
    }
  }
  for (const c of data?.conversations ?? []) {
    if (c.tenant && !map.has(c.tenant.id)) {
      map.set(c.tenant.id, { ...c.tenant, via: 'Chatted with you', phone: c.tenant.phone ?? null })
    }
  }
  return [...map.values()]
}

function TenantRow({ tenant, propertyId, disabled, onPick, onClosePanel }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const display = tenant.name || 'Member'

  // Opening (or resuming) the chat with this person, then landing in the
  // host Inbox — the owner-initiated variant the chat feature already has.
  const startChat = useMutation({
    mutationFn: () => chatService.startWithTenant(propertyId, tenant.id),
    onSuccess: () => { onClosePanel(); navigate('/user?tab=messages') },
    onError: () => toast.error('Couldn’t open the chat', 'Please try again in a moment.'),
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* The whole collapsed row is the toggle — a person, and a chevron that
          says there is more. No email: an address in a list is a thing worth
          not showing, and nothing here needs to send one. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
          {tenant.avatarUrl
            ? <img src={tenant.avatarUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-xs font-bold text-slate-500">{display[0].toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{display}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">{tenant.via}</p>
        </div>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="flex items-center gap-2 px-3 pb-3">
          {/* Absent phone → NO button, never a disabled one: "they chose not
              to share it" and "they never saved one" must look identical
              (the chat surface's standing rule). */}
          {tenant.phone && (
            <a
              href={`tel:${tenant.phone}`}
              aria-label={`Call ${display}`}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Phone size={16} aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={() => startChat.mutate()}
            disabled={startChat.isPending}
            aria-label={`Chat with ${display}`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-brand-500 hover:text-brand-700 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <MessageCircle size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onPick(tenant)}
            disabled={disabled}
            className="ml-auto inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <KeyRound size={14} aria-hidden="true" />
            {disabled ? 'Marking…' : 'Mark as renter'}
          </button>
        </div>
      )}
    </div>
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
          People who contacted <span className="font-semibold text-slate-800">{property?.title}</span>.
          Open a person to call or chat — or mark them as the renter, which sets the listing to
          Occupied and takes it off the public map. You can mark it vacant later to relist it.
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
              <TenantRow
                key={t.id}
                tenant={t}
                propertyId={property.id}
                disabled={busy}
                onPick={onPick}
                onClosePanel={onClose}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
