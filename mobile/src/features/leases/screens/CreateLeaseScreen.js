import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { leaseService } from '@services/lease.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

export default function CreateLeaseScreen({ route, navigation }) {
  const { propertyId, propertyTitle } = route.params
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ tenantId: '', startDate: today, endDate: '', rentAmount: '', depositAmount: '', ownerNote: '' })
  const [err, setErr] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => leaseService.createLease(propertyId, {
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      rentAmount: Number(form.rentAmount),
      depositAmount: Number(form.depositAmount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leases'] })
      navigation.goBack()
    },
    onError: (e) => setErr(e?.message ?? 'Failed to create lease'),
  })

  function handleSubmit() {
    setErr('')
    if (!form.tenantId.trim()) return setErr('Tenant ID is required')
    if (!form.startDate || !form.endDate) return setErr('Start and end dates are required')
    if (new Date(form.endDate) <= new Date(form.startDate)) return setErr('End date must be after start date')
    if (!form.rentAmount || Number(form.rentAmount) <= 0) return setErr('Rent amount must be positive')
    if (!form.depositAmount || Number(form.depositAmount) <= 0) return setErr('Deposit must be positive')
    mutate()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Icon name="document" size={18} color={colors.slate800} />
          <Text style={styles.headerTitle}>Offer Lease</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={18} color={colors.brand600} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.propertyTitle}>{propertyTitle}</Text>

          {err ? <Text style={styles.errorText}>{err}</Text> : null}

          <Text style={styles.label}>Tenant User ID</Text>
          <TextInput
            style={styles.input}
            value={form.tenantId}
            onChangeText={(v) => setForm((f) => ({ ...f, tenantId: v }))}
            placeholder="Paste tenant's user ID"
            placeholderTextColor={colors.slate400}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Find the tenant ID in their appointment details</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start date</Text>
              <TextInput style={styles.input} value={form.startDate} onChangeText={(v) => setForm((f) => ({ ...f, startDate: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.slate400} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>End date</Text>
              <TextInput style={styles.input} value={form.endDate} onChangeText={(v) => setForm((f) => ({ ...f, endDate: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.slate400} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Monthly rent (₹)</Text>
              <TextInput style={styles.input} value={form.rentAmount} onChangeText={(v) => setForm((f) => ({ ...f, rentAmount: v }))} placeholder="28000" placeholderTextColor={colors.slate400} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Deposit (₹)</Text>
              <TextInput style={styles.input} value={form.depositAmount} onChangeText={(v) => setForm((f) => ({ ...f, depositAmount: v }))} placeholder="56000" placeholderTextColor={colors.slate400} keyboardType="numeric" />
            </View>
          </View>

          <Text style={styles.label}>Note to tenant (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={form.ownerNote}
            onChangeText={(v) => setForm((f) => ({ ...f, ownerNote: v }))}
            placeholder="Any specific terms or notes..."
            placeholderTextColor={colors.slate400}
            multiline
            numberOfLines={2}
          />

          <Pressable style={[styles.submitButton, isPending && styles.disabled]} onPress={handleSubmit} disabled={isPending} accessibilityRole="button" accessibilityState={{ disabled: isPending }}>
            {isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Icon name="send" size={14} color={colors.white} />
                <Text style={styles.submitButtonText}>Send lease offer</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.slate200,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  scroll: { padding: spacing.lg, gap: spacing.xs },
  propertyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.sm },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginBottom: spacing.sm },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, marginTop: spacing.sm, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm + 2, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  hint: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.sm },
  submitButton: { minHeight: 44, flexDirection: 'row', gap: 6, backgroundColor: colors.black, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  submitButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
})
