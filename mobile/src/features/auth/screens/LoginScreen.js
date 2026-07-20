import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import Icon from '@components/common/Icon'
import Dropdown from '@components/common/Dropdown'
import OtpLoginForm from '@features/auth/components/OtpLoginForm'
import SocialLoginButtons from '@features/auth/components/SocialLoginButtons'
import { CITY_NAMES } from '@config/cities'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const CITY_DROPDOWN_OPTIONS = [
  ...CITY_NAMES.map((name) => ({ value: name, label: name })),
  { value: '__other__', label: "My city isn't listed" },
]

const ROLES = [
  ['TENANT', 'key', 'Tenant / Renter'],
  ['OWNER', 'home', 'Property Owner'],
]

// A `secureTextEntry` field gets a show/hide eye, matching web's password
// inputs. The toggle lives here rather than at each call site so every password
// field on this screen (login + signup) gets it from one place.
function Field({ label, icon, style, secureTextEntry, ...props }) {
  const [reveal, setReveal] = useState(false)
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Icon name={icon} size={16} color={colors.slate400} />
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.slate400}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry && !reveal}
          {...props}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setReveal((v) => !v)}
            // The icon is 18dp; hitSlop brings the touch target to ~48dp per
            // AGENTS.md §6 without enlarging the input row.
            hitSlop={15}
            accessibilityRole="button"
            accessibilityLabel={reveal ? 'Hide password' : 'Show password'}
            accessibilityState={{ selected: reveal }}
          >
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={18} color={colors.slate400} />
          </Pressable>
        )}
      </View>
    </View>
  )
}

export default function LoginScreen() {
  const { loginSuccess } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'signup' | 'forgot' | 'otp'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('TENANT')
  const [city, setCity] = useState('')
  const [otherCity, setOtherCity] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [waitlisted, setWaitlisted] = useState(false)

  function switchTab(t) {
    setTab(t)
    setError('')
    setResetSent(false)
    setWaitlisted(false)
  }

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      const res = await authService.login({ email, password })
      await loginSuccess(res.data)
      // On success, RootNavigator swaps to AppTabs automatically via useAuth()
    } catch (err) {
      setError(err?.message ?? 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot() {
    setLoading(true)
    setError('')
    try {
      await authService.requestPasswordReset({ email })
      setResetSent(true)
    } catch (err) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup() {
    if (!name.trim()) { setError('Name is required'); return }
    const resolvedCity = city === '__other__' ? otherCity.trim() : city
    if (!resolvedCity) { setError('Please select your city'); return }
    setLoading(true)
    setError('')
    try {
      const res = await authService.register({ name: name.trim(), email, password, city: resolvedCity, role })
      if (res.data?.waitlisted) {
        setWaitlisted(true)
        return
      }
      await loginSuccess(res.data)
    } catch (err) {
      setError(err?.message ?? 'Could not create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>
            {tab === 'login' ? 'Welcome back' : tab === 'otp' ? 'Sign in with a code' : tab === 'forgot' ? 'Reset password' : waitlisted ? 'Almost there' : 'Create account'}
          </Text>
          <Text style={styles.subheading}>
            {tab === 'login'
              ? 'Log in to access your saved homes and messages.'
              : tab === 'otp'
              ? "No password needed — we'll email you a 6-digit code."
              : tab === 'forgot'
              ? "We'll send a reset link to your email."
              : waitlisted
              ? 'Thanks for your interest in StayOnMap.'
              : 'Join thousands finding homes without brokers.'}
          </Text>

          {tab !== 'forgot' && tab !== 'otp' && !waitlisted && (
            <View style={styles.tabSwitcher}>
              {[['login', 'Log In'], ['signup', 'Sign Up']].map(([t, label]) => (
                <Pressable
                  key={t}
                  style={[styles.tabButton, tab === t && styles.tabButtonActive]}
                  onPress={() => switchTab(t)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t }}
                >
                  <Text style={[styles.tabButtonText, tab === t && styles.tabButtonTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* OtpLoginForm owns its own error rendering */}
          {!!error && tab !== 'otp' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {tab === 'otp' ? (
            <OtpLoginForm
              email={email}
              setEmail={setEmail}
              onUsePassword={() => switchTab('login')}
              styles={styles}
            />
          ) : tab === 'forgot' ? (
            resetSent ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text style={styles.confirmTitle}>Check your inbox</Text>
                <Text style={styles.confirmBody}>We sent a reset link to {email}</Text>
                <Pressable style={[styles.primaryButton, { marginTop: spacing.lg, alignSelf: 'stretch' }]} onPress={() => switchTab('login')} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>Back to log in</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Field icon="mail" label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <Pressable
                  style={[styles.primaryButton, (loading || !email) && styles.disabled]}
                  onPress={handleForgot}
                  disabled={loading || !email}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading || !email }}
                >
                  <Text style={styles.primaryButtonText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
                </Pressable>
                <Pressable onPress={() => switchTab('login')} style={{ marginTop: spacing.md }} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8 }}>
                  <Text style={styles.linkText}>← Back to log in</Text>
                </Pressable>
              </>
            )
          ) : tab === 'login' ? (
            <>
              <Field icon="mail" label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <Field icon="lock" label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
              <Pressable onPress={() => switchTab('forgot')} style={{ alignSelf: 'flex-end', marginBottom: spacing.md }} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8 }}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, loading && styles.disabled]}
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                <Text style={styles.primaryButtonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={styles.secondaryButton}
                onPress={() => switchTab('otp')}
                accessibilityRole="button"
              >
                <Icon name="mail" size={16} color={colors.brand600} />
                <Text style={styles.secondaryButtonText}>Email me a sign-in code</Text>
              </Pressable>

              <SocialLoginButtons />
            </>
          ) : waitlisted ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <Text style={styles.confirmTitle}>You&apos;re on the waitlist</Text>
              <Text style={styles.confirmBody}>
                StayOnMap is currently live in {CITY_NAMES.join(', ')}. We&apos;ll email {email} as soon as we launch near you.
              </Text>
              <Pressable style={[styles.primaryButton, { marginTop: spacing.lg, alignSelf: 'stretch' }]} onPress={() => switchTab('login')} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Back to log in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Field icon="users" label="Full name" value={name} onChangeText={setName} placeholder="Ravi Kumar" />
              <Field icon="mail" label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />

              <Text style={styles.label}>City</Text>
              <Dropdown
                label="City"
                value={city}
                options={CITY_DROPDOWN_OPTIONS}
                onChange={setCity}
                placeholder="Select your city"
              />
              {city === '__other__' && (
                <Field icon="building" label="Which city are you in?" value={otherCity} onChangeText={setOtherCity} placeholder="Type your city" />
              )}
              <Text style={styles.hint}>We&apos;re only live in {CITY_NAMES.join(', ')} right now — other cities go on our waitlist.</Text>

              <Field icon="lock" label="Password" value={password} onChangeText={setPassword} placeholder="Min. 8 characters" secureTextEntry />

              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleRow}>
                {ROLES.map(([value, icon, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.roleButton, role === value && styles.roleButtonActive]}
                    onPress={() => setRole(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: role === value }}
                  >
                    <Icon name={icon} size={16} color={role === value ? colors.white : colors.slate500} />
                    <Text style={[styles.roleButtonText, role === value && styles.roleButtonTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.primaryButton, loading && styles.disabled, { marginTop: spacing.md }]}
                onPress={handleSignup}
                disabled={loading}
                accessibilityRole="button"
                accessibilityState={{ disabled: loading, busy: loading }}
              >
                <Text style={styles.primaryButtonText}>{loading ? 'Creating account…' : 'Create account'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800, marginBottom: spacing.xs },
  subheading: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginBottom: spacing.lg },
  tabSwitcher: { flexDirection: 'row', backgroundColor: colors.slate100, borderRadius: radius.md, padding: 4, marginBottom: spacing.lg },
  tabButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabButtonActive: { backgroundColor: colors.brand600 },
  tabButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate400 },
  tabButtonTextActive: { color: colors.white },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.xs },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: -spacing.sm + 2, marginBottom: spacing.md },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.slate800,
  },
  errorBox: { backgroundColor: colors.danger50, borderWidth: 1, borderColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger },
  primaryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.slate200 },
  dividerText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400 },
  secondaryButton: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
  linkText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand600 },
  confirmTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800 },
  confirmBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: spacing.xs, textAlign: 'center' },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonActive: { borderColor: colors.brand600, backgroundColor: colors.brand600 },
  roleButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  roleButtonTextActive: { color: colors.white },
})
