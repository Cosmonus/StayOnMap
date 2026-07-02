import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@lib/supabase'
import { authService } from '@services/auth.service'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const ROLES = [
  ['TENANT', '🔑', 'Tenant / Renter'],
  ['OWNER', '🏠', 'Property Owner'],
]

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.slate400}
        autoCapitalize="none"
        {...props}
      />
    </View>
  )
}

export default function LoginScreen() {
  const [tab, setTab] = useState('login') // 'login' | 'signup' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('TENANT')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  function switchTab(t) {
    setTab(t)
    setError('')
    setResetSent(false)
  }

  async function handleLogin() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
    // On success, RootNavigator swaps to AppTabs automatically via useAuth()
  }

  async function handleForgot() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'stayonmap://reset-password',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setResetSent(true)
  }

  async function handleSignup() {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name.trim() } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    try {
      await authService.syncProfile({ name: name.trim(), role })
    } catch {
      // best-effort — AuthContext's onAuthStateChange listener retries this too
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>
            {tab === 'login' ? 'Welcome back' : tab === 'signup' ? 'Create account' : 'Reset password'}
          </Text>
          <Text style={styles.subheading}>
            {tab === 'login'
              ? 'Log in to access your saved homes and messages.'
              : tab === 'signup'
              ? 'Join thousands finding homes without brokers.'
              : "We'll send a reset link to your email."}
          </Text>

          {tab !== 'forgot' && (
            <View style={styles.tabSwitcher}>
              {[['login', 'Log In'], ['signup', 'Sign Up']].map(([t, label]) => (
                <Pressable key={t} style={[styles.tabButton, tab === t && styles.tabButtonActive]} onPress={() => switchTab(t)}>
                  <Text style={[styles.tabButtonText, tab === t && styles.tabButtonTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {tab === 'forgot' ? (
            resetSent ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text style={styles.confirmTitle}>Check your inbox</Text>
                <Text style={styles.confirmBody}>We sent a reset link to {email}</Text>
                <Pressable style={[styles.primaryButton, { marginTop: spacing.lg, alignSelf: 'stretch' }]} onPress={() => switchTab('login')}>
                  <Text style={styles.primaryButtonText}>Back to log in</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
                <Pressable
                  style={[styles.primaryButton, (loading || !email) && styles.disabled]}
                  onPress={handleForgot}
                  disabled={loading || !email}
                >
                  <Text style={styles.primaryButtonText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
                </Pressable>
                <Pressable onPress={() => switchTab('login')} style={{ marginTop: spacing.md }}>
                  <Text style={styles.linkText}>← Back to log in</Text>
                </Pressable>
              </>
            )
          ) : tab === 'login' ? (
            <>
              <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
              <Pressable onPress={() => switchTab('forgot')} style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}>
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={handleLogin} disabled={loading}>
                <Text style={styles.primaryButtonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Field label="Full name" value={name} onChangeText={setName} placeholder="Ravi Kumar" />
              <Field label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" secureTextEntry />

              <Text style={styles.label}>I am a</Text>
              <View style={styles.roleRow}>
                {ROLES.map(([value, emoji, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.roleButton, role === value && styles.roleButtonActive]}
                    onPress={() => setRole(value)}
                  >
                    <Text style={[styles.roleButtonText, role === value && styles.roleButtonTextActive]}>
                      {emoji} {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable style={[styles.primaryButton, loading && styles.disabled, { marginTop: spacing.md }]} onPress={handleSignup} disabled={loading}>
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
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.slate800,
  },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger },
  primaryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
  linkText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand600 },
  confirmTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800 },
  confirmBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginTop: spacing.xs, textAlign: 'center' },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  roleButtonActive: { borderColor: colors.brand600, backgroundColor: colors.brand600 },
  roleButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  roleButtonTextActive: { color: colors.white },
})
