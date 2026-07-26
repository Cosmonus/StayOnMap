import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Scalar-field edit only (title, description, pricing, available-from date) —
// the fields PUT /properties/:id accepts without relation payloads. Images,
// amenities, rules, location/map pin, and the type-specific columns
// (LAND/PG/COMMERCIAL/SHORT_STAY) still require web's edit form; porting
// wizard-grade editing to mobile is a documented follow-up, not attempted here.

const NUMERIC_FIELDS = [
  { key: 'rent', label: 'Rent / mo (₹) *', required: true, positive: true, placeholder: '28000' },
  { key: 'deposit', label: 'Deposit (₹) *', required: true, placeholder: '56000' },
  { key: 'maintenance', label: 'Maintenance / mo (₹)', placeholder: '1500' },
  { key: 'brokerage', label: 'Brokerage (₹)', placeholder: '0' },
  { key: 'electricityCharges', label: 'Electricity est. / mo (₹)', placeholder: '800' },
  { key: 'waterCharges', label: 'Water est. / mo (₹)', placeholder: '300' },
]

function fromProperty(p) {
  const num = (v) => (v != null ? String(Number(v)) : '')
  return {
    title: p.title ?? '',
    description: p.description ?? '',
    rent: num(p.rent),
    deposit: num(p.deposit),
    maintenance: num(p.maintenance),
    brokerage: num(p.brokerage),
    electricityCharges: num(p.electricityCharges),
    waterCharges: num(p.waterCharges),
    availableFrom: p.availableFrom ? new Date(p.availableFrom).toISOString().slice(0, 10) : '',
  }
}

function validate(form) {
  const e = {}
  if (form.title.trim().length < 5) e.title = 'Min 5 characters'
  if (form.description.trim().length < 10) e.description = 'Min 10 characters'
  for (const f of NUMERIC_FIELDS) {
    const v = form[f.key]
    if (v === '') {
      if (f.required) e[f.key] = 'Required'
      continue
    }
    const n = Number(v)
    if (!Number.isFinite(n)) e[f.key] = 'Enter a valid number'
    else if (f.positive && n <= 0) e[f.key] = 'Must be greater than 0'
    else if (!f.positive && n < 0) e[f.key] = 'Must be 0 or more'
  }
  if (form.availableFrom !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.availableFrom) || Number.isNaN(Date.parse(`${form.availableFrom}T00:00:00.000Z`))) {
      e.availableFrom = 'Use YYYY-MM-DD (e.g. 2026-08-01)'
    }
  }
  return e
}

function buildPayload(form) {
  const payload = {
    title: form.title.trim(),
    description: form.description.trim(),
    rent: Number(form.rent),
    deposit: Number(form.deposit),
  }
  for (const f of NUMERIC_FIELDS) {
    if (f.required) continue
    if (form[f.key] !== '') payload[f.key] = Number(form[f.key])
  }
  if (form.availableFrom !== '') payload.availableFrom = `${form.availableFrom}T00:00:00.000Z`
  return payload
}

function Field({ label, error, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

function EditForm({ property, navigation, onSaved }) {
  const [form, setForm] = useState(() => fromProperty(property))
  const [errors, setErrors] = useState({})

  // Hardware/gesture back must never silently discard edits (AGENTS.md §2).
  // dirtyRef is read inside the listener; savedRef lets the post-save goBack
  // leave without re-prompting.
  const dirtyRef = useRef(false)
  const savedRef = useRef(false)
  // Recomputed every render so the `beforeRemove` listener below (subscribed
  // once, not re-subscribed per keystroke) always reads the latest dirty
  // state instead of a stale closure — deliberate, not an oversight.
  // eslint-disable-next-line react-hooks/refs
  dirtyRef.current = JSON.stringify(form) !== JSON.stringify(fromProperty(property))

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (savedRef.current || !dirtyRef.current) return
      e.preventDefault()
      Alert.alert('Discard changes?', 'Your edits haven’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ])
    })
  }, [navigation])

  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (payload) => propertyService.update(property.id, payload),
    onSuccess: () => {
      savedRef.current = true
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      qc.invalidateQueries({ queryKey: ['manage-listing', property.id] })
      qc.invalidateQueries({ queryKey: ['property', property.id] })
      onSaved()
    },
    onError: (e) => Alert.alert('Error', e?.message ?? 'Failed to update listing'),
  })

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function submit() {
    const e = validate(form)
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    mutation.mutate(buildPayload(form))
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Field label="Title *" error={errors.title}>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(v) => set('title', v)}
          placeholder="e.g. Spacious 2 BHK in Koramangala"
          placeholderTextColor={colors.slate400}
          maxLength={100}
        />
      </Field>

      <Field label="Description *" error={errors.description}>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={form.description}
          onChangeText={(v) => set('description', v)}
          placeholder="Describe the property, surroundings, and unique features"
          placeholderTextColor={colors.slate400}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={2000}
        />
      </Field>

      <Text style={styles.sectionHeading}>Pricing</Text>
      {NUMERIC_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} error={errors[f.key]} hint={!f.required ? 'Leave blank to keep unchanged' : undefined}>
          <TextInput
            style={styles.input}
            value={form[f.key]}
            onChangeText={(v) => set(f.key, v)}
            placeholder={f.placeholder}
            placeholderTextColor={colors.slate400}
            keyboardType="numeric"
          />
        </Field>
      ))}

      <Text style={styles.sectionHeading}>Availability</Text>
      <Field label="Available from" error={errors.availableFrom} hint="YYYY-MM-DD — leave blank to keep unchanged">
        <TextInput
          style={styles.input}
          value={form.availableFrom}
          onChangeText={(v) => set('availableFrom', v)}
          placeholder="2026-08-01"
          placeholderTextColor={colors.slate400}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </Field>

      <Pressable
        style={[styles.saveButton, mutation.isPending && styles.disabled]}
        onPress={submit}
        disabled={mutation.isPending}
        accessibilityRole="button"
        accessibilityLabel="Save changes"
      >
        {mutation.isPending ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

export default function EditListingScreen({ navigation, route }) {
  const { propertyId } = route.params

  const { data: property, isLoading, isError, refetch } = useQuery({
    queryKey: ['manage-listing', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
  })

  function handleSaved() {
    Alert.alert('Saved', 'Listing updated successfully')
    navigation.goBack()
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevronLeft" size={22} color={colors.slate800} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Edit listing</Text>
          {property?.title ? <Text style={styles.headerSub} numberOfLines={1}>{property.title}</Text> : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand600} size="large" />
        </View>
      ) : isError || !property ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn&apos;t load this listing</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading listing">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <EditForm property={property} navigation={navigation} onSaved={handleSaved} />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  headerSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  fieldHint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400 },
  fieldError: { fontFamily: fonts.body, fontSize: 11, color: colors.danger },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800, backgroundColor: colors.white },
  multiline: { minHeight: 100, paddingTop: spacing.sm },
  sectionHeading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.sm },
  saveButton: { backgroundColor: colors.brand600, borderRadius: radius.md, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  saveButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
})
