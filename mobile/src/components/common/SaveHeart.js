import { useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { radius } from '@theme/spacing'
import { tapSlop } from '@theme/touchTargets'

// The scrim-circle save heart that sits on a card photo. Mirrors web's
// SaveHeartButton.
//
// It owns its own saved state rather than taking an `isSaved` prop, because the
// surfaces that need it — the recommendation rows — receive listings from
// endpoints that say nothing about what the reader has saved. `['saved']` is one
// shared React Query key, so a list of twelve cards is still one request.
//
// Signed out renders NOTHING. Mobile has no global login modal to open the way
// web does, and a heart that accepts a tap and forgets it is worse than an
// absent one — the same rule the phone-call button follows.
export default function SaveHeart({ propertyId, style }) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: savedList } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
    enabled: !!user,
    staleTime: 60 * 1000,
  })

  // Derived during render, with the optimistic tap as an override — NOT synced
  // into state by an effect. An effect would be a cascading render (the lint
  // rule says so) and would also fight the optimistic flip: the list refetches
  // after the mutation, so the effect and onMutate would take turns.
  // The override outlives the round trip on purpose; onError puts it back.
  const [override, setOverride] = useState(null)
  const saved = override ?? !!savedList?.some((s) => s.propertyId === propertyId)

  const mutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving
        ? savedService.save(propertyId).then((r) => r.data)
        : savedService.unsave(propertyId).then((r) => r.data),
    onMutate: (isSaving) => setOverride(isSaving),
    onError: (_err, isSaving) => setOverride(!isSaving),
    // `['saved']` only. Fetching `['saved-summary']` is what RECORDS the visit
    // that "new since you last looked" measures against, so invalidating it
    // would clear that marker under a reader still looking at it.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  if (!user) return null

  return (
    <Pressable
      style={[styles.button, style]}
      onPress={() => mutation.mutate(!saved)}
      hitSlop={tapSlop(32)}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save property'}
      accessibilityState={{ selected: saved }}
    >
      <Icon name={saved ? 'heartFilled' : 'heart'} size={16} color={saved ? colors.danger : colors.white} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
