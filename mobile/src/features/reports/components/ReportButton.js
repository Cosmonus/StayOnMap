import { useState } from 'react'
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { reportService } from '@services/report.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

const CATEGORIES = [
  { value: 'FRAUD', label: 'Fraud / Scam' },
  { value: 'FAKE_PHOTOS', label: 'Fake Photos' },
  { value: 'UNAUTHORIZED_LISTING', label: 'Unauthorized Listing' },
  { value: 'WRONG_PRICING', label: 'Wrong Pricing' },
  { value: 'UNSAFE', label: 'Unsafe Conditions' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'OWNER_MISCONDUCT', label: 'Owner Misconduct' },
  { value: 'DUPLICATE', label: 'Duplicate Listing' },
  { value: 'FALSE_INFO', label: 'False Information' },
  { value: 'BROKER_SPAM', label: 'Broker Spam' },
  { value: 'OTHER', label: 'Other' },
]

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const MIN_CHARS = 20

export default function ReportButton({ propertyId }) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ category: '', description: '', severity: 'LOW', isAnonymous: false })

  const mutation = useMutation({
    mutationFn: (data) => reportService.submit(propertyId, data),
    onSuccess: () => setSubmitted(true),
  })

  function close() {
    setOpen(false)
    setSubmitted(false)
    setForm({ category: '', description: '', severity: 'LOW', isAnonymous: false })
  }

  const isValid = form.category && form.description.trim().length >= MIN_CHARS

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} hitSlop={14} accessibilityRole="button" accessibilityLabel="Report listing">
        <Icon name="alertTriangle" size={13} color={colors.danger} />
        <Text style={styles.triggerText}>Report listing</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {submitted ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Icon name="checkCircle" size={22} color={colors.brand600} />
                </View>
                <Text style={styles.successTitle}>Report submitted</Text>
                <Text style={styles.successBody}>Our team will review it within 24–48 hours.</Text>
                <Pressable style={styles.closeButton} onPress={close} accessibilityRole="button">
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                  <Text style={styles.title}>Report this listing</Text>
                  <Pressable onPress={close} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close report form"><Icon name="close" size={18} color={colors.slate400} /></Pressable>
                </View>

                <Text style={styles.label}>Category</Text>
                <View style={styles.chipWrap}>
                  {CATEGORIES.map((c) => (
                    <Pressable
                      key={c.value}
                      style={[styles.chip, form.category === c.value && styles.chipActive]}
                      onPress={() => setForm((f) => ({ ...f, category: c.value }))}
                      hitSlop={{ top: 4, bottom: 4 }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: form.category === c.value }}
                    >
                      <Text style={[styles.chipText, form.category === c.value && styles.chipTextActive]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Severity</Text>
                <View style={styles.chipWrap}>
                  {SEVERITIES.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.chip, form.severity === s && styles.chipActiveDanger]}
                      onPress={() => setForm((f) => ({ ...f, severity: s }))}
                      hitSlop={{ top: 4, bottom: 4 }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: form.severity === s }}
                    >
                      <Text style={[styles.chipText, form.severity === s && styles.chipTextActive]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Describe the issue in detail (min 20 characters)"
                  placeholderTextColor={colors.slate400}
                  multiline
                  numberOfLines={4}
                />
                {form.description.trim().length < MIN_CHARS && (
                  <Text style={styles.helperText}>
                    {form.description.trim().length === 0
                      ? `At least ${MIN_CHARS} characters required`
                      : `${MIN_CHARS - form.description.trim().length} more characters needed`}
                  </Text>
                )}

                <Pressable
                  style={styles.anonRow}
                  onPress={() => setForm((f) => ({ ...f, isAnonymous: !f.isAnonymous }))}
                  hitSlop={{ top: 10, bottom: 10 }}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Submit anonymously"
                  accessibilityState={{ checked: form.isAnonymous }}
                >
                  <View style={[styles.checkbox, form.isAnonymous && styles.checkboxChecked]}>
                    {form.isAnonymous && <Icon name="check" size={11} color={colors.white} />}
                  </View>
                  <Text style={styles.anonText}>Submit anonymously</Text>
                </Pressable>

                {mutation.isError && <Text style={styles.errorText}>{mutation.error?.message || 'Failed to submit. Please try again.'}</Text>}

                <View style={styles.actionRow}>
                  <Pressable style={styles.cancelButton} onPress={close} accessibilityRole="button">
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.submitButton, !isValid && styles.disabled]}
                    onPress={() => mutation.mutate(form)}
                    disabled={!isValid || mutation.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Submit report"
                    accessibilityState={{ disabled: !isValid || mutation.isPending, busy: mutation.isPending }}
                  >
                    {mutation.isPending ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit Report</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  triggerText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.danger },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, maxHeight: '85%', ...shadows.sheet },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700, marginTop: spacing.md, marginBottom: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200 },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipActiveDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate800 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  anonText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  helperText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.warning700, marginTop: spacing.xs },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.md },
  cancelButton: { flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200, alignItems: 'center' },
  cancelButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  submitButton: { flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radius.md, backgroundColor: colors.danger, alignItems: 'center' },
  submitButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.5 },
  successBox: { alignItems: 'center', paddingVertical: spacing.xl },
  successIcon: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  successTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800 },
  successBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: spacing.xs, textAlign: 'center' },
  closeButton: { marginTop: spacing.lg, backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 4 },
  closeButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
