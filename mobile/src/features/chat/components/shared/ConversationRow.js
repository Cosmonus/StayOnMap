import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import CountBadge from '@components/common/CountBadge'
import { displayName, timeLabel } from './chatFormat'

// One row in a thread list. `other` is resolved by the caller — that is the
// only thing that differs between the two surfaces.
//
// The Owner/Tenant chip that used to sit beside the name is GONE. It made sense
// on a mixed list; on a list that is all owners (renter side) or all renters
// (host side) it is the same word on every row, which is the reason web dropped
// it too. Which listing the thread is about is what tells rows apart.
export default function ConversationRow({ conversation: c, other, userId, isOnline, onPress }) {
  const lastMsg = c.messages?.[0]
  const unread = c._count?.messages ?? 0

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${displayName(other)} about ${c.property?.title ?? 'a property'}${unread > 0 ? `, ${unread} unread` : ''}`}
    >
      <View>
        {other?.avatarUrl ? (
          <Image source={{ uri: imgUrl(other?.avatarUrl) }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{displayName(other)[0]?.toUpperCase()}</Text>
          </View>
        )}
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, unread > 0 && styles.nameBold]} numberOfLines={1}>{displayName(other)}</Text>
          {lastMsg && <Text style={styles.time}>{timeLabel(lastMsg.createdAt)}</Text>}
        </View>
        <Text style={styles.propertyTitle} numberOfLines={1}>{c.property?.title}</Text>
        {lastMsg && (
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {lastMsg.senderId === userId ? 'You: ' : ''}{lastMsg.body}
          </Text>
        )}
      </View>

      <CountBadge count={unread} max={9} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  avatar: { width: 44, height: 44, borderRadius: radius.full },
  avatarFallback: { backgroundColor: colors.brand100, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.brand700 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.white },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700, flexShrink: 1 },
  nameBold: { color: colors.slate900 },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  propertyTitle: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  preview: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  previewUnread: { color: colors.slate700, fontFamily: fonts.bodyMedium },
})
