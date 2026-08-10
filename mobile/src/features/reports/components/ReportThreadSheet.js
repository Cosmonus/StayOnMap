import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '@services/report.service'
import FormSheet from '@components/common/FormSheet'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * The reporter's side of the conversation on their report.
 *
 * Reached from the notification that announced the reply — the only place a
 * report is ever named in this product. Until 2026-08-10 that notification did
 * not exist and neither did this: a person reported a fraudulent listing and
 * heard nothing, forever, which is how a reporting feature teaches people it
 * does not work.
 *
 * Mirrors web's ReportThreadModal. The OWNER is never a party here: a report
 * can be anonymous, and the owner already cannot see who filed one.
 */
const STATUS_LABEL = {
  PENDING:      'Waiting to be reviewed',
  UNDER_REVIEW: 'Being reviewed',
  RESOLVED:     'Reviewed — action taken',
  DISMISSED:    'Reviewed — no breach found',
}

const MAX = 2000

export default function ReportThreadSheet({ reportId, onClose }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-report-thread', reportId],
    queryFn: () => reportService.myThread(reportId).then((r) => r.data),
    enabled: !!reportId,
  })

  const reply = useMutation({
    mutationFn: (body) => reportService.myReply(reportId, body),
    onSuccess: () => {
      setDraft('')
      qc.invalidateQueries({ queryKey: ['my-report-thread', reportId] })
      // Opening the thread marks the moderator's messages read server-side, so
      // the bell's count is stale the moment this renders.
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    },
    onError: (err) => Alert.alert('Could not send your message', err?.message ?? 'Please try again.'),
  })

  const messages = data?.messages ?? []
  const canSend = !!draft.trim() && !reply.isPending

  return (
    <FormSheet visible={!!reportId} onClose={onClose} title="Your report">
      {isLoading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.lg }} />
      ) : isError ? (
        // A real error branch with a retry. A `data = []` default would make a
        // network failure look like an empty conversation, which here reads as
        // "nobody ever replied" — the exact thing this feature exists to fix.
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load this report</Text>
          <Pressable onPress={() => refetch()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.status}>
            {data?.report?.category?.replace(/_/g, ' ').toLowerCase()} ·{' '}
            {STATUS_LABEL[data?.report?.status] ?? data?.report?.status}
          </Text>

          {messages.length > 0 ? (
            messages.map((m) => {
              const mine = m.authorRole === 'REPORTER'
              return (
                <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {/* "StayOnMap", never a moderator's name — which individual
                      handled a report is not something a reporter needs, and is
                      something a determined person could act on. */}
                  <Text style={styles.author}>
                    {mine ? 'You' : 'StayOnMap'} ·{' '}
                    {new Date(m.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.body}>{m.body}</Text>
                </View>
              )
            })
          ) : (
            <Text style={styles.empty}>
              No messages yet. You can add anything that would help us look into this.
            </Text>
          )}

          <TextInput
            value={draft}
            onChangeText={(t) => t.length <= MAX && setDraft(t)}
            multiline
            placeholder="Add detail — which listing, what happened, anything you can send us."
            placeholderTextColor={colors.slate500}
            style={styles.input}
          />
          <Text style={styles.privacy}>Only our team sees this. The owner never does.</Text>
          <Pressable
            onPress={() => reply.mutate(draft.trim())}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            style={[styles.send, !canSend && styles.sendDisabled]}
          >
            <Text style={[styles.sendText, !canSend && styles.sendTextDisabled]}>
              {reply.isPending ? 'Sending…' : 'Send'}
            </Text>
          </Pressable>
        </>
      )}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  status: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginBottom: spacing.md },
  bubble: { borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  mine: { backgroundColor: colors.slate50 },
  theirs: { backgroundColor: colors.brand50 },
  author: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: 2 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800, lineHeight: 20 },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginBottom: spacing.md },
  input: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 88, textAlignVertical: 'top', backgroundColor: colors.slate50,
    marginTop: spacing.sm,
  },
  privacy: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: spacing.xs },
  send: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  sendDisabled: { backgroundColor: colors.slate100 },
  sendText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  sendTextDisabled: { color: colors.slate500 },
  center: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  retry: { minHeight: 48, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.slate900 },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
