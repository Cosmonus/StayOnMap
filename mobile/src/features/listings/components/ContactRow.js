import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator, Linking, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Icon from '@components/common/Icon'
import { imgUrl, formatDate } from '@utils/format'
import { tapSlop } from '@theme/touchTargets'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Flattens GET /properties/:id/contacts ({ appointments, conversations,
// savedBy, _count }) into one row per unique person — the mobile mirror of
// web's InterestedPeoplePanel, and since 2026-08-12 it speaks the same row
// grammar: collapsed = person + meta + a CHEVRON that says there is more;
// expanded = phone icon / chat icon / Make tenant. No email anywhere.
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
        // The profile phone arrives GATED (contactVisibility enforced
        // server-side); a visit's own contactNumber — given by the renter for
        // that visit — stands in when the profile number is withheld or unset.
        phone: u.phone || appts.find((a) => a.contactNumber)?.contactNumber || null,
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

export default function ContactRow({ contact, canMarkTenant, onMarkTenant, onChat, chatting, disabled }) {
  const [open, setOpen] = useState(false)
  const displayName = contact.name || 'Member'

  return (
    <View style={styles.wrap}>
      {/* The whole collapsed row is the toggle. */}
      <Pressable
        style={styles.row}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${displayName}, ${metaLine(contact)}`}
        accessibilityState={{ expanded: open }}
      >
        {contact.avatarUrl ? (
          <Image source={{ uri: imgUrl(contact.avatarUrl, 'card') }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" transition={200} />
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
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.slate500} />
      </Pressable>

      {open && (
        <View style={styles.actions}>
          {/* Absent phone → NO button, never a disabled one: "chose not to
              share" and "never saved one" must look identical. */}
          {!!contact.phone && (
            <Pressable
              style={styles.iconButton}
              onPress={() => Linking.openURL(`tel:${contact.phone}`)}
              hitSlop={tapSlop(40)}
              accessibilityRole="button"
              accessibilityLabel={`Call ${displayName}`}
            >
              <Icon name="phone" size={16} color={colors.slate600} />
            </Pressable>
          )}
          <Pressable
            style={styles.iconButton}
            onPress={onChat}
            disabled={chatting}
            hitSlop={tapSlop(40)}
            accessibilityRole="button"
            accessibilityLabel={`Chat with ${displayName}`}
            accessibilityState={{ disabled: chatting, busy: chatting }}
          >
            {chatting
              ? <ActivityIndicator size="small" color={colors.slate600} />
              : <Icon name="messageCircle" size={16} color={colors.slate600} />}
          </Pressable>
          {canMarkTenant && (
            <Pressable
              style={[styles.tenantButton, disabled && styles.disabled]}
              onPress={onMarkTenant}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${displayName} as tenant`}
            >
              <Icon name="key" size={13} color={colors.white} />
              <Text style={styles.tenantButtonText}>Make tenant</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 48 },
  avatar: { width: 42, height: 42, borderRadius: radius.full, backgroundColor: colors.slate100 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },
  avatarInitial: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  activity: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md, paddingLeft: 42 + spacing.md },
  iconButton: {
    width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200,
    alignItems: 'center', justifyContent: 'center',
  },
  tenantButton: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.slate900, borderRadius: radius.md,
    paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center',
  },
  tenantButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.white },
  disabled: { opacity: 0.5 },
})
