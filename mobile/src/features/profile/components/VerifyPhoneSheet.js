import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import { useResetOnOpen } from '@/hooks/useResetOnOpen'
import { PHONE_RE, normalizePhone } from '@utils/phone'
import FormSheet from '@components/common/FormSheet'
import LabeledInput from './LabeledInput'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// Mirror of web's VerifyPhoneModal: which number, then the code that proves it.
//
// The number is edited HERE rather than in EditProfileSheet, because the two
// are different acts — that one saves a string, this one proves you hold the
// SIM. The server writes `phone` on a successful verify, so there is no way to
// verify one number and end up with another one saved.
//
// Server messages are shown verbatim: every failure here is actionable (a
// cooldown with seconds left, a daily cap, a number verified on another
// account), and a house string would turn "wait 40s" into "something is wrong".
const message = (err, fallback) => err?.message || fallback

export default function VerifyPhoneSheet({ visible, onClose, currentPhone }) {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useResetOnOpen(visible, () => {
    setPhone(currentPhone ?? '')
    setCode('')
    setSent(false)
    setError('')
  })

  const { mutate: sendCode, isPending: sending } = useMutation({
    mutationFn: () => authService.requestPhoneCode({ phone: normalizePhone(phone) }),
    onSuccess: () => { setError(''); setSent(true) },
    onError: (err) => setError(message(err, 'Could not send the code. Please try again.')),
  })

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: () => authService.verifyPhoneCode({ code: code.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['points'] })
      onClose()
    },
    onError: (err) => setError(message(err, 'That code did not work. Please try again.')),
  })

  const phoneOk = PHONE_RE.test(normalizePhone(phone))

  return (
    <FormSheet
      visible={visible}
      onClose={onClose}
      title="Verify your phone"
      onSave={sent ? () => verify() : () => sendCode()}
      saving={sent ? verifying : sending}
      saveLabel={sent ? 'Verify' : 'Send code'}
    >
      {!sent ? (
        <>
          <Text style={styles.intro}>
            We&apos;ll text you a 6-digit code. Renters and owners see a verified
            badge, and it&apos;s how we keep one number to one account.
          </Text>
          <LabeledInput
            label="Mobile number"
            value={phone}
            onChangeText={(v) => { setPhone(v); setError('') }}
            placeholder="9876543210"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            error={phone && !phoneOk ? 'Enter a valid 10-digit Indian mobile number' : ''}
          />
          <Text style={styles.hint}>Indian mobile numbers only, no country code needed.</Text>
        </>
      ) : (
        <>
          <Text style={styles.intro}>
            Enter the code we sent to <Text style={styles.strong}>{normalizePhone(phone)}</Text>.
            It expires in 10 minutes.
          </Text>
          <LabeledInput
            label="6-digit code"
            value={code}
            onChangeText={(v) => { setCode(v.replace(/\D/g, '')); setError('') }}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            // Android autofills an SMS code into a field marked this way.
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            style={styles.codeInput}
          />
          <View style={styles.actions}>
            <Pressable
              onPress={() => { setSent(false); setCode(''); setError('') }}
              style={styles.linkButton}
              accessibilityRole="button"
              accessibilityLabel="Change number"
            >
              <Text style={styles.link}>Change number</Text>
            </Pressable>
            <Pressable
              onPress={() => !sending && sendCode()}
              style={styles.linkButton}
              accessibilityRole="button"
              accessibilityLabel="Send the code again"
              accessibilityState={{ disabled: sending }}
            >
              <Text style={[styles.link, styles.linkBrand, sending && styles.linkDisabled]}>
                {sending ? 'Sending…' : 'Send again'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600,
    lineHeight: 21, marginBottom: spacing.md,
  },
  strong: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  codeInput: { fontFamily: fonts.body, letterSpacing: 8, textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // 48dp targets around short text links (AGENTS.md §6).
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },
  linkBrand: { color: colors.brand600 },
  linkDisabled: { opacity: 0.6 },
  error: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger,
    marginTop: spacing.sm,
  },
})
