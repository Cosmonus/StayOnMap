import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * Social sign-in buttons — driven by GET /auth/oauth/providers, so an
 * unconfigured provider never shows a dead button (and with none configured
 * this renders nothing at all).
 *
 * The flow runs in the SYSTEM browser, not a WebView (providers block WebView
 * logins, and the user's browser session means fewer password prompts):
 * open /auth/oauth/<provider>?platform=mobile → provider → backend callback →
 * stayonmap://oauth-complete#… deep link → OAuthRedirectHandler finishes up.
 *
 * `row` USED to render provider-name-only buttons so the login tab could pair
 * them with the sign-in-code button on one line. That produced "[G] Google",
 * which is none of the three wordings Google's branding guidelines sanction
 * ("Sign in with" / "Sign up with" / "Continue with", or logo-only) — reported
 * 2026-08-07 and fixed on web the same day. The visible label is now always the
 * full wording; `row` only affects layout.
 */
export default function SocialLoginButtons({ mode = 'login', row = false }) {
  const { data: providers } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => authService.getOAuthProviders().then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  })

  if (!providers?.length) return null

  // Wording only — the OAuth flow behind the button is identical either way.
  const verb = mode === 'signup' ? 'Sign up' : 'Sign in'
  // A provider that can't create accounts (X shares no email) stays off the
  // signup tab — a button that always errors is worse than no button.
  const usable = mode === 'signup' ? providers.filter((p) => p.canSignup !== false) : providers
  if (!usable.length) return null

  const buttons = usable.map((p) => (
    <Pressable
      key={p.key}
      style={[styles.button, row && styles.rowButton]}
      onPress={() =>
        Linking.openURL(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/oauth/${p.key}?platform=mobile`).catch(() => {})
      }
      accessibilityRole="button"
      accessibilityLabel={`${verb} with ${p.label}`}
    >
      <Icon name="link" size={15} color={colors.slate500} />
      <Text style={styles.label} numberOfLines={1}>{`${verb} with ${p.label}`}</Text>
    </Pressable>
  ))

  if (row) return buttons

  return <View style={styles.wrap}>{buttons}</View>
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  button: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  rowButton: { flexGrow: 1, flexBasis: '45%' },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
})
