import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { placesService } from '@services/places.service'

// Live Distance Matrix lookup from this property's coordinates to a
// tenant-typed destination — reuses the same Google key and probe pattern
// as areaIntelligence.service.js's computeTraffic, just with a real
// destination instead of a fixed short hop.
export default function CommuteCalculator({ lat, lng }) {
  const [destination, setDestination] = useState('')

  const mutation = useMutation({
    mutationFn: () => placesService.getCommute(lat, lng, destination).then((r) => r.data),
  })

  if (lat == null || lng == null) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!destination.trim() || mutation.isPending) return
    mutation.mutate()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-800">Commute calculator</h3>
      <p className="text-[11px] text-slate-500 mt-0.5 mb-3">See live travel time from here to work, college, or anywhere else</p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. Whitefield, Bengaluru"
          className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        />
        <button
          type="submit"
          disabled={!destination.trim() || mutation.isPending}
          className="min-h-[44px] px-3 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
        >
          {mutation.isPending ? '...' : 'Check'}
        </button>
      </form>

      {mutation.isSuccess && (
        mutation.data ? (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            <p className="text-xs text-slate-600 truncate" title={mutation.data.destinationAddress}>
              To {mutation.data.destinationAddress}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-brand-600">
                {mutation.data.durationInTrafficText ?? mutation.data.durationText}
              </span>
              {mutation.data.distanceText && <span className="text-xs text-slate-500">{mutation.data.distanceText}</span>}
            </div>
            {mutation.data.durationInTrafficText && mutation.data.durationInTrafficText !== mutation.data.durationText && (
              <p className="text-[11px] text-slate-500">Free-flow: {mutation.data.durationText}</p>
            )}
          </div>
        ) : (
          <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Couldn&apos;t find that place — try a more specific address.
          </p>
        )
      )}

      {mutation.isError && (
        <p className="mt-3 pt-3 border-t border-slate-100 text-xs text-red-500">Something went wrong — try again.</p>
      )}
    </div>
  )
}
