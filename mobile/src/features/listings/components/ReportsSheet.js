import { useState } from 'react'
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert, StyleSheet } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportService } from '@services/report.service'
import FormSheet from '@components/common/FormSheet'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * Reports filed against one of your listings, and the one reply you get.
 *
 * `GET /reports/mine` and `PATCH /:reportId/respond` shipped with the reports
 * feature and had NO caller on either platform until 2026-08-10 — both clients
 * even carried the service wrappers already. So a listing could be reported,
 * and suspended on a risk score built partly from those reports, while its
 * owner had no way to see what was said or answer it.
 *
 * WHAT AN OWNER SEES IS DECIDED SERVER-SIDE, and this must not widen it.
 * `getOwnerReports` selects category, severity, status, description,
 * ownerResponse and createdAt — deliberately NOT `reporterId` or
 * `isAnonymous`. Reporting a listing is public and can be anonymous by design
 * (anonymous fraud reports are the point), so an owner learning who filed one
 * turns a safety feature into a retaliation surface. Do not add a name here
 * even if a future payload starts carrying one.
 */

const SEVERITY_COLOR = {
  CRITICAL: colors.danger,
  HIGH:     '#c2410c',
  MEDIUM:   '#b45309',
  LOW:      colors.slate600,
}

const STATUS_LABEL = {
  PENDING:      'Awaiting review',
  UNDER_REVIEW: 'Being reviewed',
  RESOLVED:     'Resolved',
  DISMISSED:    'Dismissed',
}

const MAX_RESPONSE = 1000

function ReportCard({ propertyId, report }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(report.ownerResponse ?? '')

  const respond = useMutation({
    mutationFn: (body) => reportService.ownerRespond(propertyId, report.id, { ownerResponse: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-reports', propertyId] })
      Alert.alert('Response saved', 'Our moderators will see it with the report.')
    },
    onError: (err) => Alert.alert('Could not save your response', err?.message ?? 'Please try again.'),
  })

  const changed = draft.trim() !== (report.ownerResponse ?? '').trim()
  const canSave = draft.trim().length > 0 && changed && !respond.isPending

  return (
    <View style={styles.card}>
      <View style={styles.metaRow}>
        <Text style={[styles.severity, { color: SEVERITY_COLOR[report.severity] ?? colors.slate600 }]}>
          {report.severity}
        </Text>
        <Text style={styles.category}>{report.category?.replace(/_/g, ' ')}</Text>
      </View>
      <Text style={styles.status}>{STATUS_LABEL[report.status] ?? report.status}</Text>

      {!!report.description && <Text style={styles.description}>{report.description}</Text>}

      <Text style={styles.label}>{report.ownerResponse ? 'Your response' : 'Add your side'}</Text>
      <TextInput
        value={draft}
        onChangeText={(t) => t.length <= MAX_RESPONSE && setDraft(t)}
        multiline
        placeholder="What actually happened, in your words. Moderators read this alongside the report."
        placeholderTextColor={colors.slate500}
        style={styles.input}
      />
      <Pressable
        onPress={() => respond.mutate(draft.trim())}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
      >
        <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
          {respond.isPending ? 'Saving…' : report.ownerResponse ? 'Update response' : 'Send response'}
        </Text>
      </Pressable>
    </View>
  )
}

export default function ReportsSheet({ visible, onClose, propertyId, propertyTitle }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['owner-reports', propertyId],
    queryFn: () => reportService.ownerList(propertyId).then((r) => r.data),
    enabled: visible && !!propertyId,
  })

  const reports = data ?? []

  return (
    <FormSheet visible={visible} onClose={onClose} title="Reports on this listing">
      <Text style={styles.intro}>
        What people have flagged about {propertyTitle ?? 'this listing'}. Reports are anonymous —
        you can answer them, and a moderator reads both sides.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.brand600} style={{ marginTop: spacing.lg }} />
      ) : isError ? (
        // A real error branch with a retry — a `data = []` default would make a
        // network failure look like "nobody has reported this", which is the
        // most reassuring possible way to be wrong.
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Couldn&apos;t load the reports</Text>
          <Pressable onPress={() => refetch()} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="shield" size={28} color={colors.brand600} />
          <Text style={styles.emptyTitle}>Nobody has reported this listing</Text>
          <Text style={styles.emptyBody}>
            If someone does, it will appear here and you can respond before a moderator decides.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          scrollEnabled={false}
          renderItem={({ item }) => <ReportCard propertyId={propertyId} report={item} />}
        />
      )}
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20, marginBottom: spacing.md },
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.white },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  severity: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
  category: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  status: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  description: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, lineHeight: 20, marginTop: spacing.sm },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.slate200, borderRadius: radius.md,
    padding: spacing.sm, minHeight: 88, textAlignVertical: 'top', backgroundColor: colors.slate50,
  },
  saveButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.slate900, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  saveButtonDisabled: { backgroundColor: colors.slate100 },
  saveText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  saveTextDisabled: { color: colors.slate500 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', lineHeight: 20 },
  retry: { minHeight: 48, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.slate900 },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
