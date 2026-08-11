import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BellPlus } from 'lucide-react'
import { savedSearchService } from '@services/savedSearch.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { toQueryParams, TYPE_CATEGORIES } from '@/config/filters'
import { formatCompact } from '@utils/format'
import Modal from '@components/common/Modal'
import { toast } from '@components/common/Toaster'

// "Tell me when a new home matches this." Lives beside the results, because a
// search worth saving is one that just came back thin — the moment somebody
// realises today's inventory doesn't have their home is the moment the
// platform should offer to keep looking.
//
// What gets stored is toQueryParams(filters) — the same wire shape the grid
// just fetched with — plus the bounds that constrained it, MINUS nearMetro:
// the backend rejects proximity params outright (savedSearch.validation.js
// says why), so the omission is disclosed in the dialog rather than silent.

function suggestName(filters, locationLabel) {
  const parts = []
  const cats = TYPE_CATEGORIES.filter((c) => c.types.some((t) => filters.types?.includes(t)))
  if (cats.length && cats.length < TYPE_CATEGORIES.length) {
    parts.push(cats.map((c) => c.label).join(' / '))
  } else {
    parts.push('Homes')
  }
  if (filters.bhk?.length) parts.push(`${[...filters.bhk].sort().join('/')} BHK`)
  if (filters.rentMax) parts.push(`under ₹${formatCompact(filters.rentMax).replace('₹', '')}`)
  if (locationLabel) parts.push(`in ${locationLabel}`)
  return parts.join(' ').slice(0, 80)
}

export default function SaveSearchButton({ filters, bounds, locationLabel }) {
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const nearMetroActive = !!filters.nearMetro

  const mutation = useMutation({
    mutationFn: () => {
      const { nearMetro: _nearMetro, ...query } = toQueryParams(filters)
      return savedSearchService.create({ name: name.trim(), query: { ...query, ...(bounds ?? {}) } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-searches'] })
      setOpen(false)
      toast.success('Search saved', 'We’ll notify you when a new home matches.')
    },
    onError: (err) => toast.error('Couldn’t save this search', err?.message),
  })

  function start() {
    if (!user) return openLoginModal()
    setName(suggestName(filters, locationLabel))
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={start}
        className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <BellPlus size={16} aria-hidden="true" />
        Save this search
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Save this search">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            We&rsquo;ll notify you when a <span className="font-semibold">newly listed</span> home
            matches — never for edits or relistings.
          </p>
          <div>
            <label htmlFor="saved-search-name" className="block text-sm font-medium text-slate-700 mb-1">
              Name
            </label>
            <input
              id="saved-search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {nearMetroActive && (
            <p className="text-sm text-amber-700">
              The distance-to-metro filter isn&rsquo;t part of saved-search alerts — everything
              else you&rsquo;ve set is.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="min-h-[40px] px-4 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!name.trim() || mutation.isPending}
              className="min-h-[40px] px-5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving…' : 'Save search'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
