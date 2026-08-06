import { View, Text, Pressable, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@services/user.service'
import FormSheet from '@components/common/FormSheet'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * Settings → Blocked people: everyone this user has blocked, with a way back.
 *
 * Not optional garnish. The block confirmation in chat says "You can undo this
 * in Settings", and a promise the app doesn't keep is worse than no promise —
 * the same shape as `showExactLocation`, a control describing a behaviour
 * nothing implements.
 *
 * Only blocks this user MADE are listed. Blocks against them are deliberately
 * absent: showing those would tell someone they have been blocked, which is
 * the signal the server's neutral error message exists to withhold.
 */
export default function BlockedUsersSheet({ visible, onClose }) {
  const qc = useQueryClient()

  const { data: blocked, isLoading, isError, refetch } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: () => userService.listBlocked().then((r) => r.data),
    enabled: visible,
  })

  const unblock = useMutation({
    mutationFn: (userId) => userService.unblockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-users'] })
      // Their threads return to the inbox the moment the block lifts, so the
      // list that hid them has to be refetched too.
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (err) => Alert.alert('Could not unblock', err?.response?.data?.message ?? 'Please try again.'),
  })

  const confirmUnblock = (row) => {
    const name = row.user?.name ?? 'this person'
    Alert.alert(`Unblock ${name}?`, `${name} will be able to message you again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => unblock.mutate(row.user.id) },
    ])
  }

  return (
    <FormSheet visible={visible} onClose={onClose} title="Blocked people">
      {isLoading ? (
        <ActivityIndicator color={colors.brand600} style={styles.centered} />
      ) : isError ? (
        // A silent empty list here would read as "you have blocked nobody",
        // which is a different and much worse claim than "we could not check".
        <View style={styles.centered}>
          <Text style={styles.empty}>We couldn&apos;t load your blocked list.</Text>
          <Pressable onPress={() => refetch()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : !blocked?.length ? (
        <Text style={styles.empty}>
          You haven&apos;t blocked anyone. If someone is bothering you, open your
          conversation with them and tap the menu in the top right.
        </Text>
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(row) => row.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>{item.user?.name ?? 'Someone'}</Text>
                <Text style={styles.meta}>
                  Blocked {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmUnblock(item)}
                disabled={unblock.isPending}
                style={styles.unblockButton}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.user?.name ?? 'this person'}`}
              >
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  centered: { paddingVertical: spacing.xl, alignItems: 'center' },
  empty: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.slate500,
    lineHeight: 21,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  rowText: { flex: 1, marginRight: spacing.md },
  name: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.slate800 },
  meta: { fontFamily: fonts.regular, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  unblockButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  unblockText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.slate800 },
  retry: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  retryText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.slate800 },
})
