import { useState, useRef } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewService } from '@services/review.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

const RATING_LABELS = {
  ratingsSafety: 'Safety', ratingsClean: 'Cleanliness', ratingsWater: 'Water',
  ratingsNoise: 'Noise', ratingsInternet: 'Internet', ratingsParking: 'Parking',
  ratingsNeighborhood: 'Neighborhood', ratingsTransport: 'Transport', ratingsMaintenance: 'Maintenance',
  ratingsOwnerBehavior: 'Owner', ratingsSecurity: 'Security', ratingsPowerBackup: 'Power',
}

const REVIEWER_TYPES = [
  { value: 'TENANT', label: 'Current Tenant' },
  { value: 'PREVIOUS_TENANT', label: 'Previous Tenant' },
  { value: 'NEIGHBOR', label: 'Neighbor' },
  { value: 'COMMUNITY', label: 'Community' },
]

const MIN_CHARS = 10
const INITIAL_VISIBLE_REVIEWS = 5

function avgRating(review) {
  const keys = Object.keys(RATING_LABELS)
  return keys.reduce((s, k) => s + (review[k] ?? 0), 0) / keys.length
}

function StarPicker({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}>
          <Icon name={n <= value ? 'star' : 'starOutline'} size={20} color={n <= value ? colors.warning : colors.slate200} />
        </Pressable>
      ))}
    </View>
  )
}

function StarDisplay({ value, size = 14 }) {
  const rounded = Math.round(value)
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name={i < rounded ? 'star' : 'starOutline'} size={size} color={i < rounded ? colors.warning : colors.slate200} />
      ))}
    </View>
  )
}

function WriteReviewForm({ propertyId, onCancel, onSuccess }) {
  const qc = useQueryClient()
  const defaultRatings = Object.fromEntries(Object.keys(RATING_LABELS).map((k) => [k, 3]))
  const [form, setForm] = useState({ reviewerType: 'TENANT', recommend: true, isAnonymous: false, body: '', ...defaultRatings })
  // How long the form was open. A ref, not state — reading it must never
  // re-render, and it must survive every keystroke between mount and submit.
  const openedAt = useRef(Date.now())

  const mutation = useMutation({
    mutationFn: (data) => reviewService.submit(propertyId, { ...data, composeMs: Date.now() - openedAt.current }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reviews', propertyId] })
      // Web has said what happens next since it was built; mobile closed the
      // form and said nothing, which was survivable while every review queued
      // and is not now — a review held for a moderator would simply vanish.
      const published = res?.data?.status === 'APPROVED'
      Alert.alert(
        published ? 'Review published' : 'Review submitted',
        published
          ? 'Thanks — your review is live on this listing.'
          : 'A moderator will read this one before it appears.',
      )
      onSuccess?.()
    },
  })

  const setRating = (key, val) => setForm((f) => ({ ...f, [key]: val }))
  const isValid = form.body.trim().length >= MIN_CHARS && !mutation.isPending

  return (
    <View style={styles.formCard}>
      <View style={styles.formHeaderRow}>
        <Text style={styles.formTitle}>Write a review</Text>
        <Pressable onPress={onCancel} hitSlop={8}><Text style={styles.cancelLink}>Cancel</Text></Pressable>
      </View>

      <Text style={styles.label}>You are a</Text>
      <View style={styles.chipRow}>
        {REVIEWER_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.chip, form.reviewerType === t.value && styles.chipActive]}
            onPress={() => setForm((f) => ({ ...f, reviewerType: t.value }))}
          >
            <Text style={[styles.chipText, form.reviewerType === t.value && styles.chipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toggleRow}>
        {[{ key: 'recommend', label: 'I recommend this' }, { key: 'isAnonymous', label: 'Post anonymously' }].map(({ key, label }) => (
          <Pressable
            key={key}
            style={[styles.toggle, form[key] && styles.toggleActive]}
            onPress={() => setForm((f) => ({ ...f, [key]: !f[key] }))}
          >
            {form[key] && <Icon name="check" size={11} color={colors.brand600} />}
            <Text style={[styles.toggleText, form[key] && styles.toggleTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Rate each category</Text>
      <View style={{ gap: spacing.xs }}>
        {Object.entries(RATING_LABELS).map(([key, label]) => (
          <View key={key} style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>{label}</Text>
            <StarPicker value={form[key]} onChange={(v) => setRating(key, v)} />
          </View>
        ))}
      </View>

      <Text style={styles.label}>Your experience</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={form.body}
        onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
        placeholder="Share your experience — what was great, what could be better"
        placeholderTextColor={colors.slate500}
        multiline
        numberOfLines={4}
      />
      <Text style={styles.hint}>
        {form.body.trim().length < MIN_CHARS ? `${MIN_CHARS - form.body.trim().length} more characters needed` : 'Looks good ✓'}
      </Text>

      {mutation.isError && <Text style={styles.errorText}>{mutation.error?.message || 'Failed to submit. Please try again.'}</Text>}

      <Pressable style={[styles.submitButton, !isValid && styles.disabled]} onPress={() => mutation.mutate(form)} disabled={!isValid}>
        {mutation.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.submitButtonText}>Submit Review</Text>}
      </Pressable>
    </View>
  )
}

function ReviewCard({ review, propertyId, isOwner, ownerName }) {
  const qc = useQueryClient()
  const [replyOpen, setReplyOpen] = useState(false)
  const [draft, setDraft] = useState(review.ownerResponse ?? '')

  const name = review.isAnonymous ? 'Anonymous' : (review.reviewer?.name ?? 'Community Member')
  const avg = avgRating(review)
  const date = new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const type = REVIEWER_TYPES.find((t) => t.value === review.reviewerType)?.label ?? review.reviewerType

  const replyMutation = useMutation({
    mutationFn: (text) => reviewService.respond(propertyId, review.id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', propertyId] })
      setReplyOpen(false)
    },
  })

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeaderRow}>
        <View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{review.isAnonymous ? '?' : name[0].toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewerName}>{name}</Text>
          <Text style={styles.reviewMeta}>{type} · {date}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={styles.reviewAvgScore}>{avg.toFixed(1)}</Text>
          <Icon name="star" size={13} color={colors.warning} />
        </View>
      </View>

      <Text style={styles.reviewBody}>{review.body}</Text>

      <View style={styles.recommendRow}>
        <Icon name={review.recommend ? 'check' : 'close'} size={12} color={review.recommend ? colors.brand600 : colors.danger} />
        <Text style={[styles.recommendText, { color: review.recommend ? colors.brand600 : colors.danger }]}>
          {review.recommend ? 'Recommends this property' : 'Does not recommend'}
        </Text>
      </View>

      {review.ownerResponse && !replyOpen && (
        <View style={styles.ownerReplyBox}>
          <Text style={styles.ownerReplyLabel}>{ownerName ?? 'Owner'} · Owner response</Text>
          <Text style={styles.ownerReplyText}>{review.ownerResponse}</Text>
          {isOwner && (
            <Pressable onPress={() => { setDraft(review.ownerResponse ?? ''); setReplyOpen(true) }}>
              <Text style={styles.editReplyLink}>Edit response</Text>
            </Pressable>
          )}
        </View>
      )}

      {isOwner && !review.ownerResponse && !replyOpen && (
        <Pressable onPress={() => setReplyOpen(true)}><Text style={styles.replyLink}>Reply as owner</Text></Pressable>
      )}

      {isOwner && replyOpen && (
        <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <TextInput
            style={[styles.input, styles.replyInput]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a professional, helpful response…"
            placeholderTextColor={colors.slate500}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable style={styles.replySubmit} onPress={() => replyMutation.mutate(draft.trim())} disabled={replyMutation.isPending || !draft.trim()}>
              <Text style={styles.replySubmitText}>{replyMutation.isPending ? 'Saving…' : 'Post response'}</Text>
            </Pressable>
            <Pressable style={styles.replyCancel} onPress={() => setReplyOpen(false)}>
              <Text style={styles.replyCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

export default function ReviewsSection({ propertyId, title, isOwner = false, ownerName = null }) {
  const [writeOpen, setWriteOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', propertyId],
    queryFn: () => reviewService.list(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  if (isLoading) return <View style={styles.loadingBox} />

  const count = reviews.length
  const totalAvg = count > 0 ? reviews.reduce((s, r) => s + avgRating(r), 0) / count : 0
  const recommendPct = count > 0 ? Math.round((reviews.filter((r) => r.recommend).length / count) * 100) : 0

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {title && <Text style={styles.sectionTitle}>{title}</Text>}
          {count > 0 && (
            <View style={styles.ratingSummary}>
              <Text style={styles.headerAvg}>{totalAvg.toFixed(1)}</Text>
              <StarDisplay value={totalAvg} size={16} />
              <Text style={styles.headerCount}>{count} review{count !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>
        <Pressable style={styles.writeButton} onPress={() => setWriteOpen((v) => !v)}>
          {!writeOpen && <Icon name="edit" size={12} color={colors.slate600} />}
          <Text style={styles.writeButtonText}>{writeOpen ? 'Cancel' : 'Write a review'}</Text>
        </Pressable>
      </View>

      {count > 0 && (
        <View style={styles.recommendBarRow}>
          <View style={styles.recommendBarTrack}><View style={[styles.recommendBarFill, { width: `${recommendPct}%` }]} /></View>
          <Text style={styles.recommendBarText}>{recommendPct}% recommend</Text>
        </View>
      )}

      {writeOpen && (
        <WriteReviewForm propertyId={propertyId} onCancel={() => setWriteOpen(false)} onSuccess={() => setWriteOpen(false)} />
      )}

      {count === 0 && !writeOpen ? (
        <View style={styles.emptyBox}>
          <Icon name="star" size={18} color={colors.slate200} />
          <Text style={styles.emptyText}>No reviews yet. Be the first to share your experience.</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {(showAll ? reviews : reviews.slice(0, INITIAL_VISIBLE_REVIEWS)).map((r) => (
            <ReviewCard key={r.id} review={r} propertyId={propertyId} isOwner={isOwner} ownerName={ownerName} />
          ))}
          {!showAll && count > INITIAL_VISIBLE_REVIEWS && (
            <Pressable
              style={styles.showAllButton}
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show all ${count} reviews`}
            >
              <Text style={styles.showAllText}>Show all {count} reviews</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  loadingBox: { height: 96, backgroundColor: colors.slate50, borderRadius: radius.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexShrink: 1, gap: spacing.xs },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvg: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800 },
  headerCount: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  writeButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, justifyContent: 'center', },
  writeButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  recommendBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  recommendBarTrack: { flex: 1, height: 8, backgroundColor: colors.slate100, borderRadius: radius.full, overflow: 'hidden' },
  recommendBarFill: { height: '100%', backgroundColor: colors.success },
  recommendBarText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  emptyBox: { paddingVertical: spacing.xl, backgroundColor: colors.slate50, borderRadius: radius.lg, alignItems: 'center', gap: 6 },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  showAllButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md },
  showAllText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },

  formCard: { borderWidth: 1, borderColor: colors.brand100, backgroundColor: colors.brand50, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  formHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  cancelLink: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate500 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white },
  toggleActive: { backgroundColor: colors.brand50, borderColor: colors.brand200 },
  toggleText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate500 },
  toggleTextActive: { color: colors.brand600 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  ratingLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800, backgroundColor: colors.white },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger },
  submitButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', minHeight: 48, justifyContent: 'center', },
  submitButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.5 },

  reviewCard: { borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.white },
  reviewHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  reviewAvatar: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  reviewAvatarText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  reviewerName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  reviewMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  reviewAvgScore: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  reviewBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate700, lineHeight: 18 },
  recommendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  recommendText: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  ownerReplyBox: { marginTop: spacing.sm, marginLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.brand100, paddingLeft: spacing.sm },
  ownerReplyLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand700, marginBottom: 2 },
  ownerReplyText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate700, lineHeight: 16 },
  editReplyLink: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand600, marginTop: 4 },
  replyLink: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate500, marginTop: spacing.sm },
  replyInput: { minHeight: 56, fontSize: 11 },
  replySubmit: { flex: 1, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  replySubmitText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  replyCancel: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.slate100 },
  replyCancelText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate600 },
})
