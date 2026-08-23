import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Modal, Linking, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import Dropdown from '@components/common/Dropdown'
import Icon from '@components/common/Icon'
import { CITY_OPTIONS, CITY_LIST_LABEL } from '@config/cities'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'


// Manual fragment parse — Hermes' URLSearchParams has historically been
// incomplete, and this is four keys.
function parseFragment(url) {
  const hash = url.split('#')[1]
  if (!hash) return {}
  const out = {}
  for (const pair of hash.split('&')) {
    const i = pair.indexOf('=')
    if (i > 0) out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1))
  }
  return out
}

/**
 * Finishes a social login that came back from the system browser as a
 * stayonmap://oauth-complete#… deep link (the mobile twin of web's
 * /oauth-complete page). Mounted once in RootNavigator; inert until a
 * matching URL arrives — foreground event AND cold start both handled.
 */
export default function OAuthRedirectHandler() {
  const { loginSuccess } = useAuth()
  const qc = useQueryClient()
  const [pending, setPending] = useState(null) // { token, name } → city step
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [waitlisted, setWaitlisted] = useState(false)

  useEffect(() => {
    async function handleUrl(url) {
      if (!url?.startsWith('stayonmap://oauth-complete')) return
      const result = parseFragment(url)

      if (result.token && result.refresh) {
        try {
          await AsyncStorage.setItem('user_token', result.token)
          const me = await authService.getMe()
          await loginSuccess({ token: result.token, refreshToken: result.refresh, user: me.data })
        } catch {
          Alert.alert('Sign-in failed', 'Please try again.')
        }
      } else if (result.pending) {
        setCity('')
        setError('')
        setWaitlisted(false)
        setPending({ token: result.pending, name: result.name })
      } else if (result.linked) {
        qc.invalidateQueries({ queryKey: ['linked-accounts'] })
        Alert.alert('Connected', `${result.linked} is now linked to your account`)
      } else if (result.error) {
        Alert.alert('Sign-in failed', result.error)
      }
    }

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    Linking.getInitialURL().then((url) => handleUrl(url)) // cold start
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function completeSignup() {
    if (!city) return
    setBusy(true)
    setError('')
    try {
      const res = await authService.completeOAuthSignup({ token: pending.token, city })
      if (res.data?.waitlisted) { setWaitlisted(true); return }
      await loginSuccess(res.data)
      setPending(null)
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      visible={Boolean(pending)}
      transparent
      animationType="fade"
      onRequestClose={() => setPending(null)} // hardware back dismisses (AGENTS §2)
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {waitlisted ? (
            <>
              <View style={styles.waitlistIcon}>
                <Icon name="mapPin" size={22} color={colors.brand600} />
              </View>
              <Text style={styles.title}>You&apos;re on the waitlist</Text>
              <Text style={styles.hint}>
                StayOnMap is currently live in {CITY_LIST_LABEL}. We&apos;ll email you as soon as we launch near you.
              </Text>
              <Pressable style={styles.primaryButton} onPress={() => setPending(null)} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Done</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>
                Almost there{pending?.name ? `, ${pending.name.split(' ')[0]}` : ''}
              </Text>
              <Text style={styles.hint}>One last thing — which city are you in?</Text>
              <Dropdown
                label="City"
                value={city}
                onChange={setCity}
                placeholder="Select your city"
                options={CITY_OPTIONS}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                style={[styles.primaryButton, (!city || busy) && styles.buttonDisabled]}
                disabled={!city || busy}
                onPress={completeSignup}
                accessibilityRole="button"
                accessibilityLabel="Finish signing up"
                accessibilityState={{ disabled: !city || busy }}
              >
                <Text style={styles.primaryButtonText}>{busy ? 'Creating your account…' : 'Finish signing up'}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(13,12,10,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: colors.white,
    borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm,
  },
  waitlistIcon: {
    width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, textAlign: 'center' },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', marginBottom: spacing.xs },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger },
  primaryButton: {
    minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.white },
})
