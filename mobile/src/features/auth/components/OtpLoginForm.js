import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// Mirrors the backend's OTP_RESEND_COOLDOWN_MS (auth.service.js). The server
// is the real gate — this only stops the user firing a request it will 429.
const RESEND_COOLDOWN_MS = 60 * 1000

const secondsUntil = (at) => (at ? Math.max(0, Math.ceil((at - Date.now()) / 1000)) : 0)

// Derives the countdown from an absolute timestamp rather than decrementing a
// counter: JS timers are throttled while the app is backgrounded, so a
// decrementing timer would under-count and re-enable Resend early.
function useCountdown(until) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!until) return
    const id = setInterval(() => {
      tick((n) => n + 1)
      if (Date.now() >= until) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [until])
  return secondsUntil(until)
}

/**
 * The two channels a sign-in code can arrive on. Mirrors web's CHANNELS table
 * in features/auth/components/OtpLoginForm.jsx — one form parameterised rather
 * than two, because everything that matters (the absolute-timestamp countdown,
 * the hedged "if this has an account" wording, the resend gate) is identical
 * and a second copy would drift on exactly those details.
 */
const CHANNELS = {
  email: {
    icon: 'mail',
    label: 'Email address',
    placeholder: 'you@example.com',
    keyboardType: 'email-address',
    maxLength: undefined,
    cta: 'Email me a code',
    request: (v) => authService.requestLoginOtp({ email: v }),
    verify: (v, code) => authService.verifyLoginOtp({ email: v, code }),
    sentTo: (v) => v,
    isComplete: (v) => Boolean(v),
    clean: (v) => v,
  },
  phone: {
    icon: 'phone',
    label: 'Mobile number',
    placeholder: '9876543210',
    keyboardType: 'number-pad',
    maxLength: 10,
    cta: 'Text me a code',
    request: (v) => authService.requestPhoneLoginOtp({ phone: v }),
    verify: (v, code) => authService.verifyPhoneLoginOtp({ phone: v, code }),
    sentTo: (v) => `+91 ${v}`,
    isComplete: (v) => /^[6-9]\d{9}$/.test(v),
    // Digits only, country code stripped, so a pasted "+91 98765 43210" works.
    clean: (v) => v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(0, 10),
  },
}

export default function OtpLoginForm({ channel = 'email', email, setEmail, onUsePassword, onSignup, onSwitchChannel, styles: s }) {
  const ch = CHANNELS[channel] ?? CHANNELS.email
  const { loginSuccess } = useAuth()
  const [step, setStep] = useState('email')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const cooldown = useCountdown(resendAt)

  async function send() {
    setLoading(true); setError('')
    try {
      await ch.request(email)
      setStep('code')
      setResendAt(Date.now() + RESEND_COOLDOWN_MS)
    } catch (err) {
      setError(err?.message ?? 'Could not send a code. Try signing in with your password.')
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    setLoading(true); setError('')
    try {
      const res = await ch.verify(email, code)
      await loginSuccess(res.data)
      // RootNavigator swaps to AppTabs via useAuth() — no manual navigation.
    } catch (err) {
      setError(err?.message ?? 'Invalid or expired code')
      setLoading(false)
    }
  }

  if (step === 'email') {
    return (
      <>
        <Text style={s.label}>{ch.label}</Text>
        <View style={s.inputWrap}>
          <Icon name={ch.icon} size={16} color={colors.slate500} />
          <TextInput
            style={s.input}
            value={email}
            onChangeText={(v) => setEmail(ch.clean(v))}
            placeholder={ch.placeholder}
            maxLength={ch.maxLength}
            placeholderTextColor={colors.slate500}
            keyboardType={ch.keyboardType}
            autoCapitalize="none"
            accessibilityLabel="Email address"
          />
        </View>

        {!!error && (
          <View style={[s.errorBox, { marginTop: spacing.md }]}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[s.primaryButton, (loading || !email) && s.disabled, { marginTop: spacing.md }]}
          onPress={send}
          disabled={loading || !email}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || !email, busy: loading }}
        >
          <Text style={s.primaryButtonText}>{loading ? 'Sending…' : ch.cta}</Text>
        </Pressable>

        {!!onSwitchChannel && (
          <Pressable
            onPress={onSwitchChannel}
            style={{ marginTop: spacing.md, alignSelf: 'center' }}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.linkText}>
              {channel === 'phone' ? 'Email me a code instead' : 'Text me a code instead'}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={onUsePassword}
          style={{ marginTop: onSwitchChannel ? spacing.sm : spacing.md, alignSelf: 'center' }}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.linkText}>Use my password instead</Text>
        </Pressable>

        {/* Codes only reach registered accounts — say so up front and point new
            users at signup. Shown to everyone, so it reveals nothing about
            whether any particular address or number has an account. */}
        <View style={local.signupNudge}>
          <Text style={local.nudgeText}>Sign-in codes only work for existing accounts. </Text>
          <Pressable
            onPress={onSignup}
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.linkText}>New here? Sign up first</Text>
          </Pressable>
        </View>
      </>
    )
  }

  return (
    <>
      {/* Deliberately hedged: the backend no-ops silently for unregistered
          emails so this screen can't confirm whether an account exists. */}
      <Text style={[s.confirmBody, { marginBottom: spacing.xs }]}>
        If {email} has an account, a 6-digit code is on its way. It expires in 10 minutes.
      </Text>
      <View style={[local.signupNudge, { marginBottom: spacing.md, marginTop: 0 }]}>
        <Text style={local.nudgeText}>No code after a minute? You may not have an account yet — </Text>
        <Pressable
          onPress={onSignup}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={s.linkText}>create one</Text>
        </Pressable>
      </View>

      <Text style={s.label}>Sign-in code</Text>
      <View style={s.inputWrap}>
        <TextInput
          style={[s.input, local.codeInput]}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          placeholderTextColor={colors.slate300}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          accessibilityLabel="Six digit sign-in code"
        />
      </View>

      {!!error && (
        <View style={[s.errorBox, { marginTop: spacing.md }]}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[s.primaryButton, (loading || code.length !== 6) && s.disabled, { marginTop: spacing.md }]}
        onPress={verify}
        disabled={loading || code.length !== 6}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading || code.length !== 6, busy: loading }}
      >
        <Text style={s.primaryButtonText}>{loading ? 'Verifying…' : 'Sign in'}</Text>
      </Pressable>

      <View style={local.footerRow}>
        <Pressable
          onPress={() => { setStep('email'); setCode(''); setError('') }}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[s.linkText, { color: colors.slate500 }]}>← Change email</Text>
        </Pressable>
        <Pressable
          onPress={send}
          disabled={cooldown > 0 || loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: cooldown > 0 || loading }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[s.linkText, (cooldown > 0 || loading) && { color: colors.slate300 }]}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </>
  )
}

const local = StyleSheet.create({
  codeInput: {
    textAlign: 'center',
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.lg,
    letterSpacing: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 44,
  },
  signupNudge: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  nudgeText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.slate500,
    textAlign: 'center',
  },
})
