import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { useUiStore } from '@store/uiStore'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const ALL_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
]

const UPCOMING_DATES = Array.from({ length: 30 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  const iso = d.toISOString().split('T')[0]
  const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return { value: iso, label }
})

function formatSlot(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export default function AppointmentForm({ propertyId, windowStart, windowEnd, onSuccess }) {
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const hostMode = useUiStore((s) => s.hostMode)
  const [form, setForm] = useState({ requestedDate: '', requestedTime: '', message: '', contactNumber: '' })
  const [submitted, setSubmitted] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        requestedDate: new Date(data.requestedDate).toISOString(),
        requestedTime: data.requestedTime,
        contactNumber: data.contactNumber,
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
      await chatService.startConversation(propertyId)
      navigation.getParent()?.navigate(hostMode ? 'Inbox' : 'Chat')
    } catch {
      // best-effort — error surfaced via the disabled state resetting below
    } finally {
      setChatLoading(false)
    }
  }

  const slots = ALL_SLOTS.filter((t) => (!windowStart || t >= windowStart) && (!windowEnd || t <= windowEnd))
  const isValid = form.requestedDate && form.requestedTime && /^[6-9]\d{9}$/.test(form.contactNumber)

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
        {UPCOMING_DATES.map(({ value, label }) => (
          <Pressable
            key={value}
            style={[styles.chip, form.requestedDate === value && styles.chipActive]}
            onPress={() => setForm((f) => ({ ...f, requestedDate: value }))}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="radio"
            accessibilityLabel={`Select date ${label}`}
            accessibilityState={{ checked: form.requestedDate === value }}
          >
            <Text style={[styles.chipText, form.requestedDate === value && styles.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.labelRow}><Icon name="clock" size={12} color={colors.slate500} /><Text style={styles.label}>Preferred time</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        {slots.map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, form.requestedTime === t && styles.chipActive]}
            onPress={() => setForm((f) => ({ ...f, requestedTime: t }))}
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="radio"
            accessibilityLabel={`Select time ${formatSlot(t)}`}
            accessibilityState={{ checked: form.requestedTime === t }}
          >
            <Text style={[styles.chipText, form.requestedTime === t && styles.chipTextActive]}>{formatSlot(t)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {windowStart && windowEnd && <Text style={styles.hint}>Owner available {windowStart}–{windowEnd}</Text>}

      <View style={styles.labelRow}><Icon name="phone" size={12} color={colors.slate500} /><Text style={styles.label}>Mobile number</Text></View>
      <TextInput
        style={styles.input}
        value={form.contactNumber}
        onChangeText={(v) => setForm((f) => ({ ...f, contactNumber: v }))}
        placeholder="10-digit mobile number"
        placeholderTextColor={colors.slate400}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <View style={styles.labelRow}><Icon name="messageCircle" size={12} color={colors.slate500} /><Text style={styles.label}>Message (optional)</Text></View>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={form.message}
        onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
        placeholder="Anything the owner should know..."
        placeholderTextColor={colors.slate400}
        multiline
        numberOfLines={3}
      />

      {mutation.isError && <Text style={styles.errorText}>{mutation.error?.message || 'Failed to send request.'}</Text>}

      <Pressable
        style={[styles.submitButton, (!isValid || mutation.isPending) && styles.disabled]}
        onPress={() => mutation.mutate(form)}
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
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger },
  submitButton: { flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  submitButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.55 },
  successBox: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand200, borderRadius: radius.md, padding: spacing.md },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  successTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand800 },
  successBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand600, marginTop: 2 },
  chatNudge: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100, borderRadius: radius.md, padding: spacing.md },
  chatNudgeTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  chatNudgeBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand700, opacity: 0.7, marginTop: 2, marginBottom: spacing.sm },
  primaryButton: { flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
})
