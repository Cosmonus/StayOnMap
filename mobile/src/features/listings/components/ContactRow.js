import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { imgUrl, formatDate } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Flattens GET /properties/:id/contacts ({ appointments, conversations,
// savedBy, _count }) into one row per unique person — ported from web's
// ListingDetailContent aggregatePropertyUsers/buildUserStats pair, extended
// to include people who only saved the listing.
export function buildContactStats(contacts) {
  if (!contacts) return []
  const map = new Map()
  for (const a of contacts.appointments ?? []) {
    if (a.tenant && !map.has(a.tenant.id)) map.set(a.tenant.id, { ...a.tenant })
  }
  for (const c of contacts.conversations ?? []) {
    if (c.tenant && !map.has(c.tenant.id)) map.set(c.tenant.id, { ...c.tenant })
  }
  for (const s of contacts.savedBy ?? []) {
    if (s.user && !map.has(s.user.id)) map.set(s.user.id, { ...s.user })
  }
  return [...map.values()]
    .map((u) => {
      const appts = (contacts.appointments ?? []).filter((a) => (a.tenant?.id ?? a.tenantId) === u.id)
      const convos = (contacts.conversations ?? []).filter((c) => (c.tenant?.id ?? c.tenantId) === u.id)
      const savedEntry = (contacts.savedBy ?? []).find((s) => s.userId === u.id)
      const timestamps = [...appts.map((a) => a.createdAt), ...convos.map((c) => c.lastMessageAt), savedEntry?.createdAt]
        .filter(Boolean)
        .map((t) => new Date(t).getTime())
      return {
        ...u,
        appointmentCount: appts.length,
        hasConversation: convos.length > 0,
        hasSaved: !!savedEntry,
        lastActivity: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null,
      }
    })
    .sort((a, b) => new Date(b.lastActivity ?? 0) - new Date(a.lastActivity ?? 0))
}

function metaLine(c) {
  const parts = []
  if (c.appointmentCount > 0) parts.push(`${c.appointmentCount} visit request${c.appointmentCount > 1 ? 's' : ''}`)
  if (c.hasConversation) parts.push('Chatted')
  if (c.hasSaved) parts.push('Saved')
  return parts.join(' · ') || 'Showed interest'
}

export default function ContactRow({ contact, canMarkTenant, onMarkTenant, disabled }) {
  const displayName = contact.name || contact.email?.split('@')[0] || 'Unknown'
  return (
    <View style={styles.row}>
      {contact.avatarUrl ? (
        <Image source={{ uri: imgUrl(contact.avatarUrl, 'card') }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.meta} numberOfLines={1}>{metaLine(contact)}</Text>
        {contact.lastActivity && <Text style={styles.activity}>Last activity {formatDate(contact.lastActivity)}</Text>}
      </View>
      {canMarkTenant && (
        <Pressable
          style={[styles.tenantButton, disabled && styles.disabled]}
          onPress={onMarkTenant}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${displayName} as tenant`}
          hitSlop={8}
        >
          <Text style={styles.tenantButtonText}>Make tenant</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 },
  avatar: { width: 42, height: 42, borderRadius: radius.full, backgroundColor: colors.slate100 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },
  avatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  activity: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 1 },
  tenantButton: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36, justifyContent: 'center' },
  tenantButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  disabled: { opacity: 0.5 },
})
