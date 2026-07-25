import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { userService } from '@services/user.service'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import FormSheet from './FormSheet'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Typed-confirmation destructive flow, mirroring web's DeleteModal:
// the user must type DELETE before the button enables.
export default function DeleteAccountSheet({ visible, onClose }) {
  const { signOut } = useAuth()
  const [typed, setTyped] = useState('')
  const [submitError, setSubmitError] = useState('')

  useResetOnOpen(visible, () => {
    setTyped('')
    setSubmitError('')
  })

  const { mutate: deleteAccount, isPending } = useMutation({
    mutationFn: () => userService.deleteAccount(),
    onSuccess: () => signOut(),
    onError: () => setSubmitError('Could not delete your account. Please try again.'),
  })

  const confirmed = typed.trim() === 'DELETE'

  return (
    <FormSheet visible={visible} onClose={onClose} title="Delete account">
      <Text style={styles.warning}>
        Permanently removes your profile, listings, appointments, and all data. This cannot be undone.
      </Text>

      <Text style={styles.instruction}>
        Type <Text style={styles.deleteWord}>DELETE</Text> to confirm
      </Text>
      <TextInput
        style={styles.input}
        value={typed}
        onChangeText={setTyped}
        placeholder="DELETE"
        placeholderTextColor={colors.slate500}
        autoCapitalize="characters"
        autoCorrect={false}
        accessibilityLabel="Type DELETE to confirm account deletion"
      />

      {!!submitError && <Text style={styles.submitError}>{submitError}</Text>}

      <View style={styles.actions}>
        <Pressable
          style={styles.cancelButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancel account deletion"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.deleteButton, (!confirmed || isPending) && styles.deleteButtonDisabled]}
          onPress={() => deleteAccount()}
          disabled={!confirmed || isPending}
          accessibilityRole="button"
          accessibilityLabel="Permanently delete account"
          accessibilityState={{ disabled: !confirmed || isPending }}
        >
          {isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.deleteText}>Delete</Text>
          )}
        </Pressable>
      </View>
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  warning: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.lg, lineHeight: 20 },
  instruction: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, marginBottom: spacing.xs },
  deleteWord: { fontFamily: fonts.bodySemiBold, color: colors.danger },
  input: {
    minHeight: 48,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    backgroundColor: colors.slate50,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800,
  },
  submitError: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelButton: {
    flex: 1, minHeight: 48, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.slate200,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
  deleteButton: {
    flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteButtonDisabled: { opacity: 0.5 },
  deleteText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
})
