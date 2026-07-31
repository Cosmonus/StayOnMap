import { useCallback, useState } from 'react'
import {
  View, Text, Pressable, ScrollView, TextInput, Modal,
  ActivityIndicator, KeyboardAvoidingView, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { hostService } from '@services/host.service'
import { appointmentService } from '@services/appointment.service'
import { reviewService } from '@services/review.service'
import { syncAndReadDraft } from '@features/listings/components/onboarding/draftSync'
import { CATEGORIES, suggestTitle } from '@features/listings/config/onboarding.js'
import { WIZARD_STEPS as STEPS, savedStep } from '@features/listings/config/wizardSteps.js'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import NotificationBell from '@components/common/NotificationBell'
import { VISIT_SLOTS, formatTime } from '@utils/time'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The owner's home screen. One question first — is anyone waiting on me? — and
// every number second.
//
// It replaced a screen that counted the owner's own listings four ways ("My
// listings 3 · Active 2 · Pending 1 · Drafts 0"). An owner already knows how
// many listings they have; what they cannot know without opening something is
// that a renter asked to visit on Saturday.
//
// What it deliberately does not do: greet, congratulate, or chart. Same
// contents as web's HostDashboard, off the same single endpoint.

const NEXT_14_DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return {
    value: d.toISOString().split('T')[0],
    label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
})

function sinceLabel(date) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

function visitWhen(item) {
  const d = new Date(item.requestedDate)
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
  return item.requestedTime ? `${date}, ${formatTime(item.requestedTime)}` : date
}

// Only the topmost thing carries buttons; tapping any other row moves the
// buttons to it. Five stacked cards each with three buttons is a wall, and the
// queue is ordered by newest question for a reason — but every item stays fully
// actionable, so nothing is buried in another tab.
function VisitCard({ item, open, onOpen, onAccept, onSuggest, onDecline, busy }) {
  if (!open) {
    return (
      <Pressable style={styles.card} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${item.person}, ${visitWhen(item)}`}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.person} — {visitWhen(item)}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.listing} · asked {sinceLabel(item.askedAt)}</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.card, styles.cardOpen]}>
      <Text style={styles.eyebrow}>Needs you today</Text>
      <Text style={styles.cardTitleOpen}>{item.person} wants to visit {visitWhen(item)}</Text>
      <Text style={styles.cardMetaOpen}>
        {item.listing}
        {/* Only when we have a record — someone can ask for a visit straight
            from a map pin, and "viewed it 0 times" would be a claim. */}
        {item.viewerViews ? ` · viewed it ${item.viewerViews} ${item.viewerViews === 1 ? 'time' : 'times'}` : ` · asked ${sinceLabel(item.askedAt)}`}
      </Text>

      <View style={styles.cardActions}>
        <Pressable
          style={[styles.primaryButton, busy && styles.buttonBusy]}
          onPress={() => onAccept(item)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.primaryButtonText}>Accept</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, busy && styles.buttonBusy]}
          onPress={() => onSuggest(item)}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>Another time</Text>
        </Pressable>
      </View>

      {/* Declining has to be possible without being the loudest thing on the
          card — a host reads this while doing something else. */}
      <Pressable style={styles.declineButton} onPress={() => onDecline(item)} disabled={busy} accessibilityRole="button">
        <Text style={styles.declineText}>Can&apos;t do it</Text>
      </Pressable>
    </View>
  )
}

function ReviewCard({ item, open, onOpen, onReply }) {
  if (!open) {
    return (
      <Pressable style={styles.card} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Review, ${item.rating ?? 'no'} stars`}>
        <Text style={styles.cardTitle} numberOfLines={1}>A tenant left you {item.rating ?? '—'} stars</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.listing} · {sinceLabel(item.askedAt)}</Text>
      </Pressable>
    )
  }

  return (
    <View style={[styles.card, styles.cardOpen]}>
      <Text style={styles.eyebrow}>Needs you today</Text>
      <Text style={styles.cardTitleOpen}>A tenant left you {item.rating ?? '—'} stars</Text>
      <Text style={styles.cardQuote} numberOfLines={3}>&ldquo;{item.quote}&rdquo;</Text>
      <View style={styles.cardActions}>
        <Pressable style={styles.primaryButton} onPress={() => onReply(item)} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Reply</Text>
        </Pressable>
      </View>
    </View>
  )
}

function StatCard({ value, label, sub }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {!!sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  )
}

// "+6 vs last" only when there IS a previous period. On a new listing "+0"
// reads as failure rather than as no history.
function deltaLabel(now, prev) {
  if (!prev) return null
  const diff = now - prev
  if (diff === 0) return 'same as last month'
  return `${diff > 0 ? '+' : ''}${diff} vs last`
}

// The other half of the wizard's autosave. Saving a half-finished listing is
// worth nothing if the owner can't find it again — before this, the draft sat in
// AsyncStorage and the only way back was to start Add listing and notice it had
// restored itself.
function UnfinishedCard({ saved, onResume }) {
  const step = savedStep(saved)
  const label = saved.draft?.title?.trim()
    || suggestTitle(saved.categoryKey, { fields: saved.draft?.fields ?? {}, location: saved.draft?.location ?? {} })
    || CATEGORIES[saved.categoryKey]?.label
    || 'a listing'

  return (
    <View style={styles.unfinished}>
      <Text style={styles.unfinishedTitle}>Unfinished listing</Text>
      <Text style={styles.unfinishedBody}>
        {label} — you stopped at {step.label.toLowerCase()}. Nothing was lost.
      </Text>
      <Pressable style={styles.unfinishedButton} onPress={onResume} accessibilityRole="button">
        <Text style={styles.unfinishedButtonText}>Resume · step {step.n} of {STEPS.length}</Text>
      </Pressable>
    </View>
  )
}

function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior="padding">
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close">
                <Icon name="close" size={18} color={colors.slate500} />
              </Pressable>
            </View>
            {children}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

export default function HostDashboardScreen({ navigation }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [openId, setOpenId] = useState(null)
  const [suggestFor, setSuggestFor] = useState(null)
  const [suggestion, setSuggestion] = useState({ date: '', time: '' })
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [savedDraft, setSavedDraft] = useState(null)

  // GET /host/dashboard is authMiddleware + requireOwner, so a TENANT gets a
  // 403 — which React Query reports as isError and the screen rendered as
  // "Couldn't load your dashboard" with a Retry that could never succeed.
  // That was the FIRST thing a new account saw on tapping the host tab: their
  // own app, apparently broken. A tenant has no owner dashboard to fail at
  // loading; they have a listing they haven't made yet.
  const isOwner = user?.role === 'OWNER'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['host-dashboard'],
    queryFn: () => hostService.dashboard().then((r) => r.data),
    enabled: !!user && isOwner,
  })

  // Re-read on focus, not once on mount: the owner leaves for the wizard and
  // comes back, and a stale banner pointing at a listing they just published is
  // worse than no banner. Syncs as it reads, so a listing started on the
  // owner's laptop is waiting here.
  useFocusEffect(
    useCallback(() => {
      let alive = true
      syncAndReadDraft().then((s) => { if (alive) setSavedDraft(s) })
      return () => { alive = false }
    }, []),
  )

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['host-dashboard'] })
    qc.invalidateQueries({ queryKey: ['owner-appointments'] })
  }

  const { mutate: setStatus, isPending: statusPending } = useMutation({
    mutationFn: ({ id, ...body }) => appointmentService.updateStatus(id, body),
    onSuccess: () => { invalidate(); setSuggestFor(null) },
  })

  const { mutate: reply, isPending: replyPending } = useMutation({
    mutationFn: ({ propertyId, id, response }) => reviewService.respond(propertyId, id, response),
    onSuccess: () => { invalidate(); setReplyTo(null); setReplyText('') },
  })

  const queue = data?.needsYouToday ?? []
  const s = data?.last30Days ?? {}
  const visitCount = queue.filter((q) => q.kind === 'VISIT_REQUEST').length

  // Says what is waiting, in words, or says plainly that nothing is.
  const headline = visitCount > 0
    ? `${visitCount} ${visitCount === 1 ? 'request needs' : 'requests need'} an answer`
    : queue.length > 0
      ? `${queue.length} ${queue.length === 1 ? 'thing needs' : 'things need'} your attention`
      : 'Nothing needs you right now'

  // The first item is open unless the owner has tapped another one.
  const activeId = openId ?? queue[0]?.id

  function goToWizard() {
    navigation.getParent()?.navigate('MyListing', { screen: 'AddListing', initial: false })
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Two round icon buttons, matched. Mobile has no Calendar tab (web does)
          — it was folded into this screen, so the calendar button is the
          primary way in, and it must render whatever the dashboard fetch did:
          a host checks what is booked precisely when things are broken. The
          bell was reachable only from the account tab's menu, so a real-time
          notification arrived with nothing on screen to show for it. */}
      <ScreenHeader
        title="Hosting"
        subtitle={isLoading ? 'Checking what needs you…' : headline}
        right={(
          <View style={styles.headerActions}>
            <Pressable
              style={styles.iconButton}
              onPress={() => navigation.navigate('Calendar')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="View calendar"
            >
              <Icon name="calendar" size={18} color={colors.slate700} />
            </Pressable>
            <NotificationBell />
          </View>
        )}
      />
      <ScrollView contentContainerStyle={styles.scroll}>

        {!isOwner ? (
          <View style={styles.body}>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>You haven&rsquo;t listed anything yet</Text>
              <Text style={styles.introBody}>
                Put your place on the map and renters contact you directly. No brokers,
                no brokerage, and listing is free.
              </Text>
              <Pressable
                style={styles.introButton}
                onPress={() => navigation.getParent()?.navigate('MyListing', { screen: 'AddListing', initial: false })}
                accessibilityRole="button"
                accessibilityLabel="Add your first listing"
              >
                <Text style={styles.introButtonText}>Add your first listing</Text>
              </Pressable>
            </View>
          </View>
        ) : isLoading ? (
          <View style={styles.body}>
            <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.xl }} />
          </View>
        ) : isError ? (
          <ErrorState title="Couldn't load your dashboard" onRetry={refetch} />
        ) : (
          <View style={styles.body}>
            {queue.map((item) => item.kind === 'VISIT_REQUEST' ? (
              <VisitCard
                key={item.id}
                item={item}
                open={item.id === activeId}
                busy={statusPending}
                onOpen={() => setOpenId(item.id)}
                onAccept={(i) => setStatus({ id: i.id, status: 'ACCEPTED' })}
                onDecline={(i) => setStatus({ id: i.id, status: 'REJECTED' })}
                onSuggest={(i) => { setSuggestFor(i); setSuggestion({ date: '', time: '' }) }}
              />
            ) : (
              <ReviewCard
                key={item.id}
                item={item}
                open={item.id === activeId}
                onOpen={() => setOpenId(item.id)}
                onReply={(i) => { setReplyTo(i); setReplyText('') }}
              />
            ))}

            <View style={styles.statRow}>
              <StatCard
                value={s.views ?? 0}
                label="Views"
                sub={`${s.windowDays ?? 30} days`}
              />
              <StatCard
                value={s.saves ?? 0}
                label="Saves"
                sub={deltaLabel(s.saves ?? 0, s.savesPrev ?? 0)}
              />
            </View>
            <View style={styles.statRow}>
              <StatCard
                value={s.visitRequests ?? 0}
                label="Visit requests"
                sub={s.visitRequests ? `${s.visitsAccepted ?? 0} accepted` : null}
              />
              <StatCard
                value={s.signedLeases ?? 0}
                label={s.signedLeases === 1 ? 'Signed lease' : 'Signed leases'}
                sub={s.signedLeaseListing}
              />
            </View>

            {!!savedDraft && <UnfinishedCard saved={savedDraft} onResume={goToWizard} />}

            {!savedDraft && (
              <Pressable style={styles.addButton} onPress={goToWizard} accessibilityRole="button">
                <Icon name="plus" size={16} color={colors.white} />
                <Text style={styles.addButtonText}>Add listing</Text>
              </Pressable>
            )}

          </View>
        )}
      </ScrollView>

      {/* Suggesting a time is a real reschedule, not a decline with a note — the
          renter gets the new slot on the same appointment. */}
      <Sheet visible={!!suggestFor} title="Suggest another time" onClose={() => setSuggestFor(null)}>
        <Text style={styles.sheetIntro}>
          {suggestFor?.person} asked for {suggestFor ? visitWhen(suggestFor) : ''}. Offer a slot that suits you.
        </Text>

        <Text style={styles.fieldLabel}>Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {NEXT_14_DAYS.map((d) => (
            <Pressable
              key={d.value}
              style={[styles.chip, suggestion.date === d.value && styles.chipActive]}
              onPress={() => setSuggestion((v) => ({ ...v, date: d.value }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: suggestion.date === d.value }}
            >
              <Text style={[styles.chipText, suggestion.date === d.value && styles.chipTextActive]}>{d.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Time</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {VISIT_SLOTS.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, suggestion.time === t && styles.chipActive]}
              onPress={() => setSuggestion((v) => ({ ...v, time: t }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: suggestion.time === t }}
            >
              <Text style={[styles.chipText, suggestion.time === t && styles.chipTextActive]}>{formatTime(t)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable
          style={[styles.sheetButton, (!suggestion.date || !suggestion.time || statusPending) && styles.buttonBusy]}
          disabled={!suggestion.date || !suggestion.time || statusPending}
          onPress={() => setStatus({
            id: suggestFor.id,
            status: 'RESCHEDULED',
            scheduledAt: new Date(`${suggestion.date}T${suggestion.time}`).toISOString(),
            ownerNote: `Suggested ${suggestion.date} at ${formatTime(suggestion.time)}`,
          })}
          accessibilityRole="button"
        >
          <Text style={styles.sheetButtonText}>{statusPending ? 'Sending…' : 'Send suggestion'}</Text>
        </Pressable>
      </Sheet>

      <Sheet visible={!!replyTo} title="Reply to this review" onClose={() => setReplyTo(null)}>
        <Text style={styles.sheetQuote} numberOfLines={4}>&ldquo;{replyTo?.quote}&rdquo;</Text>
        <TextInput
          style={styles.textArea}
          value={replyText}
          onChangeText={setReplyText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          placeholder="Thanks for the note — the water tank is being serviced next week."
          placeholderTextColor={colors.slate500}
        />
        <Pressable
          style={[styles.sheetButton, (replyText.trim().length < 2 || replyPending) && styles.buttonBusy]}
          disabled={replyText.trim().length < 2 || replyPending}
          onPress={() => reply({ propertyId: replyTo.propertyId, id: replyTo.id, response: replyText.trim() })}
          accessibilityRole="button"
        >
          <Text style={styles.sheetButtonText}>{replyPending ? 'Posting…' : 'Post reply'}</Text>
        </Pressable>
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.md, gap: spacing.sm },
  introCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.slate200, padding: spacing.lg, marginTop: spacing.md,
  },
  introTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  introBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: spacing.sm, lineHeight: 20 },
  introButton: {
    minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
    backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.md,
  },
  introButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },

  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md,
  },
  cardOpen: { backgroundColor: colors.brand50, borderColor: colors.brand100 },
  eyebrow: {
    fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate900 },
  cardTitleOpen: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.brand900 },
  cardMeta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: 2 },
  cardMetaOpen: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.brand700, marginTop: 4 },
  cardQuote: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.brand700, marginTop: 6, lineHeight: 20 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryButton: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brand600, borderRadius: radius.md,
  },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
  secondaryButton: {
    flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brand100, borderRadius: radius.md,
  },
  secondaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand700 },
  buttonBusy: { opacity: 0.6 },
  declineButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  declineText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md,
  },
  statValue: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.slate900 },
  statLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginTop: spacing.sm },
  statSub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: 2 },

  unfinished: {
    backgroundColor: colors.warning50, borderWidth: 1, borderColor: colors.warning100,
    borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xs,
  },
  unfinishedTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.warning700 },
  unfinishedBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.warning700, marginTop: 4, lineHeight: 20 },
  unfinishedButton: {
    minHeight: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.warning700, borderRadius: radius.md, marginTop: spacing.md,
  },
  unfinishedButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },

  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 48, backgroundColor: colors.black, borderRadius: radius.md, marginTop: spacing.xs,
  },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Same 40dp circle as NotificationBell so the pair reads as one control set
  // rather than a labelled pill beside a round icon.
  iconButton: {
    width: 40, height: 40, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },

  backdrop: { flex: 1, backgroundColor: 'rgba(13,12,10,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, paddingBottom: spacing.xl,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sheetTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate900 },
  sheetIntro: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20 },
  sheetQuote: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, fontStyle: 'italic', lineHeight: 20 },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate800, marginTop: spacing.md },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.sm, paddingRight: spacing.md },
  chip: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate800 },
  chipTextActive: { color: colors.white },
  textArea: {
    minHeight: 108, marginTop: spacing.md, padding: spacing.md,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate900, lineHeight: 22,
  },
  sheetButton: {
    minHeight: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brand600, borderRadius: radius.md, marginTop: spacing.lg,
  },
  sheetButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
})
