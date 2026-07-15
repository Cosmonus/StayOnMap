import { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@services/user.service'
import FormSheet from './FormSheet'
import SettingsToggle from './SettingsToggle'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const LISTING_OPTIONS = [
  { value: 'PUBLIC', icon: 'map', label: 'Public' },
  { value: 'LOGGED_IN', icon: 'lock', label: 'Logged-in only' },
  { value: 'HIDDEN', icon: 'eye', label: 'Hidden' },
]

const CONTACT_OPTIONS = [
  { value: 'EVERYONE', icon: 'users', label: 'All users' },
  { value: 'LOGGED_IN', icon: 'lock', label: 'Logged-in only' },
  { value: 'NOBODY', icon: 'eye', label: 'Nobody' },
]

function OptionRow({ option, selected, onSelect }) {
  return (
    <Pressable
      style={[styles.option, selected && styles.optionSelected]}
      onPress={() => onSelect(option.value)}
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ selected }}
    >
      <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
        <Icon name={option.icon} size={15} color={selected ? colors.white : colors.slate400} />
      </View>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
      {selected && <Icon name="check" size={16} color={colors.brand600} />}
    </Pressable>
  )
}

export default function PrivacySheet({ visible, onClose, settings }) {
  const qc = useQueryClient()
  const isOwner = settings?.role === 'OWNER'
  const [listingVisibility, setListingVisibility] = useState('PUBLIC')
  const [contactVisibility, setContactVisibility] = useState('LOGGED_IN')
  const [showExactLocation, setShowExactLocation] = useState(true)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (visible) {
      setListingVisibility(settings?.listingVisibility ?? 'PUBLIC')
      setContactVisibility(settings?.contactVisibility ?? 'LOGGED_IN')
      setShowExactLocation(settings?.showExactLocation ?? true)
      setSubmitError('')
    }
  }, [visible, settings])

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      onClose()
    },
    onError: () => setSubmitError('Could not save your privacy settings. Please try again.'),
  })

  function handleSave() {
    const data = { contactVisibility, showExactLocation }
    if (isOwner) data.listingVisibility = listingVisibility
    save(data)
  }

  return (
    <FormSheet visible={visible} onClose={onClose} title="Privacy & visibility" onSave={handleSave} saving={isPending}>
      {isOwner && (
        <>
          <Text style={styles.sectionLabel}>Listing visibility</Text>
          {LISTING_OPTIONS.map((o) => (
            <OptionRow key={o.value} option={o} selected={listingVisibility === o.value} onSelect={setListingVisibility} />
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>Contact visibility</Text>
      {CONTACT_OPTIONS.map((o) => (
        <OptionRow key={o.value} option={o} selected={contactVisibility === o.value} onSelect={setContactVisibility} />
      ))}

      <Text style={styles.sectionLabel}>Location</Text>
      <SettingsToggle
        icon="mapPin"
        label="Show exact address"
        hint={showExactLocation ? 'Full address visible' : 'Area & city only'}
        value={showExactLocation}
        onChange={setShowExactLocation}
      />

      {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate400,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  optionIcon: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center' },
  optionIconSelected: { backgroundColor: colors.brand600 },
  optionLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate600 },
  optionLabelSelected: { color: colors.slate800 },
  submitError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.sm },
})
