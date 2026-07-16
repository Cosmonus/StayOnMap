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

const LINKS = [
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/you' },
  { key: 'instagram', label: 'Instagram', placeholder: 'instagram.com/you' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'x.com/you' },
]

export default function SocialLinksSheet({ visible, onClose, settings }) {
  const qc = useQueryClient()
  const [links, setLinks] = useState({})
  const [submitError, setSubmitError] = useState('')

  useResetOnOpen(visible, () => {
    setLinks(settings?.socialLinks ?? {})
    setSubmitError('')
  })

  const { mutate: save, isPending } = useMutation({
    mutationFn: (socialLinks) => userService.updateProfile({ socialLinks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      onClose()
    },
    onError: () => setSubmitError('Could not save your links. Please try again.'),
  })

  return (
    <FormSheet visible={visible} onClose={onClose} title="Social links" onSave={() => save(links)} saving={isPending}>
      {LINKS.map(({ key, label, placeholder }) => (
        <LabeledInput
          key={key}
          label={label}
          value={links[key] ?? ''}
          onChangeText={(v) => setLinks((p) => ({ ...p, [key]: v }))}
          placeholder={placeholder}
          autoCapitalize="none"
          keyboardType="url"
        />
      ))}
      {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  submitError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.sm },
})
