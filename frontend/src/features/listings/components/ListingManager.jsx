import { useQuery } from '@tanstack/react-query'
import { ImageOff, MoreHorizontal, Eye, Pause, Play, Trash2, UserCheck } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { formatPrice, formatAge } from '@utils/format'
import PropertyStatusPill from '@components/common/PropertyStatusPill'
import ActionMenu from '@components/common/ActionMenu'

// The owner's listing list. A ROW per listing, not a card in a grid: the four
// things an owner comes here for — what state it's in, what it earns, who is
// waiting, and what to do next — are a row's worth of facts, and the old
// 4-across card grid had room for none of them.
//
// Every row's actions are chosen by STATUS. A draft has nothing to preview, a
// pending listing has nobody to offer a lease to, and an active listing with
// two people waiting should lead with those two people.

// "Koramangala 5th Block · 2 BHK · Semi furnished" — where, how big, how
// furnished. The landmark first because that's how a place is named here.
const FURNISHED_LABEL = { FULLY: 'Furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

function metaLine(p) {
  const size = p.bhk ? `${p.bhk} BHK`
    : p.sharing ? `${p.sharing}-Sharing`
    : p.carpetArea ? `${p.carpetArea} sq.ft`
    : p.extent ? `${p.extent} ${p.extentUnit || 'sq.ft'}`
    : null
  const type = p.type === 'PG' ? 'PG' : p.type === 'LAND' ? 'Plot' : p.type === 'COMMERCIAL' ? 'Commercial' : null
  return [p.landmark || p.city, size, FURNISHED_LABEL[p.furnished], type].filter(Boolean).join(' · ')
}

// Two time labels the shared formatAge() can't give: it collapses everything
// from this morning into "Today", and an owner asking "has anyone looked at my
// listing yet" wants the hours.
function sinceLabel(date) {
  if (!date) return null
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  return formatAge(date)
}

// "Tuesday, 14:20" — for a draft, the weekday and the clock time are what jog
// the memory of where you left off.
function savedAtLabel(date) {
  if (!date) return null
  const d = new Date(date)
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return `today, ${time}`
  if (days < 7) return `${d.toLocaleDateString('en-IN', { weekday: 'long' })}, ${time}`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function Thumb({ property }) {
  const url = property.images?.[0]?.url
  return (
    <div className="w-[88px] h-[66px] sm:w-[120px] sm:h-[76px] shrink-0 rounded-xl bg-slate-100 overflow-hidden">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-500">
          <ImageOff className="w-6 h-6" strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}

// Full-width on a phone (nothing to sit beside it), auto on desktop. 44px tall
// either way — the documented minimum, which px-4 py-2.5 was one pixel under.
function Button({ children, onClick, variant = 'outline' }) {
  const styles = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white border-transparent',
    dark: 'bg-[#111111] hover:bg-[#2a2a2a] text-white border-transparent',
    outline: 'bg-white hover:border-slate-400 text-slate-700 border-slate-200',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full sm:w-auto shrink-0 min-h-[44px] px-4 py-3 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${styles}`}
    >
      {children}
    </button>
  )
}

// What this listing is worth reporting, per status. A draft has no price and no
// reach — showing "0 views" on something nobody could have seen reads as
// failure rather than as unfinished.
function RowStats({ property, inline = false }) {
  const { status, _count } = property
  const saved = _count?.savedBy ?? 0
  const views = property.viewCount ?? 0

  const price = status === 'DRAFT' ? '—' : formatPrice(property)
  const sub = status === 'DRAFT'
    ? (property.updatedAt ? `Saved ${savedAtLabel(property.updatedAt)}` : 'Not saved yet')
    : status === 'PENDING'
      ? (property.submittedAt ? `Submitted ${sinceLabel(property.submittedAt)}` : 'Awaiting review')
      : status === 'OCCUPIED'
        ? `Rented to ${property.currentTenant?.name ?? 'a tenant'}${property.occupiedSince ? ` since ${new Date(property.occupiedSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}` : ''}`
        : `${views} ${views === 1 ? 'view' : 'views'} · ${saved} saved`

  // On a phone the price belongs on the same line as its context, not in a
  // right-hand column there is no room for.
  if (inline) {
    return (
      <p className="text-sm">
        <span className={`font-mono font-bold ${status === 'DRAFT' ? 'text-slate-500' : 'text-slate-900'}`}>{price}</span>
        <span className="text-slate-500"> · {sub}</span>
      </p>
    )
  }

  return (
    <div className="text-right">
      <p className={`font-mono text-lg font-bold ${status === 'DRAFT' ? 'text-slate-500' : 'text-slate-900'}`}>{price}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  )
}

// Every row now offers at most TWO buttons plus an overflow menu, whatever the
// status. Five equal-weight buttons (View · Edit · Pause · Delete · Visit
// requests) is five decisions to read on every row — Hick's law — and it never
// fit a phone: the old row was a fixed `flex items-center` with no wrapping, so
// on a 375px screen the buttons were squeezed off the right edge.
//
// The split is by consequence, not by frequency:
//   primary   the one thing that moves this listing forward, per status
//   secondary Edit — the safe, reversible one an owner reaches for constantly
//   menu      everything else, with Delete last, red, and behind a tap
// Delete sitting inline and identical to View was a Fitts's-law accident
// waiting to happen: the most destructive control was the easiest to hit.
function rowActions({ property, onEdit, onPreview, onVisitRequests, onResume, onDelete, onToggleStatus, onMarkTenant, onVacate }) {
  const pendingVisits = property._count?.appointments ?? 0
  const del = { key: 'delete', label: 'Delete listing', icon: <Trash2 size={16} strokeWidth={1.8} />, danger: true, onClick: () => onDelete(property) }
  const edit = { label: 'Edit', onClick: () => onEdit(property.id) }

  if (property.status === 'DRAFT') {
    return {
      primary: { label: 'Resume', variant: 'primary', onClick: () => onResume(property) },
      secondary: null,
      menu: [del],
    }
  }

  if (property.status === 'PENDING') {
    // Preview means the real listing page a renter sees, not an internal
    // summary of it.
    return {
      primary: { label: 'Preview', onClick: () => onPreview(property) },
      secondary: edit,
      menu: [del],
    }
  }

  // Paused by US, not by them. The owner can still read and fix the listing,
  // but Pause and Delete are both withheld: the status isn't theirs to change
  // back (properties.service.js's toggleStatus only moves ACTIVE↔INACTIVE) and
  // deleting a listing under review is how evidence disappears. The server
  // enforces both — this just doesn't offer a button that would 409.
  if (property.status === 'SUSPENDED') {
    return {
      note: 'Paused by StayOnMap — see your notifications for the reason.',
      primary: { label: 'Edit', onClick: () => onEdit(property.id) },
      secondary: null,
      menu: [],
    }
  }

  if (property.status === 'REJECTED') {
    return {
      primary: { label: 'Submit again', variant: 'primary', onClick: () => onResume(property) },
      secondary: edit,
      menu: [del],
    }
  }

  // Rented through the platform (markTenant, mobile parity 2026-07-27). Off
  // the map while occupied, so nothing to view or pause — the one thing that
  // moves it forward is relisting it when the tenant leaves.
  if (property.status === 'OCCUPIED') {
    return {
      primary: { label: 'Mark as vacant', variant: 'primary', onClick: () => onVacate(property) },
      secondary: edit,
      menu: [del],
    }
  }

  const paused = property.status === 'INACTIVE'
  // The listing as a renter sees it. Same destination as the PENDING row's
  // "Preview", different word on purpose: a live listing is being VIEWED, one
  // awaiting review can only be previewed because nobody else can reach it yet.
  const view = { key: 'view', label: 'View listing', icon: <Eye size={16} strokeWidth={1.8} />, onClick: () => onPreview(property) }
  // Taking a listing off the map without deleting it is what an owner actually
  // wants when the flat is let or they're travelling.
  const pause = {
    key: 'pause',
    label: paused ? 'Resume listing' : 'Pause listing',
    icon: paused ? <Play size={16} strokeWidth={1.8} /> : <Pause size={16} strokeWidth={1.8} />,
    onClick: () => onToggleStatus(property),
  }
  // ACTIVE only — the server refuses to mark a paused listing occupied
  // (markTenant requires ACTIVE), so a paused row doesn't offer it.
  const markRented = paused ? null : {
    key: 'rented',
    label: 'Mark as rented',
    icon: <UserCheck size={16} strokeWidth={1.8} />,
    onClick: () => onMarkTenant(property),
  }

  // People waiting on the owner outrank everything else on the row. "Offer a
  // lease" was removed from here (2026-07-26): a lease offer needs a tenant,
  // and this row has no way to know which one, so it belongs in the Leases tab.
  if (pendingVisits > 0) {
    return {
      primary: { label: `Visit requests · ${pendingVisits}`, variant: 'primary', onClick: onVisitRequests },
      secondary: edit,
      menu: [view, pause, markRented, { key: 'div', divider: true }, del].filter(Boolean),
    }
  }

  return {
    primary: { label: 'View listing', onClick: () => onPreview(property) },
    secondary: edit,
    menu: [pause, markRented, { key: 'div', divider: true }, del].filter(Boolean),
  }
}

// Stacks on a phone, stays a row from `sm` up. The stats block is rendered
// once per breakpoint rather than duplicated with `hidden` — it reads
// differently in each place (a right-aligned column beside the actions, an
// inline line under the title) and holds no state, so there is nothing to
// desync.
function ListingRow({ property, ...handlers }) {
  const { note, primary, secondary, menu } = rowActions({ property, ...handlers })

  return (
    <article className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1 sm:gap-4 sm:items-center">
        <Thumb property={property} />
        <div className="flex-1 min-w-0">
          <PropertyStatusPill status={property.status} size="sm" />
          <p className="text-base font-bold text-slate-900 truncate mt-1.5">{property.title}</p>
          <p className="text-sm text-brand-700 truncate mt-0.5">
            {property.status === 'DRAFT' && !property.images?.length
              ? 'Photos not added yet'
              : metaLine(property)}
          </p>
          <div className="sm:hidden mt-2">
            <RowStats property={property} inline />
          </div>
        </div>
      </div>

      <div className="hidden sm:block">
        <RowStats property={property} />
      </div>

      {note && (
        <p className="text-xs text-slate-500 sm:max-w-[190px] sm:text-right">{note}</p>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {primary && <Button variant={primary.variant} onClick={primary.onClick}>{primary.label}</Button>}
        {secondary && <Button onClick={secondary.onClick}>{secondary.label}</Button>}
        {menu.length > 0 && (
          <ActionMenu
            label={`More actions for ${property.title}`}
            items={menu}
            trigger={<MoreHorizontal size={18} strokeWidth={2} />}
            triggerClassName="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        )}
      </div>
    </article>
  )
}

// The unfinished wizard draft, as a row. It has no server record — it lives in
// this browser — so it is built here rather than filtered out of the API
// response, and its actions act on localStorage, not on a property id.
function LocalDraftRow({ draft, label, onResume, onDiscard }) {
  const saved = draft.at ? `Saved ${savedAtLabel(draft.at)}` : 'Saved'

  return (
    <article className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-start gap-3 min-w-0 flex-1 sm:gap-4 sm:items-center">
        <Thumb property={{ images: draft.draft?.images ?? [] }} />
        <div className="flex-1 min-w-0">
          <PropertyStatusPill status="DRAFT" size="sm" />
          <p className="text-base font-bold text-slate-900 truncate mt-1.5">{label}</p>
          <p className="text-sm text-brand-700 truncate mt-0.5">
            {draft.draft?.images?.length ? 'Not submitted yet' : 'Photos not added yet'}
          </p>
          <p className="sm:hidden text-sm text-slate-500 mt-2">{saved}</p>
        </div>
      </div>
      <div className="hidden sm:block text-right">
        <p className="font-mono text-lg font-bold text-slate-500">—</p>
        <p className="text-xs text-slate-500 mt-0.5">{saved}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="primary" onClick={onResume}>Resume</Button>
        <ActionMenu
          label="More actions for this draft"
          items={[{ key: 'discard', label: 'Delete draft', icon: <Trash2 size={16} strokeWidth={1.8} />, danger: true, onClick: onDiscard }]}
          trigger={<MoreHorizontal size={18} strokeWidth={2} />}
          triggerClassName="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
      </div>
    </article>
  )
}

export default function ListingManager({
  onAdd, onEdit, onPreview, onVisitRequests, onResume, onDelete, onToggleStatus,
  onMarkTenant, onVacate,
  localDraft, localDraftLabel, onResumeLocalDraft, onDiscardLocalDraft,
}) {
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-[108px]" />)}
      </div>
    )
  }

  if (listings.length === 0 && !localDraft) {
    return (
      <button
        onClick={onAdd}
        className="w-full text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl hover:border-slate-300 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <p className="text-sm font-medium text-slate-600">No listings yet</p>
        <p className="text-xs text-slate-500 mt-1">Click to add your first listing</p>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {listings.map(p => (
        <ListingRow
          key={p.id}
          property={p}
          onEdit={onEdit}
          onPreview={onPreview}
          onVisitRequests={onVisitRequests}
          onResume={onResume}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
          onMarkTenant={onMarkTenant}
          onVacate={onVacate}
        />
      ))}
      {localDraft && (
        <LocalDraftRow
          draft={localDraft}
          label={localDraftLabel}
          onResume={onResumeLocalDraft}
          onDiscard={onDiscardLocalDraft}
        />
      )}
    </div>
  )
}
