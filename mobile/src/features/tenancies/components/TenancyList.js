import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenancyService } from '@services/tenancy.service'
import Icon from '@components/common/Icon'
import FormSheet from '@components/common/FormSheet'
import { MIN_TAP_SIZE } from '@theme/touchTargets'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The tenancy record — RN mirror of web's TenancySection. `hat` comes from
// the caller; `propertyId` optionally narrows an owner's list to one listing
// (ManageListing). Renders nothing with no history: the record announces
// itself through the confirm notification, not an empty box.

function monthsLabel(t) {
  const end = t.endedAt ? new Date(t.endedAt) : new Date()
  const months = Math.max(0, Math.floor((end - new Date(t.startedAt)) / (30 * 864e5)))
  return months < 1 ? 'less than a month' : `${months} month${months === 1 ? '' : 's'}`
}

function Stars({ value, size = 13 }) {
  return (
    <View style={styles.starRow} accessible accessibilityRole="image" accessibilityLabel={`Rated ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name={n <= value ? 'star' : 'starOutline'} size={size} color={n <= value ? colors.warning : colors.slate200} />
      ))}
    </View>
  )
}

function ReviewSheet({ tenancy, otherRole, onClose }) {
  const qc = useQueryClient()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => tenancyService.addReview(tenancy.id, { rating, content: content.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenancies'] }); onClose() },
    onError: (e) => setError(e?.message ?? 'Couldn’t submit — please try again.'),
  })

  return (
    <FormSheet
      visible
      onClose={onClose}
      title={`Review your ${otherRole}`}
      onSave={() => rating && content.trim().length >= 10 && mutation.mutate()}
      saving={mutation.isPending}
      saveLabel="Submit review"
    >
      <Text style={styles.blurb}>
        Reviews are double-blind: neither of you sees the other&rsquo;s until both are written, or
        14 days pass. Write it honestly — it can&rsquo;t be answered back at.
      </Text>
      <View style={styles.pickRow} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setRating(n)}
            style={styles.pickStar}
            accessibilityRole="radio"
            accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
            accessibilityState={{ checked: n === rating }}
          >
            <Icon name={n <= rating ? 'star' : 'starOutline'} size={22} color={n <= rating ? colors.warning : colors.slate200} />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={1000}
        placeholder="How was the tenancy? Rent on time, communication, the state of the home…"
        placeholderTextColor={colors.slate500}
        style={styles.input}
        accessibilityLabel="Review text"
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={{ height: spacing.md }} />
    </FormSheet>
  )
}

function TenancyCard({ t, hat, onReview }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tenancies'] })
  const confirm = useMutation({ mutationFn: () => tenancyService.confirm(t.id), onSuccess: invalidate })
  const decline = useMutation({ mutationFn: () => tenancyService.decline(t.id), onSuccess: invalidate })
  const needsConfirm = hat === 'tenant' && !t.confirmedAt
  const busy = confirm.isPending || decline.isPending

  return (
    <View style={styles.card}>
      <Text style={styles.title} numberOfLines={1}>{t.property.title}</Text>
      <Text style={styles.meta}>
        {t.property.city} · {monthsLabel(t)}{t.endedAt ? '' : ' · ongoing'}
      </Text>

      {needsConfirm && (
        <>
          <Text style={styles.confirmNote}>
            The owner marked you as their tenant. Confirming builds your rental history; it
            counts for nothing until you do.
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => confirm.mutate()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Yes, I rent here"
            >
              <Text style={styles.primaryButtonText}>Yes, I rent here</Text>
            </Pressable>
            <Pressable
              style={[styles.ghostButton, busy && styles.disabled]}
              onPress={() => decline.mutate()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Not me — remove this record"
            >
              <Text style={styles.ghostButtonText}>Not me</Text>
            </Pressable>
          </View>
        </>
      )}

      {!needsConfirm && t.canReview && (
        <Pressable
          style={styles.ghostButton}
          onPress={() => onReview(t)}
          accessibilityRole="button"
          accessibilityLabel={`Review your ${hat === 'owner' ? 'tenant' : 'owner'}`}
        >
          <Text style={styles.ghostButtonText}>Review your {hat === 'owner' ? 'tenant' : 'owner'}</Text>
        </Pressable>
      )}

      {t.myReview && (
        <View style={styles.reviewWell}>
          <Text style={styles.reviewLabel}>Your review</Text>
          <Stars value={t.myReview.rating} />
          <Text style={styles.reviewBody}>{t.myReview.content}</Text>
        </View>
      )}
      {t.theirReview && (
        <View style={[styles.reviewWell, styles.theirWell]}>
          <Text style={styles.reviewLabel}>Their review</Text>
          <Stars value={t.theirReview.rating} />
          <Text style={styles.reviewBody}>{t.theirReview.content}</Text>
        </View>
      )}
      {t.theirReviewPending && (
        <Text style={styles.pending}>
          They&rsquo;ve written a review — write yours to see it, or it becomes visible in 14 days.
        </Text>
      )}
    </View>
  )
}

export default function TenancyList({ hat, propertyId, enabled = true }) {
  const [reviewing, setReviewing] = useState(null)
  const { data: all = [] } = useQuery({
    queryKey: ['tenancies', hat],
    queryFn: () => tenancyService.mine(hat).then((r) => r.data),
    enabled,
  })
  const tenancies = propertyId ? all.filter((t) => t.property.id === propertyId) : all

  if (!tenancies.length) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{hat === 'owner' ? 'Tenancy record' : 'Where you’ve rented'}</Text>
      {tenancies.map((t) => (
        <TenancyCard key={t.id} t={t} hat={hat} onReview={setReviewing} />
      ))}
      {reviewing && (
        <ReviewSheet
          tenancy={reviewing}
          otherRole={hat === 'owner' ? 'tenant' : 'owner'}
          onClose={() => setReviewing(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.lg },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs,
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  confirmNote: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18, color: '#b45309', marginTop: 2 },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  primaryButton: {
    minHeight: MIN_TAP_SIZE, paddingHorizontal: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  ghostButton: {
    minHeight: MIN_TAP_SIZE, paddingHorizontal: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start', marginTop: spacing.xs,
  },
  ghostButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  disabled: { opacity: 0.6 },
  starRow: { flexDirection: 'row', gap: 1 },
  reviewWell: { backgroundColor: colors.slate50, borderRadius: radius.md, padding: spacing.sm, gap: 4, marginTop: spacing.xs },
  theirWell: { backgroundColor: colors.brand50 },
  reviewLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  reviewBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.slate700 },
  pending: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18, color: colors.slate500, marginTop: 2 },
  // Review sheet
  blurb: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.slate600, marginBottom: spacing.md },
  pickRow: { flexDirection: 'row', marginBottom: spacing.sm },
  pickStar: { width: MIN_TAP_SIZE, height: MIN_TAP_SIZE, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 96, textAlignVertical: 'top', padding: spacing.sm,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, backgroundColor: colors.white,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing.sm },
})
