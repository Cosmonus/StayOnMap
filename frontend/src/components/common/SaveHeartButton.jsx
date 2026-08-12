import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { savedService } from '@services/saved.service'

// The scrim-circle save heart that sits on a photo — extracted so a card can
// gain one without re-deriving saved state, the optimistic flip and the
// signed-out branch a fourth time.
//
// It owns its own saved state rather than taking an `isSaved` prop, because the
// surfaces that need it (recommendation rows) receive listings from endpoints
// that say nothing about what the reader has saved. `['saved']` is one shared
// React Query key, so a grid of twelve cards is still one request — the same
// key DetailTopBar already reads.
//
// SIGNED OUT OPENS THE LOGIN MODAL, it does not quietly do nothing. A heart
// that accepts a tap and forgets it is worse than one that explains itself.
//
// Place it INSIDE a `relative` container and ABOVE any stretched card link
// (z-20): an <a> may not contain a <button>, which is why the cards that use
// this stretch a link across the card instead of wrapping it.
export default function SaveHeartButton({ propertyId, className = '' }) {
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const qc = useQueryClient()

  const { data: savedList } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  // Derived during render, with the optimistic tap as an override — NOT synced
  // into state by an effect. An effect would fight the optimistic flip (the
  // list re-fetches after the mutation, so the two would take turns) and mobile's
  // lint rule rejects it outright. The override outlives the round trip on
  // purpose; onError puts it back.
  const [override, setOverride] = useState(null)
  const saved = override ?? !!savedList?.some((s) => s.propertyId === propertyId)

  const mutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(propertyId) : savedService.unsave(propertyId),
    onMutate: (isSaving) => setOverride(isSaving),
    onError: (_err, isSaving) => setOverride(!isSaving),
    // `['saved']` only, like the two hearts that came before it. NOT
    // `['saved-summary']`: fetching that endpoint is what RECORDS the visit
    // "new since you last looked" measures against, so invalidating it would
    // clear that marker under a reader who is still looking at it. A count one
    // navigation stale is the cheaper wrong.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { openLoginModal(); return }
    mutation.mutate(!saved)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? 'Remove from saved' : 'Save property'}
      aria-pressed={saved}
      className={`w-8 h-8 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-150 ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${className}`}
    >
      <Heart
        size={18}
        fill={saved ? '#ef4444' : 'none'}
        stroke={saved ? '#ef4444' : 'white'}
        strokeWidth={2}
      />
    </button>
  )
}
