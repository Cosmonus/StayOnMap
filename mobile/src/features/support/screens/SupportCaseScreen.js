import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert, Linking, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supportService } from '@services/support.service'
import { uploadService } from '@services/upload.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import Icon from '@components/common/Icon'
import { STATUS_COPY, CATEGORY_LABEL, caseRef, authorName } from '../supportCopy'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
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
  const { contentMaxWidth } = useLayout()
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
    qc.invalidateQueries({ queryKey: ['support-unread'] })
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

  // Evidence belongs to the CASE, not to a message — that is how the model is
  // shaped, and it is the simpler truth: a screenshot is about the problem, not
  // about the sentence it arrived next to. It also removes the only
  // partial-failure path, since there is no message to orphan.
  //
  // ANY file type, matching web. Two pickers rather than one because Android
  // has two: the photo picker is permissionless and shows a grid of your
  // camera roll, the document picker reaches Downloads, Drive and everything
  // else. Offering only the second would make attaching a screenshot — the
  // commonest case by far — a trip through a file browser.
  const [attaching, setAttaching] = useState(false)

  async function upload(asset) {
    setAttaching(true)
    try {
      const { data } = await uploadService.uploadSupportFile(asset)
      await supportService.attach(caseId, {
        url: data.url,
        fileName: data.fileName ?? asset.name ?? asset.fileName ?? 'attachment',
        // The type the SERVER decided to serve, never the one the device
        // declared — a record that disagrees with storage makes something
        // render on a promise storage will not keep.
        mimeType: data.mimeType ?? 'application/octet-stream',
        sizeBytes: data.sizeBytes,
      })
      after()
    } catch (err) {
      Alert.alert('Could not attach that', err?.message ?? 'Please try again.')
    } finally {
      setAttaching(false)
    }
  }

  function handleAttach() {
    Alert.alert('Attach evidence', 'What would you like to send?', [
      { text: 'Photo', onPress: pickPhoto },
      { text: 'File', onPress: pickFile },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  async function pickPhoto() {
    // Permissionless OS photo picker — the house convention, same as chat's.
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (result.canceled || !result.assets?.length) return
    upload(result.assets[0])
  }

  async function pickFile() {
    // `type: '*/*'` on purpose: narrowing it here would grey out the very files
    // somebody needs to prove something, for a rule the server no longer has.
    // copyToCacheDirectory, or the content:// URI can be unreadable by the time
    // FormData tries to stream it.
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
    if (result.canceled || !result.assets?.length) return
    upload(result.assets[0])
  }

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
        contentContainerStyle={[styles.list, centered(contentMaxWidth)]}
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

            {/* Only what this reader may see — the server filtered before
                sending, so a file on screen was meant for them. */}
            {c.attachments?.length > 0 && (
              <View style={styles.files}>
                {c.attachments.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => Linking.openURL(a.url)}
                    style={styles.file}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${a.fileName ?? 'attachment'}`}
                  >
                    <Icon name="attach" size={13} color={colors.slate600} />
                    <Text style={styles.fileName} numberOfLines={1}>{a.fileName ?? 'Attachment'}</Text>
                  </Pressable>
                ))}
              </View>
            )}
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
          <Pressable
            onPress={handleAttach}
            disabled={attaching}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Attach evidence"
            accessibilityState={{ disabled: attaching }}
          >
            <Text style={styles.closeText}>{attaching ? 'Attaching…' : 'Attach evidence'}</Text>
          </Pressable>
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
  files: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  file: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    minHeight: 40, paddingHorizontal: spacing.sm,
    borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.slate200, backgroundColor: colors.slate50,
  },
  fileName: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, maxWidth: 160 },
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
