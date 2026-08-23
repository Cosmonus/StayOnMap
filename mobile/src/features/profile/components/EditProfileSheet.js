import { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@services/user.service'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import { CITY_OPTIONS } from '@config/cities'
import { PHONE_RE, normalizePhone } from '@utils/phone'
import FormSheet from '@components/common/FormSheet'
import Dropdown from '@components/common/Dropdown'
import LabeledInput from './LabeledInput'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// PHONE_RE / normalizePhone moved to @utils/phone (2026-08-01) so the listing
// wizard's PublishGate could share them — it had no normalisation at all, and
// its placeholder demonstrated a format the server rejects.

export default function EditProfileSheet({ visible, onClose, settings }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')

  // Seeds once per open from whatever `settings` is at that moment — not
  // re-keyed on `settings` itself, so an in-progress edit survives a
  // background refetch instead of being silently overwritten.
  useResetOnOpen(visible, () => {
    setName(settings?.name ?? '')
    setPhone(settings?.phone ?? '')
    setCity(settings?.city ?? '')
    setBio(settings?.bio ?? '')
    setErrors({})
    setSubmitError('')
  })

  const { mutate: save, isPending } = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      onClose()
    },
    onError: () => setSubmitError('Could not save your profile. Please try again.'),
  })

  function handleSave() {
    const next = {}
    if (!name.trim()) next.name = 'Name is required'
    const cleanPhone = phone.trim() ? normalizePhone(phone.trim()) : ''
    if (cleanPhone && !PHONE_RE.test(cleanPhone)) next.phone = 'Enter a valid 10-digit Indian mobile number'
    setErrors(next)
    if (Object.keys(next).length) return
    setSubmitError('')
    // city only travels when set — the backend drops any non-SUPPORTED value.
    save({ name: name.trim(), phone: cleanPhone, bio: bio.trim(), ...(city ? { city } : {}) })
  }

  return (
    <FormSheet visible={visible} onClose={onClose} title="Edit profile" onSave={handleSave} saving={isPending}>
      <LabeledInput label="Name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <LabeledInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        placeholder="9876543210"
        keyboardType="phone-pad"
      />
      {/* Said before the save, not discovered after it: the badge belongs to
          the NUMBER, so the server drops it when the number changes. */}
      {settings?.phoneVerifiedAt && normalizePhone(phone) !== normalizePhone(settings.phone ?? '') && (
        <Text style={styles.phoneWarning}>
          Saving a different number removes your verified badge until you verify the new one.
        </Text>
      )}
      <Text style={styles.cityLabel}>City</Text>
      {/* A dropdown, not chips — 47 cities since 2026-08-24, and a wall of chips
          is not a choice. Labelled "Coimbatore, Tamil Nadu" so either word finds it. */}
      <Dropdown value={city} options={CITY_OPTIONS} placeholder="Select city" onChange={setCity} />

      <LabeledInput
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={300}
        placeholder="Short intro about yourself..."
      />
      {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  cityLabel: {
    fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  submitError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.sm },
  phoneWarning: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.warning700,
    marginTop: -spacing.sm, marginBottom: spacing.sm,
  },
})
