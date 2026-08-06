import { useState, useMemo, useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import FormSheet from '@components/common/FormSheet'
import { VISIT_SLOTS, formatTime } from '@utils/time'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// A renter proposing a different time. Until 2026-08-07 the only way out of a
// slot they could not make was to CANCEL and start over from an empty form,
// losing the thread's context and their place in the owner's queue — so most
// people messaged the owner and hoped instead.
//
// Same day/time chips as the booking form, and the same availability: proposing
// a time and asking for one are the same question, and a second date control
// with its own idea of which days are free is how the two come apart.
const LEAD_MINUTES = 30
const pad = (n) => String(n).padStart(2, '0')
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function ProposeTimeSheet({ visible, appt, onClose, onSubmit, saving }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  useResetOnOpen(visible, () => { setDate(''); setTime(''); setNote('') })

  const propertyId = appt?.property?.id
  const windowStart = appt?.property?.appointmentWindowStart
  const windowEnd = appt?.property?.appointmentWindowEnd

  const withinWindow = VISIT_SLOTS.filter(
    (t) => (!windowStart || t >= windowStart) && (!windowEnd || t <= windowEnd),
  )
  const todayISO = localISO(new Date())

  const slotsFor = useCallback((dateISO) => {
    if (dateISO !== todayISO) return withinWindow
    const cutoff = new Date(Date.now() + LEAD_MINUTES * 60_000)
    // Past 23:30 the cutoff lands on tomorrow and its clock time wraps to
    // '00:00', against which every slot still compares as available.
    if (localISO(cutoff) !== todayISO) return []
    const hhmm = `${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}`
    return withinWindow.filter((t) => t > hhmm)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, windowStart, windowEnd])

  const { data: availability } = useQuery({
    queryKey: ['visit-availability', propertyId],
    queryFn: () => appointmentService.availability(propertyId).then((r) => r.data),
    enabled: visible && !!propertyId,
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
      const reason = taken.has(value)
        ? 'the owner already has a visit booked'
        : slotsFor(value).length === 0 ? 'no visiting hours left today' : null
      return { value, label, disabled: Boolean(reason), reason }
    })
  }, [availability, slotsFor])

  const slots = date ? slotsFor(date) : []

  function pickDate(value) {
    setDate(value)
    setTime((t) => (slotsFor(value).includes(t) ? t : ''))
  }

  const current = appt
    ? `${new Date(appt.scheduledAt ?? appt.requestedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${appt.requestedTime ? `, ${formatTime(appt.requestedTime)}` : ''}`
    : null

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Propose a different time"
      saveLabel="Send to owner"
      saving={saving}
      onSave={date && time
        ? () => onSubmit({
          requestedDate: new Date(date).toISOString(),
          requestedTime: time,
          tenantNote: note.trim() || undefined,
        })
        : undefined}
    >
      {!!current && (
        <Text style={styles.intro}>
          Currently <Text style={styles.introStrong}>{current}</Text>. The owner will be asked to
          confirm whatever you pick — the visit stays open until they do.
        </Text>
      )}

      <Text style={styles.label}>New day</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {days.map(({ value, label, disabled, reason }) => (
          <Pressable
            key={value}
            style={[styles.chip, disabled && styles.chipDisabled, !disabled && date === value && styles.chipActive]}
            onPress={() => pickDate(value)}
            disabled={disabled}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="radio"
            accessibilityLabel={disabled ? `${label} — unavailable, ${reason}` : `Select date ${label}`}
            accessibilityState={{ checked: date === value, disabled }}
          >
            <Text style={[
              styles.chipText,
              disabled && styles.chipTextDisabled,
              !disabled && date === value && styles.chipTextActive,
            ]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.hint}>Greyed-out days are already booked by the owner.</Text>

      <Text style={styles.label}>New time</Text>
      {!date ? (
        <Text style={styles.empty}>Choose a day first.</Text>
      ) : slots.length === 0 ? (
        <Text style={styles.empty}>No times left on this day. Pick another day.</Text>
      ) : (
        <View style={styles.timeGrid}>
          {slots.map((t) => (
            <Pressable
              key={t}
              style={[styles.timeCell, time === t && styles.chipActive]}
              onPress={() => setTime(t)}
              accessibilityRole="radio"
              accessibilityLabel={`Select time ${formatTime(t)}`}
              accessibilityState={{ checked: time === t }}
            >
              <Text style={[styles.chipText, time === t && styles.chipTextActive]}>{formatTime(t)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!!windowStart && !!windowEnd && (
        <Text style={styles.hint}>Owner available {formatTime(windowStart)} – {formatTime(windowEnd)}</Text>
      )}

      <Text style={styles.label}>Why (optional)</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        maxLength={300}
        placeholder="I have something on that morning…"
        placeholderTextColor={colors.slate500}
        multiline
      />
      <Text style={styles.hint}>A line of context makes a yes much likelier.</Text>
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20, marginBottom: spacing.md },
  introStrong: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, marginTop: spacing.md, marginBottom: spacing.sm },
  chipScroll: { gap: spacing.sm, paddingVertical: 4 },
  chip: {
    minHeight: 48, justifyContent: 'center',
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full,
    paddingHorizontal: spacing.md, backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipDisabled: { backgroundColor: colors.slate50, borderColor: colors.slate200 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  // slate400 is a disabled state, which WCAG exempts from the contrast floor.
  chipTextDisabled: { color: colors.slate400, textDecorationLine: 'line-through' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeCell: {
    minHeight: 48, minWidth: 92, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, backgroundColor: colors.white,
  },
  empty: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500,
    backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
  },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
})
