import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BellRing, Trash2 } from 'lucide-react'
import { savedSearchService } from '@services/savedSearch.service'
import { toast } from '@components/common/Toaster'

// The searches the platform is watching for this person. Lives on the saved
// list beside the saved homes — the same argument that put HomesForYou here:
// it is the one screen built from the renter's own choices.
//
// Renders NOTHING when there are none. The affordance to create one lives on
// the results page, where a thin result makes the offer make sense; an empty
// "saved searches" box here would be a feature advertising itself.

export default function SavedSearches() {
  const qc = useQueryClient()
  const { data: searches = [] } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: () => savedSearchService.list().then((r) => r.data),
  })

  const remove = useMutation({
    mutationFn: (id) => savedSearchService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-searches'] }),
    onError: () => toast.error('Couldn’t delete', 'Please try again.'),
  })

  if (!searches.length) return null

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-slate-800 mb-3">Watching for you</h2>
      <div className="space-y-2">
        {searches.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200"
          >
            <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 flex items-center justify-center">
              <BellRing size={16} className="text-brand-600" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                You&rsquo;ll hear when a new home matches
              </p>
            </div>
            <button
              onClick={() => remove.mutate(s.id)}
              disabled={remove.isPending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
              aria-label={`Stop watching “${s.name}”`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        Change what you&rsquo;re looking for from the{' '}
        <Link to="/properties" className="text-brand-700 font-medium">
          properties page
        </Link>
        &rsquo;s filters — then save the new search.
      </p>
    </section>
  )
}
