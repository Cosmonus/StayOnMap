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
 */
export default function SocialLoginButtons() {
  const { data: providers } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => authService.getOAuthProviders().then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  })

  if (!providers?.length) return null

  return (
    <View style={styles.wrap}>
      {providers.map((p) => (
        <Pressable
          key={p.key}
          style={styles.button}
          onPress={() =>
            Linking.openURL(`${process.env.EXPO_PUBLIC_API_BASE_URL}/auth/oauth/${p.key}?platform=mobile`).catch(() => {})
          }
          accessibilityRole="button"
          accessibilityLabel={`Continue with ${p.label}`}
        >
          <Icon name="link" size={15} color={colors.slate500} />
          <Text style={styles.label}>Continue with {p.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  button: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
})
