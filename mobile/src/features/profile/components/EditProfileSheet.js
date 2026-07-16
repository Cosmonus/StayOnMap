import { useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@services/user.service'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import FormSheet from './FormSheet'
import LabeledInput from './LabeledInput'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

const PHONE_RE = /^[6-9]\d{9}$/

// Strips spaces/dashes and an optional +91 / 0 prefix before validating.
function normalizePhone(raw) {
  const digits = raw.replace(/[\s-]/g, '')
  if (digits.startsWith('+91')) return digits.slice(3)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export default function EditProfileSheet({ visible, onClose, settings }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')

  // Seeds once per open from whatever `settings` is at that moment — not
  // re-keyed on `settings` itself, so an in-progress edit survives a
  // background refetch instead of being silently overwritten.
  useResetOnOpen(visible, () => {
    setName(settings?.name ?? '')
    setPhone(settings?.phone ?? '')
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
    save({ name: name.trim(), phone: cleanPhone, bio: bio.trim() })
  }

  return (
    <FormSheet visible={visible} onClose={onClose} title="Edit profile" onSave={handleSave} saving={isPending}>
      <LabeledInput label="Name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <LabeledInput
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        error={errors.phone}
        placeholder="98765 43210"
        keyboardType="phone-pad"
      />
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
  submitError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.sm },
})
