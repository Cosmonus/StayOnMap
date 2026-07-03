import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Modal, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { CITIES } from '@config/cities'
import LocationPicker from './LocationPicker'
import ImageUploader from './ImageUploader'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STEPS = ['Basic Info', 'Location', 'Photos', 'Amenities & Rules']
const STEP_ICONS = ['home', 'mapPin', 'camera', 'checkCircle']
const TYPE_OPTIONS = [
  { value: 'APARTMENT', label: 'Apartment' },
  { value: 'HOUSE', label: 'House' },
  { value: 'VILLA', label: 'Villa' },
  { value: 'PG', label: 'PG' },
  { value: 'INDEPENDENT_HOUSE', label: 'Independent House' },
  { value: 'COMMERCIAL', label: 'Commercial' },
]
const FURNISHED_OPTIONS = [
  { value: 'UNFURNISHED', label: 'Unfurnished' },
  { value: 'SEMI', label: 'Semi-furnished' },
  { value: 'FULLY', label: 'Fully furnished' },
]
const CITY_OPTIONS = CITIES.map((c) => ({ value: c.name, label: c.name }))
const RULE_TOGGLES = [
  ['nonVegAllowed', 'Non-veg allowed'],
  ['bachelorAllowed', 'Bachelors allowed'],
  ['visitorsAllowed', 'Visitors allowed'],
  ['smokingAllowed', 'Smoking allowed'],
  ['alcoholAllowed', 'Alcohol allowed'],
]

function formatSlot(t) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const START_TIME_OPTIONS = ['08:00', '09:00', '10:00'].map((t) => ({ value: t, label: formatSlot(t) }))
const END_TIME_OPTIONS = ['18:00', '20:00', '22:00'].map((t) => ({ value: t, label: formatSlot(t) }))

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

function Field({ label, style, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, style]} placeholderTextColor={colors.slate400} {...props} />
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

function Dropdown({ label, value, options, onChange, placeholder = 'Select', edgeMargin = spacing.lg }) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <View style={{ marginBottom: spacing.md }}>
      {!!label && <Text style={[styles.dropdownLabel, { marginHorizontal: edgeMargin }]}>{label}</Text>}
      <Pressable style={[styles.dropdownTrigger, { marginHorizontal: edgeMargin }]} onPress={() => setOpen(true)}>
        <Text style={[styles.dropdownTriggerText, !selected && styles.dropdownPlaceholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="chevronDown" size={16} color={colors.slate400} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.dropdownSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dropdownSheetHeader}>
              <Text style={styles.dropdownSheetTitle}>{label ?? placeholder}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Icon name="close" size={18} color={colors.slate400} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              ItemSeparatorComponent={() => <View style={styles.dropdownSeparator} />}
              renderItem={({ item }) => (
                <Pressable style={styles.dropdownOption} onPress={() => { onChange(item.value); setOpen(false) }}>
                  <Text style={[styles.dropdownOptionText, item.value === value && styles.dropdownOptionTextActive]}>{item.label}</Text>
                  {item.value === value && <Icon name="check" size={16} color={colors.brand600} />}
                </Pressable>
              )}
            />
            <SafeAreaView edges={['bottom']} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
      <View style={styles.stepTitleRow}>
        <Icon name={STEP_ICONS[step]} size={16} color={colors.brand600} />
        <Text style={styles.stepTitle}>{STEPS[step]}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {step === 0 && (
          <>
            <Field label="Title" value={form.title} onChangeText={(v) => set('title', v)} placeholder="Sunlit 2BHK near Forum Mall" />
            <Field label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="Describe the property..." multiline numberOfLines={4} style={styles.textarea} />

            <Dropdown label="Property type" value={form.type} options={TYPE_OPTIONS} onChange={(v) => set('type', v)} />
            <Dropdown label="Furnishing" value={form.furnished} options={FURNISHED_OPTIONS} onChange={(v) => set('furnished', v)} />

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
            <Dropdown label="City" value={form.city} options={CITY_OPTIONS} onChange={setCity} placeholder="Select a city" />
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
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Dropdown label="From" value={form.appointmentWindowStart} options={START_TIME_OPTIONS} onChange={(v) => set('appointmentWindowStart', v)} edgeMargin={0} />
              </View>
              <View style={{ flex: 1 }}>
                <Dropdown label="Till" value={form.appointmentWindowEnd} options={END_TIME_OPTIONS} onChange={(v) => set('appointmentWindowEnd', v)} edgeMargin={0} />
              </View>
            </View>
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.footer}>
          {step > 0 && (
            <Pressable style={styles.backButton} onPress={() => setStep((s) => s - 1)}>
              <Icon name="chevronLeft" size={16} color={colors.slate600} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          )}
          <Pressable style={[styles.nextButton, mutation.isPending && styles.disabled]} onPress={handleNext} disabled={mutation.isPending}>
            {mutation.isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>{step === STEPS.length - 1 ? 'Save as draft' : 'Continue'}</Text>
                <Icon name="chevronRight" size={16} color={colors.white} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
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
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md },
  stepTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
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
  timeRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg },
  dropdownLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.xs },
  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, backgroundColor: colors.white,
  },
  dropdownTriggerText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800 },
  dropdownPlaceholder: { color: colors.slate400 },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dropdownSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%' },
  dropdownSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  dropdownSheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dropdownOptionText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate700 },
  dropdownOptionTextActive: { color: colors.brand700, fontFamily: fonts.bodySemiBold },
  dropdownSeparator: { height: 1, backgroundColor: colors.slate100, marginHorizontal: spacing.lg },
  footer: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  backButton: { flex: 1, flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  nextButton: { flex: 2, flexDirection: 'row', gap: 4, backgroundColor: colors.brand600, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm + 4 },
  disabled: { opacity: 0.6 },
  nextButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
