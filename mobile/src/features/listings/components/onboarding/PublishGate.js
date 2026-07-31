import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Dropdown from '@components/common/Dropdown'
import { userService } from '@services/user.service'
import { authService } from '@services/auth.service'
import { normalizePhone, isValidPhone } from '@utils/phone'
import { CITY_NAMES } from '@config/cities'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The four things POST /properties requires of the person listing (backend
// requireCompleteProfile) — asked HERE, inline, as the last thing before
// publishing. Mirror of web's PublishGate.
//
// It used to be a wall in front of the wizard that sent people to Settings and
// lost the listing they had come to make. The rule is the same; only the
// moment changed.
export default function PublishGate({ missing, profile }) {
  const qc = useQueryClient()
  const need = new Set(missing.map((m) => m.field))
  const [form, setForm] = useState({
    name: profile?.name ?? '',
    phone: profile?.phone ?? '',
    city: profile?.city ?? '',
  })

  const save = useMutation({
    mutationFn: (data) => userService.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  const verify = useMutation({ mutationFn: () => authService.sendEmailVerification() })

  const [phoneError, setPhoneError] = useState('')

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const commit = (k) => { if (form[k]?.trim() && form[k] !== profile?.[k]) save.mutate({ [k]: form[k] }) }

  // Phone is committed as you type, not on blur, and always normalised.
  //
  // Two separate reasons this field appeared broken. The server rejects
  // anything but 10 bare digits, so the number typed the way the placeholder
  // demonstrated it ("98450 12345") 400'd every time. And because Publish
  // stays disabled until missingProfile clears, a save that never fired —
  // blur does not happen if you type the number and reach straight for the
  // button — left the gate up with no explanation at all.
  const commitPhone = (raw) => {
    const clean = normalizePhone(raw)
    if (!clean) { setPhoneError(''); return }
    if (!isValidPhone(clean)) {
      // Silent while the number is merely unfinished; only nag once it is long
      // enough to be wrong rather than incomplete.
      setPhoneError(clean.length >= 10 ? 'Enter a valid 10-digit Indian mobile number' : '')
      return
    }
    setPhoneError('')
    if (clean !== profile?.phone) save.mutate({ phone: clean })
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {need.size === 1 ? 'One thing' : `${need.size} things`} before you publish
      </Text>
      <Text style={styles.body}>
        We ask here rather than at the start, so you never fill a form for a listing you had not made yet.
      </Text>

      {need.has('name') && (
        <View style={styles.field}>
          <Text style={styles.label}>Your full name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            onBlur={() => commit('name')}
            placeholder="Priya Raghavan"
            placeholderTextColor={colors.slate500}
            accessibilityLabel="Your full name"
          />
        </View>
      )}

      {need.has('phone') && (
        <View style={styles.field}>
          <Text style={styles.label}>Contact number</Text>
          <TextInput
            style={[styles.input, phoneError && styles.inputError]}
            value={form.phone}
            onChangeText={(v) => { set('phone', v); commitPhone(v) }}
            onBlur={() => commitPhone(form.phone)}
            placeholder="9845012345"
            placeholderTextColor={colors.slate500}
            keyboardType="phone-pad"
            maxLength={16}
            accessibilityLabel="Contact number"
          />
          {phoneError
            ? <Text style={styles.fieldError}>{phoneError}</Text>
            : <Text style={styles.hint}>10 digits. +91, spaces and dashes are fine.</Text>}
        </View>
      )}

      {need.has('city') && (
        <View style={styles.field}>
          <Text style={styles.label}>Your city</Text>
          <Dropdown
            value={form.city}
            options={CITY_NAMES.map((n) => ({ value: n, label: n }))}
            placeholder="Select city"
            onChange={(v) => { set('city', v); save.mutate({ city: v }) }}
          />
        </View>
      )}

      {need.has('email') && (
        <View style={styles.field}>
          <Text style={styles.label}>Verify your email</Text>
          <Pressable
            style={[styles.verifyButton, verify.isPending && styles.disabled]}
            onPress={() => verify.mutate()}
            disabled={verify.isPending || verify.isSuccess}
            accessibilityRole="button"
            accessibilityLabel="Send verification link"
            accessibilityState={{ disabled: verify.isPending || verify.isSuccess }}
          >
            {verify.isPending
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.verifyText}>{verify.isSuccess ? 'Link sent — check your inbox' : 'Send verification link'}</Text>}
          </Pressable>
        </View>
      )}

      {save.isError && <Text style={styles.error}>{save.error?.message ?? 'Couldn’t save — please try again'}</Text>}
      {verify.isError && <Text style={styles.error}>{verify.error?.message ?? 'Couldn’t send — please try again'}</Text>}

      <Text style={styles.footnote}>
        Your number is shared with a renter only after you accept their visit request.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.warning50, borderRadius: radius.lg, padding: spacing.md },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.warning700 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.warning700, marginTop: 4, lineHeight: 18 },
  field: { marginTop: spacing.md },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate700, marginBottom: spacing.xs },
  input: {
    minHeight: 48, justifyContent: 'center', backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { fontFamily: fonts.body, fontSize: 11, color: colors.danger, marginTop: spacing.xs, lineHeight: 16 },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: spacing.xs, lineHeight: 16 },
  verifyButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.warning700, borderRadius: radius.md, paddingHorizontal: spacing.md },
  verifyText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.6 },
  error: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger, marginTop: spacing.sm },
  footnote: { fontFamily: fonts.body, fontSize: 11, color: colors.warning700, marginTop: spacing.md, lineHeight: 16 },
})
