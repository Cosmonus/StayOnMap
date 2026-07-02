import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import LocationPicker from './LocationPicker'
import ImageUploader from './ImageUploader'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STEPS = ['Basic Info', 'Location', 'Photos', 'Amenities & Rules']
const TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'INDEPENDENT_HOUSE', 'COMMERCIAL']
const FURNISHED = ['UNFURNISHED', 'SEMI', 'FULLY']
// Validation only accepts these two cities today (backend properties.validation.js) —
// not silently expanded even though CITY_NAMES elsewhere lists 4.
const CITIES = [
  { name: 'Bengaluru', state: 'Karnataka' },
  { name: 'Chennai', state: 'Tamil Nadu' },
]
const RULE_TOGGLES = [
  ['nonVegAllowed', 'Non-veg allowed'],
  ['bachelorAllowed', 'Bachelors allowed'],
  ['visitorsAllowed', 'Visitors allowed'],
  ['smokingAllowed', 'Smoking allowed'],
  ['alcoholAllowed', 'Alcohol allowed'],
]

const initialForm = {
  title: '', description: '', type: 'APARTMENT', furnished: 'UNFURNISHED',
  bhk: '', sharing: '',
  address: '', city: '', state: '', pincode: '', landmark: '', lat: null, lng: null,
  rent: '', deposit: '', maintenance: '',
  images: [],
  amenityIds: [],
  appointmentWindowStart: '09:00', appointmentWindowEnd: '20:00',
  rules: { nonVegAllowed: false, bachelorAllowed: true, visitorsAllowed: true, smokingAllowed: false, alcoholAllowed: false },
}

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.slate400} {...props} />
    </View>
  )
}

function Chip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  )
}

function validateStep(step, form) {
  if (step === 0) {
    if (form.title.trim().length < 5) return 'Title must be at least 5 characters'
    if (form.description.trim().length < 10) return 'Description must be at least 10 characters'
    if (form.type === 'PG' && !form.sharing) return 'Sharing count is required for PG listings'
    if (form.type !== 'PG' && !form.bhk) return 'BHK is required'
    if (!form.rent || Number(form.rent) <= 0) return 'Enter a valid monthly rent'
    if (form.deposit === '' || Number(form.deposit) < 0) return 'Enter a valid deposit amount'
    return null
  }
  if (step === 1) {
    if (form.address.trim().length < 5) return 'Enter a valid address'
    if (!form.city) return 'Select a city'
    if (!/^\d{6}$/.test(form.pincode)) return 'Enter a valid 6-digit pincode'
    if (form.lat == null || form.lng == null) return 'Pick the exact location on the map'
    return null
  }
  if (step === 2) {
    if (!form.images.length) return 'Add at least one photo'
    return null
  }
  return null
}

export default function AddListingWizard({ onCreated }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')

  const { data: amenities = [] } = useQuery({
    queryKey: ['amenities'],
    queryFn: () => propertyService.getAmenities().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        furnished: form.furnished,
        address: form.address.trim(),
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        landmark: form.landmark.trim() || undefined,
        lat: form.lat,
        lng: form.lng,
        rent: Number(form.rent),
        deposit: Number(form.deposit),
        maintenance: form.maintenance ? Number(form.maintenance) : undefined,
        images: form.images,
        amenityIds: form.amenityIds,
        appointmentWindowStart: form.appointmentWindowStart,
        appointmentWindowEnd: form.appointmentWindowEnd,
        rules: form.rules,
        ...(form.type === 'PG' ? { sharing: Number(form.sharing) } : { bhk: Number(form.bhk) }),
      }
      return propertyService.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      onCreated?.()
    },
    onError: (err) => setError(err?.message || 'Failed to create listing. Please try again.'),
  })

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setCity(name) {
    const cityData = CITIES.find((c) => c.name === name)
    setForm((f) => ({ ...f, city: name, state: cityData?.state ?? '' }))
  }

  function toggleAmenity(id) {
    setForm((f) => ({
      ...f,
      amenityIds: f.amenityIds.includes(id) ? f.amenityIds.filter((a) => a !== id) : [...f.amenityIds, id],
    }))
  }

  function toggleRule(key) {
    setForm((f) => ({ ...f, rules: { ...f.rules, [key]: !f.rules[key] } }))
  }

  function handleNext() {
    const err = validateStep(step, form)
    if (err) { setError(err); return }
    setError('')
    if (step === STEPS.length - 1) {
      mutation.mutate()
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.stepHeader}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive]} />
            {i < STEPS.length - 1 && <View style={[styles.stepLine, i < step && styles.stepLineActive]} />}
          </View>
        ))}
      </View>
      <Text style={styles.stepTitle}>{STEPS[step]}</Text>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {step === 0 && (
          <>
            <Field label="Title" value={form.title} onChangeText={(v) => set('title', v)} placeholder="Sunlit 2BHK near Forum Mall" />
            <Field label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="Describe the property..." multiline numberOfLines={4} style={styles.textarea} />

            <Text style={styles.label}>Property type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => <Chip key={t} label={t.replace(/_/g, ' ')} active={form.type === t} onPress={() => set('type', t)} />)}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Furnishing</Text>
            <View style={styles.chipRow}>
              {FURNISHED.map((f) => <Chip key={f} label={f} active={form.furnished === f} onPress={() => set('furnished', f)} />)}
            </View>

            {form.type === 'PG' ? (
              <Field label="Sharing (people per room)" value={form.sharing} onChangeText={(v) => set('sharing', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="2" style={{ marginTop: spacing.md }} />
            ) : (
              <Field label="BHK" value={form.bhk} onChangeText={(v) => set('bhk', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="2" style={{ marginTop: spacing.md }} />
            )}

            <Field label="Monthly rent (₹)" value={form.rent} onChangeText={(v) => set('rent', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="32000" />
            <Field label="Deposit (₹)" value={form.deposit} onChangeText={(v) => set('deposit', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="100000" />
            <Field label="Maintenance (₹/mo, optional)" value={form.maintenance} onChangeText={(v) => set('maintenance', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" />
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Address" value={form.address} onChangeText={(v) => set('address', v)} placeholder="123 5th Block, Koramangala" />
            <Text style={styles.label}>City</Text>
            <View style={styles.chipRow}>
              {CITIES.map((c) => <Chip key={c.name} label={c.name} active={form.city === c.name} onPress={() => setCity(c.name)} />)}
            </View>
            <Text style={styles.hint}>More cities opening soon</Text>
            <Field label="Pincode" value={form.pincode} onChangeText={(v) => set('pincode', v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="560034" style={{ marginTop: spacing.md }} />
            <Field label="Landmark (optional)" value={form.landmark} onChangeText={(v) => set('landmark', v)} placeholder="Near Forum Mall" />
            <Text style={styles.label}>Exact location</Text>
            <LocationPicker value={form.lat != null ? { lat: form.lat, lng: form.lng } : null} onChange={(loc) => setForm((f) => ({ ...f, lat: loc.lat, lng: loc.lng }))} />
          </>
        )}

        {step === 2 && <ImageUploader value={form.images} onChange={(v) => set('images', v)} />}

        {step === 3 && (
          <>
            <Text style={styles.label}>Amenities</Text>
            <View style={styles.chipRow}>
              {amenities.map((a) => <Chip key={a.id} label={a.name} active={form.amenityIds.includes(a.id)} onPress={() => toggleAmenity(a.id)} />)}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>House rules</Text>
            {RULE_TOGGLES.map(([key, label]) => (
              <Pressable key={key} style={styles.ruleRow} onPress={() => toggleRule(key)}>
                <Text style={styles.ruleLabel}>{label}</Text>
                <View style={[styles.switchTrack, form.rules[key] && styles.switchTrackActive]}>
                  <View style={[styles.switchThumb, form.rules[key] && styles.switchThumbActive]} />
                </View>
              </Pressable>
            ))}

            <Text style={[styles.label, { marginTop: spacing.md }]}>Visiting hours</Text>
            <View style={styles.chipRow}>
              {['08:00', '09:00', '10:00'].map((t) => <Chip key={t} label={`From ${t}`} active={form.appointmentWindowStart === t} onPress={() => set('appointmentWindowStart', t)} />)}
              {['18:00', '20:00', '22:00'].map((t) => <Chip key={t} label={`Till ${t}`} active={form.appointmentWindowEnd === t} onPress={() => set('appointmentWindowEnd', t)} />)}
            </View>
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <Pressable style={styles.backButton} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable style={[styles.nextButton, mutation.isPending && styles.disabled]} onPress={handleNext} disabled={mutation.isPending}>
          {mutation.isPending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.nextButtonText}>{step === STEPS.length - 1 ? 'Save as draft' : 'Continue'}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stepHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.slate200 },
  stepDotActive: { backgroundColor: colors.brand600 },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.slate200, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: colors.brand600 },
  stepTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.xs, marginHorizontal: spacing.lg },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginHorizontal: spacing.lg, marginTop: -4 },
  input: {
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginHorizontal: spacing.lg },
  chip: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  ruleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.lg, paddingVertical: spacing.sm },
  ruleLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  switchTrack: { width: 40, height: 24, borderRadius: 12, backgroundColor: colors.slate200, padding: 2 },
  switchTrackActive: { backgroundColor: colors.brand600 },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchThumbActive: { transform: [{ translateX: 16 }] },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.slate200 },
  backButton: { flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  nextButton: { flex: 2, backgroundColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  disabled: { opacity: 0.6 },
  nextButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
