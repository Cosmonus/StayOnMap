import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Icon from '@components/common/Icon'
import { imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Who you are, in one card, on both account screens.
//
//   ┌──────────────────────────────────┐
//   │  (GK)   Gokul                  › │
//   │         srigokulkrishnan@…       │
//   │         Renting in Bengaluru · … │
//   └──────────────────────────────────┘
//
// What it replaces: a left-aligned stack where the avatar rendered ONLY if the
// account had one — no placeholder — so most accounts opened on a bare 28px
// name with a grey line under it and a ragged empty space above. The email was
// worse than absent: it appeared only as a FALLBACK when the account had no
// city, so the moment someone set their city, the address they sign in with
// disappeared from the app entirely.
//
// The order is fixed and the same in both modes: picture, name, email, then the
// one contextual line (mode + city + points). Nothing here is a badge, and
// nothing is conditional except the meta line, so the block has the same shape
// on a brand-new account as on a complete one.
export default function AccountIdentity({ account, isLoading, isError, onRetry, onPress, fallbackName }) {
  if (isLoading) {
    return (
      <View style={[styles.card, styles.centered]}>
        <ActivityIndicator color={colors.brand600} />
      </View>
    )
  }

  if (isError) {
    return (
      <View style={styles.card}>
        <Text style={styles.name}>Your account</Text>
        <Text style={styles.error}>We couldn&apos;t load your details.</Text>
        <Pressable
          style={styles.retry}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try loading your account again"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  const name = account?.name || fallbackName
  // An initial beats a generic silhouette: it is the one thing we always have,
  // and it makes two accounts on one device tell themselves apart.
  const initial = (account?.name || account?.email || '?').trim().charAt(0).toUpperCase()
  const meta = account?.meta

  const body = (
    <>
      {account?.avatarUrl ? (
        <Image source={{ uri: imgUrl(account.avatarUrl) }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>
      )}

      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {!!account?.email && <Text style={styles.email} numberOfLines={1}>{account.email}</Text>}
        {!!meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
      </View>

      {onPress ? <Icon name="chevronRight" size={18} color={colors.slate500} /> : null}
    </>
  )

  if (!onPress) return <View style={styles.card}>{body}</View>

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${account?.email ? `, ${account.email}` : ''}. Edit your profile`}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
  },
  centered: { justifyContent: 'center' },
  avatar: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.slate100 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },
  avatarInitial: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.brand700 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate900 },
  email: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 4 },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: 4 },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: spacing.xs },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
})
