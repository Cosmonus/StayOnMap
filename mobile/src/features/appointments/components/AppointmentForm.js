import { useState, useCallback, useMemo } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import Icon from '@components/common/Icon'
import { VISIT_SLOTS, formatTime } from '@utils/time'
import { normalizePhone, isValidPhone } from '@utils/phone'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Nobody can act on a request made for 20 minutes' time, and offering it
// invites a slot that's stale before the owner opens the notification. Web has
// had this since the "Today · 9:00 AM at 3pm" bug; mobile never did, so the
// chip was offered, tapped, and refused by the server.
const LEAD_MINUTES = 30

const pad = (n) => String(n).padStart(2, '0')

// Local date parts, NOT toISOString(). The ISO string is UTC, so between
// midnight and 05:30 IST it names YESTERDAY — and the chip labelled "Today"
// carried yesterday's date, which the server then rejects as a past slot. This
// file used `d.toISOString().split('T')[0]` until 2026-08-07.
function localISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function AppointmentForm({ propertyId, windowStart, windowEnd, onSuccess }) {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  // `contactNumber: null` means "the person hasn't touched this field", which
  // is what lets the profile number below fill it. Once they type — including
  // typing nothing, i.e. clearing it — it becomes a string and stops falling
  // back, so we never re-impose a number they deliberately deleted.
  const [form, setForm] = useState({ requestedDate: '', requestedTime: '', message: '', contactNumber: null })
  const [submitted, setSubmitted] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  // The number is already on the account — `/auth/me` returns the whole User
  // row, so `user.phone` is right here — and the form asked for it again every
  // single time. Derived rather than seeded into state by an effect: AuthContext
  // rehydrates the profile asynchronously at launch, so `user` is often still
  // null on this screen's first render, and a derivation picks it up when it
  // lands without a second render pass. Normalised, because a stored
  // "+91 98450 12345" is exactly what the server's /^[6-9]\d{9}$/ rejects.
  const profilePhone = isValidPhone(user?.phone) ? normalizePhone(user.phone) : ''
  const contactNumber = form.contactNumber ?? profilePhone

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        requestedDate: new Date(data.requestedDate).toISOString(),
        requestedTime: data.requestedTime,
        // Normalised on the way out too: the field accepts what a person
        // actually types, the wire only ever carries ten digits.
        contactNumber: normalizePhone(data.contactNumber),
      }
      if (data.message?.trim()) payload.message = data.message.trim()
      return appointmentService.request(propertyId, payload)
    },
    onSuccess: () => {
      setSubmitted(true)
      // So the property page's footer flips to "Visit requested" on return.
      queryClient.invalidateQueries({ queryKey: ['my-appointments'] })
      onSuccess?.()
    },
  })

  async function handleChat() {
    setChatLoading(true)
    try {
      const convo = await chatService.startConversation(propertyId).then((r) => r.data)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      // Pushed onto THIS stack (AppTabs.js's BOOKING_SCREENS carries
      // Conversation everywhere BookViewing exists) — back returns here, not
      // to whatever the Chat tab was parked on.
      navigation.navigate('Conversation', {
        conversationId: convo.id,
        other: convo.owner,
        otherRole: 'Owner',
      })
    } catch {
      // best-effort — error surfaced via the disabled state resetting below
    } finally {
      setChatLoading(false)
    }
  }

  const withinWindow = VISIT_SLOTS.filter((t) => (!windowStart || t >= windowStart) && (!windowEnd || t <= windowEnd))
  const todayISO = localISO(new Date())

  const slotsFor = useCallback((dateISO) => {
    if (dateISO !== todayISO) return withinWindow
    const cutoff = new Date(Date.now() + LEAD_MINUTES * 60_000)
    const hhmm = `${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`
    return withinWindow.filter((t) => t > hhmm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, windowStart, windowEnd])

  // Days the owner has already committed or blocked out. A failed fetch
  // degrades to "nothing known to be taken" — the server still refuses a taken
  // day, so the worst case is the behaviour this screen had before.
  const { data: availability } = useQuery({
    queryKey: ['visit-availability', propertyId],
    queryFn: () => appointmentService.availability(propertyId).then((r) => r.data),
    enabled: !!user && !!propertyId,
    staleTime: 60_000,
  })

  const days = useMemo(() => {
    const taken = new Set(availability?.unavailableDates ?? [])
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const value = localISO(d)
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
      // Two different reasons, and they must not read as one: the owner is
      // busy, or the day is simply over.
      const reason = taken.has(value)
        ? 'the owner already has a visit booked'
        : slotsFor(value).length === 0
          ? 'no visiting hours left today'
          : null
      return { value, label, disabled: Boolean(reason), reason }
    })
  }, [availability, slotsFor])

  const slots = form.requestedDate ? slotsFor(form.requestedDate) : withinWindow

  // A date change can invalidate the chosen time (picking Today late in the
  // day). Clearing it beats submitting a combination the server refuses.
  function pickDate(value) {
    setForm((f) => ({
      ...f,
      requestedDate: value,
      requestedTime: slotsFor(value).includes(f.requestedTime) ? f.requestedTime : '',
    }))
  }

  const isValid = form.requestedDate && form.requestedTime && isValidPhone(contactNumber)

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <View style={styles.successRow}>
            <Icon name="checkCircle" size={18} color={colors.brand600} />
            <Text style={styles.successTitle}>Visit requested!</Text>
          </View>
          <Text style={styles.successBody}>The owner will respond within 24 hours.</Text>
        </View>
        <View style={styles.chatNudge}>
          <Text style={styles.chatNudgeTitle}>Want to ask the owner something?</Text>
          <Text style={styles.chatNudgeBody}>Chat directly — get faster answers about the property.</Text>
          <Pressable
            style={[styles.primaryButton, chatLoading && styles.disabled]}
            onPress={handleChat}
            disabled={chatLoading}
            accessibilityRole="button"
            accessibilityLabel="Message the owner"
            accessibilityState={{ disabled: chatLoading, busy: chatLoading }}
          >
            {chatLoading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Icon name="messageCircle" size={14} color={colors.white} />
                <Text style={styles.primaryButtonText}>Message the owner</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Where the request now lives. Without this the flow ends on a tick
            and the renter is left to discover, unaided, that visits sit behind
            Profile — which is the "found the Visits in Profile, not a very
            visible touch point" complaint. Renter-mode visits are in the
            Profile stack, so this crosses tabs; `initial: false` keeps
            ProfileHome underneath so back lands somewhere sensible. */}
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.getParent()?.navigate('Profile', { screen: 'Appointments', initial: false })}
          accessibilityRole="button"
          accessibilityLabel="View all your visits"
        >
          <Icon name="calendar" size={14} color={colors.slate700} />
          <Text style={styles.secondaryButtonText}>View all your visits</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Icon name="calendar" size={18} color={colors.slate800} />
        <Text style={styles.heading}>Request a visit</Text>
      </View>

      <View style={styles.labelRow}><Icon name="calendar" size={12} color={colors.slate500} /><Text style={styles.label}>Preferred date</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {days.map(({ value, label, disabled, reason }) => (
          <Pressable
            key={value}
            style={[
              styles.chip,
              disabled && styles.chipDisabled,
              !disabled && form.requestedDate === value && styles.chipActive,
            ]}
            onPress={() => pickDate(value)}
            disabled={disabled}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="radio"
            // The reason is IN the name, not only in the styling. A disabled
            // control with no stated reason sends the blame to whatever is
            // interactive beside it — which is how a working phone field got
            // reported as broken.
            accessibilityLabel={disabled ? `${label} — unavailable, ${reason}` : `Select date ${label}`}
            accessibilityState={{ checked: form.requestedDate === value, disabled }}
          >
            <Text style={[
              styles.chipText,
              disabled && styles.chipTextDisabled,
              !disabled && form.requestedDate === value && styles.chipTextActive,
            ]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.hint}>Greyed-out days are already booked by the owner.</Text>

      <View style={styles.labelRow}><Icon name="clock" size={12} color={colors.slate500} /><Text style={styles.label}>Preferred time</Text></View>
      {slots.length === 0 ? (
        <Text style={styles.emptySlots}>No times left on this day. Pick another day.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {slots.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, form.requestedTime === t && styles.chipActive]}
              onPress={() => setForm((f) => ({ ...f, requestedTime: t }))}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="radio"
              accessibilityLabel={`Select time ${formatTime(t)}`}
              accessibilityState={{ checked: form.requestedTime === t }}
            >
              <Text style={[styles.chipText, form.requestedTime === t && styles.chipTextActive]}>{formatTime(t)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {windowStart && windowEnd && <Text style={styles.hint}>Owner available {formatTime(windowStart)} – {formatTime(windowEnd)}</Text>}

      <View style={styles.labelRow}><Icon name="phone" size={12} color={colors.slate500} /><Text style={styles.label}>Mobile number</Text></View>
      <TextInput
        style={styles.input}
        value={contactNumber}
        onChangeText={(v) => setForm((f) => ({ ...f, contactNumber: v }))}
        placeholder="10-digit mobile number"
        placeholderTextColor={colors.slate500}
        keyboardType="phone-pad"
        // 10 truncated a pasted "+91 98450 12345" to "+91 98450 " — a number
        // the person had just copied from their own contacts, silently cut
        // into something the button stays greyed out for. normalizePhone
        // handles the shape; the field only has to accept it.
        maxLength={16}
      />

      <View style={styles.labelRow}><Icon name="messageCircle" size={12} color={colors.slate500} /><Text style={styles.label}>Message (optional)</Text></View>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={form.message}
        onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
        placeholder="Anything the owner should know..."
        placeholderTextColor={colors.slate500}
        multiline
        numberOfLines={3}
      />

      {mutation.isError && <Text style={styles.errorText}>{mutation.error?.message || 'Failed to send request.'}</Text>}

      <Pressable
        style={[styles.submitButton, (!isValid || mutation.isPending) && styles.disabled]}
        onPress={() => mutation.mutate({ ...form, contactNumber })}
        disabled={!isValid || mutation.isPending}
        accessibilityRole="button"
        accessibilityLabel="Request visit"
        accessibilityState={{ disabled: !isValid || mutation.isPending, busy: mutation.isPending }}
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <>
            <Icon name="calendar" size={16} color={colors.white} />
            <Text style={styles.submitButtonText}>I&apos;m Interested — Request Visit</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600 },
  chipScroll: { gap: spacing.sm, paddingVertical: 4 },
  chip: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipDisabled: { backgroundColor: colors.slate50, borderColor: colors.slate200 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  // slate400 is a disabled state, which WCAG exempts from the contrast floor —
  // the one place in this app it is still correct.
  chipTextDisabled: { color: colors.slate400, textDecorationLine: 'line-through' },
  emptySlots: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500,
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
  },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger },
  submitButton: { flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, minHeight: 48, },
  submitButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.55 },
  successBox: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand200, borderRadius: radius.md, padding: spacing.md },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  successTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand800 },
  successBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand600, marginTop: 2 },
  chatNudge: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100, borderRadius: radius.md, padding: spacing.md },
  chatNudgeTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  chatNudgeBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand700, opacity: 0.7, marginTop: 2, marginBottom: spacing.sm },
  primaryButton: { flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', justifyContent: 'center', minHeight: 48, },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  secondaryButton: {
    flexDirection: 'row', gap: 6, minHeight: 48, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
})
