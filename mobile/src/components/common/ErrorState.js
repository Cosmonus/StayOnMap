import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Shared error state for query-backed screens — a real failure branch with
// retry, so a network error never masquerades as "no results". Mirrors the
// app's empty-state visual pattern (icon circle + title + body + action).
export default function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Icon name="alertTriangle" size={22} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry && (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  icon: {
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.danger50,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate700 },
  body: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500,
    marginTop: spacing.xs, textAlign: 'center', maxWidth: 260,
  },
  retryButton: {
    minHeight: 44, justifyContent: 'center', marginTop: spacing.lg,
    backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl,
  },
  retryButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
