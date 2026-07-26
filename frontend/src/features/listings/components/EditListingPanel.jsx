import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { toast } from '@components/common/Toaster'
import ListingFormTabs from './ListingFormTabs'
import {
  categoryFromType, draftFromProperty, deriveType, DESCRIBE,
  missingRequirements, buildUpdatePayload,
} from '../config/onboarding.js'

// Editing a listing — the SAME six type-aware panels the add flow uses, behind
// the same tab bar (ListingFormTabs.jsx explains why they are one component).
//
// Two things this replaced. First, ListingDetailContent: a three-column
// moderation console — every person who touched the listing, their appointment
// history, their full chat transcript and contact details. That is the ADMIN
// property view's shape, and owners must never be handed a surface built for
// platform operators. Second, EditListingForm: a type-BLIND form, so a plot's
// survey number, a PG's beds and a shop's frontage were uneditable on web.
export default function EditListingPanel({ propertyId, onBack }) {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('basics')
  const [draft, setDraft] = useState(null)
  const [uploading, setUploading] = useState(false)

  const { data: property, isLoading, isError, refetch } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  const categoryKey = property ? categoryFromType(property.type) : null

  // Seeded once from the saved listing, then owned by the form. Deriving it on
  // every render would throw away each keystroke.
  const seeded = useMemo(
    () => (property && categoryKey ? draftFromProperty(property, categoryKey) : null),
    [property, categoryKey],
  )
  const current = draft ?? seeded

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      const type = deriveType(categoryKey, current.fields[DESCRIBE[categoryKey].k])
      const amenityIds = amenities.filter((a) => current.amenityNames.includes(a.name)).map((a) => a.id)
      return propertyService.update(propertyId, buildUpdatePayload(categoryKey, type, current, amenityIds))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property', propertyId] })
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Saved', 'Your listing is updated')
      onBack()
    },
    onError: (err) => toast.error('Couldn’t save', err.message ?? 'Please try again'),
  })

  // The same checks the add flow runs, so an edit can't quietly strip a listing
  // of something it needed to be published in the first place.
  const missing = current && categoryKey ? missingRequirements(categoryKey, current) : []

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="shrink-0 flex items-center gap-3 px-6 md:px-10 py-4 border-b border-slate-100">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to my listings"
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900 truncate">{property?.title ?? 'Edit listing'}</p>
          <p className="text-sm text-slate-500">Changes go live as soon as you save</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        <div className="max-w-5xl mx-auto w-full">
          {isLoading && <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />}

          {isError && (
            <div className="text-center py-16">
              <p className="text-sm text-slate-600">We couldn&apos;t load this listing.</p>
              <button
                onClick={() => refetch()}
                className="min-h-[44px] mt-3 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Try again
              </button>
            </div>
          )}

          {current && categoryKey && (
            <ListingFormTabs
              mode="edit"
              categoryKey={categoryKey}
              draft={current}
              setDraft={(updater) => setDraft((d) => (typeof updater === 'function' ? updater(d ?? seeded) : updater))}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              missing={missing}
              onUploadingChange={setUploading}
            />
          )}
        </div>
      </div>

      {current && (
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 md:px-10 py-4 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3 py-3 -ml-3 rounded-xl text-sm font-bold text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Cancel
          </button>
          <div className="flex items-center gap-4">
            {missing.length > 0 && (
              <p className="hidden sm:block text-sm text-amber-700">
                {missing.length} {missing.length === 1 ? 'thing needs' : 'things need'} fixing
              </p>
            )}
            {/* Tabs, not steps — so the footer offers the one action an edit has.
                Which tab you happen to be on is irrelevant to saving. */}
            <button
              type="button"
              onClick={() => save()}
              disabled={isPending || uploading || missing.length > 0}
              className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
