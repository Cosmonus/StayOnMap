import { View, Text, Pressable, StyleSheet, Linking } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'
import Svg, { Path } from 'react-native-svg'
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
// Google brand mark, mirrored from web's SocialLoginButtons.jsx — the brand
// colours are Google's, not ours, and 18px is Google's own minimum for the mark.
// react-native-svg is already a dependency (lucide-react-native needs it), so
// this costs no new native module.
const ICONS = {
  google: (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z" />
      <Path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z" />
      <Path fill="#FBBC05" d="M5.29 14.28A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1z" />
      <Path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </Svg>
  ),
}

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
      {ICONS[p.key] ?? <Icon name="link" size={16} color={colors.slate500} />}
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
