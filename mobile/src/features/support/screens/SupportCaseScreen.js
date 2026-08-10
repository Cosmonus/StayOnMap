import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supportService } from '@services/support.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import { STATUS_COPY, CATEGORY_LABEL, caseRef, authorName } from '../supportCopy'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * One of your support requests. Mirrors web's SupportCaseView.
 *
 * Everything arrives already filtered — the server decided which messages this
 * reader may see before it sent them. There is no visibility logic in this file
 * and there must never be: if a message is on screen, it was meant for them.
 */
const TONE = { muted: colors.slate500, brand: colors.brand600, attention: '#b45309', good: '#15803D' }

export default function SupportCaseScreen({ navigation, route }) {
  const { caseId } = route.params
  const qc = useQueryClient()
  const { user } = useAuth()
  const [draft, setDraft] = useState('')

  const { data: c, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-case', caseId],
    queryFn: () => supportService.getCase(caseId).then((r) => r.data),
  })

  const after = () => {
    qc.invalidateQueries({ queryKey: ['support-case', caseId] })
    qc.invalidateQueries({ queryKey: ['support-cases'] })
    // Opening the case marks staff messages read server-side, so the bell's
    // count is stale the moment this renders.
    qc.invalidateQueries({ queryKey: ['notifications'] })
    qc.invalidateQueries({ queryKey: ['notification-unread'] })
  }

  const reply = useMutation({
    mutationFn: () => supportService.reply(caseId, draft.trim()),
    onSuccess: () => { setDraft(''); after() },
    onError: (err) => Alert.alert('Could not send that', err?.message ?? 'Please try again.'),
  })

  const close = useMutation({
    mutationFn: () => supportService.close(caseId),
    onSuccess: after,
    onError: (err) => Alert.alert('Could not close it', err?.message ?? 'Please try again.'),
  })

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScreenHeader title="Your request" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    )
  }

  if (isError || !c) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ScreenHeader title="Your request" onBack={() => navigation.goBack()} />
        <ErrorState title="Couldn't open this request" onRetry={refetch} />
      </SafeAreaView>
    )
  }

  const status = STATUS_COPY[c.status] ?? { label: c.status, tone: 'muted' }
  const closed = c.status === 'CLOSED'
  const canSend = !!draft.trim() && !reply.isPending

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader title={caseRef(c.number)} subtitle={CATEGORY_LABEL[c.type] ?? c.type} onBack={() => navigation.goBack()} />

      <FlatList
        data={c.messages ?? []}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={styles.head}>
            <Text style={styles.subject}>{c.subject}</Text>
            <Text style={[styles.status, { color: TONE[status.tone] ?? colors.slate500 }]}>{status.label}</Text>
            <Text style={styles.description}>{c.description}</Text>
            {c.relatedProperty ? (
              <Text style={styles.about}>
                About {c.relatedProperty.title}{c.relatedProperty.city ? ` · ${c.relatedProperty.city}` : ''}
              </Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={(
          <Text style={styles.empty}>
            No replies yet. We read everything that comes in — usually the same day.
          </Text>
        )}
        renderItem={({ item: m }) => {
          const mine = m.authorUser?.id === user?.id
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={styles.author}>
                {authorName(m, user?.id)} ·{' '}
                {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={styles.body}>{m.body}</Text>
            </View>
          )
        }}
      />

      {closed ? (
        <Text style={styles.closed}>
          This request is closed. If it comes back, open a new one and we will pick it up from there.
        </Text>
      ) : (
        <View style={styles.composer}>
          {/* Offered only once WE have said it is resolved. Closing is the
              requester agreeing, not deciding — and a Close button on an
              unanswered request is an invitation to give up. */}
          {c.status === 'RESOLVED' && (
            <Pressable onPress={() => close.mutate()} style={styles.closeButton} accessibilityRole="button">
              <Text style={styles.closeText}>{close.isPending ? 'Closing…' : 'That fixed it — close'}</Text>
            </Pressable>
          )}
          <TextInput
            value={draft}
            onChangeText={(t) => t.length <= 4000 && setDraft(t)}
            multiline
            placeholder="Add anything else that would help."
            placeholderTextColor={colors.slate500}
            style={styles.input}
          />
          <Pressable
            onPress={() => reply.mutate()}
            disabled={!canSend}
            style={[styles.send, !canSend && styles.sendDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
          >
            <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>
              {reply.isPending ? 'Sending…' : 'Send'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  list: { padding: spacing.md, paddingBottom: spacing.lg },
  head: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate100 },
  subject: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  status: { fontFamily: fonts.body, fontSize: fontSizes.xs, marginTop: 2 },
  description: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 ?? colors.slate600, lineHeight: 20, marginTop: spacing.sm },
  about: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: spacing.sm },
  bubble: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  mine: { backgroundColor: colors.white },
  theirs: { backgroundColor: colors.brand50 },
  author: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: 2 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800, lineHeight: 20 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', paddingVertical: spacing.lg },
  closed: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, padding: spacing.md, textAlign: 'center' },
  composer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.slate200, backgroundColor: colors.white, gap: spacing.sm },
  input: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 72, textAlignVertical: 'top', backgroundColor: colors.slate50,
  },
  send: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: colors.slate100 },
  sendText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  sendTextDisabled: { color: colors.slate500 },
  closeButton: { minHeight: 48, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 ?? colors.slate600 },
})
