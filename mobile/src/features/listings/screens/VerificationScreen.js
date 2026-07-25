import { useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '@services/verification.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

// Property/business documents only — identity docs (Aadhaar/PAN/govt ID/
// selfie) paused 2026-07-21 pending legal review; the backend refuses them.
const DOC_TYPES = [
  { value: 'PROPERTY_TAX', label: 'Property Tax Receipt' },
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'RENTAL_AGREEMENT', label: 'Rental / Sale Agreement' },
  { value: 'PATTA_TITLE', label: 'Patta / Title Deed' },
  { value: 'GST', label: 'GST Certificate' },
  { value: 'TRADE_LICENSE', label: 'Trade / Shop License' },
  { value: 'HOMESTAY_PERMIT', label: 'Homestay / Tourism Permit' },
  { value: 'OTHER', label: 'Other' },
]

const STATUS_CONFIG = {
  PENDING:      { label: 'Pending review', bg: colors.warning50, text: '#B45309', dot: '#FBBF24' },
  UNDER_REVIEW: { label: 'Under review',   bg: '#EFF6FF', text: '#1D4ED8', dot: '#60A5FA' },
  VERIFIED:     { label: 'Verified',       bg: colors.success50, text: '#15803D', dot: '#4ADE80' },
  REJECTED:     { label: 'Rejected',       bg: colors.danger50, text: '#DC2626', dot: '#F87171' },
  SUSPENDED:    { label: 'Suspended',      bg: colors.danger50, text: '#DC2626', dot: '#F87171' },
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING
  return (
    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

export default function VerificationScreen({ route }) {
  const { propertyId, propertyTitle } = route.params
  const qc = useQueryClient()
  const [docType, setDocType] = useState(DOC_TYPES[0].value)
  const [docUrl, setDocUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const [docAddress, setDocAddress] = useState('')

  const { data: verification, isLoading } = useQuery({
    queryKey: ['verification', propertyId],
    queryFn: () => verificationService.getStatus(propertyId).then((r) => r.data),
    retry: (_, err) => err?.statusCode !== 404,
  })

  const submitMutation = useMutation({
    mutationFn: () => verificationService.submit(
      propertyId,
      docAddress.trim() ? { documentAddress: docAddress.trim() } : undefined
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verification', propertyId] }),
  })

  const docMutation = useMutation({
    mutationFn: (data) => verificationService.addDocument(propertyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verification', propertyId] })
      setDocUrl('')
    },
  })

  function handleAddDoc() {
    setUrlError('')
    try { new URL(docUrl) } catch {
      setUrlError('Please enter a valid URL (e.g. https://drive.google.com/...)')
      return
    }
    docMutation.mutate({ type: docType, url: docUrl })
  }

  const canAddDocs = verification && verification.status !== 'VERIFIED'

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.brand600} size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerTitleRow}>
          <Icon name="shieldCheck" size={20} color={colors.slate800} />
          <Text style={styles.headerTitle}>Get Verified</Text>
        </View>

        <View style={styles.propertyBox}>
          <Text style={styles.propertyBoxLabel}>Verifying ownership for</Text>
          <Text style={styles.propertyBoxTitle}>{propertyTitle}</Text>
        </View>

        {verification ? (
          <View style={{ gap: spacing.md }}>
            <View style={styles.statusRow}>
              <Text style={styles.sectionTitle}>Verification status</Text>
              <StatusPill status={verification.status} />
            </View>

            {verification.status === 'VERIFIED' && (
              <View style={styles.verifiedBox}>
                <View style={styles.boxTitleRow}>
                  <Icon name="shieldCheck" size={15} color="#166534" />
                  <Text style={styles.verifiedTitle}>You&apos;re verified!</Text>
                </View>
                <Text style={styles.verifiedBody}>Your listing now shows the Verified Owner badge to renters.</Text>
              </View>
            )}

            {verification.status === 'REJECTED' && verification.adminNote && (
              <View style={styles.rejectedBox}>
                <View style={styles.boxTitleRow}>
                  <Icon name="alertTriangle" size={13} color="#B91C1C" />
                  <Text style={styles.rejectedTitle}>Reason for rejection</Text>
                </View>
                <Text style={styles.rejectedBody}>{verification.adminNote}</Text>
              </View>
            )}

            {verification.documents?.length > 0 && (
              <View>
                <Text style={styles.label}>Documents submitted</Text>
                <View style={{ gap: spacing.xs }}>
                  {verification.documents.map((doc) => (
                    <View key={doc.id} style={styles.docRow}>
                      <Icon name="document" size={13} color={colors.slate500} />
                      <Text style={styles.docType}>{DOC_TYPES.find((d) => d.value === doc.type)?.label ?? doc.type}</Text>
                      <Text style={styles.docUrl} numberOfLines={1}>{doc.url}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {verification.status === 'REJECTED' && (
              <Pressable
                style={styles.darkButton}
                onPress={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Resubmit for review"
                accessibilityState={{ disabled: submitMutation.isPending, busy: submitMutation.isPending }}
              >
                {submitMutation.isPending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <Icon name="shieldCheck" size={15} color={colors.white} />
                    <Text style={styles.darkButtonText}>Resubmit for review</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={styles.whyBox}>
              <View style={styles.boxTitleRow}>
                <Icon name="shieldCheck" size={15} color={colors.brand900} />
                <Text style={styles.whyTitle}>Why get verified?</Text>
              </View>
              <Text style={styles.whyItem}>• Earn the Verified Owner badge on your listing</Text>
              <Text style={styles.whyItem}>• Builds trust with potential tenants</Text>
              <Text style={styles.whyItem}>• Increases appointment requests</Text>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Property address as printed on your document</Text>
              <TextInput
                style={styles.addressInput}
                value={docAddress}
                onChangeText={setDocAddress}
                placeholder="Exactly as it appears on the tax bill / deed"
                placeholderTextColor={colors.slate500}
                maxLength={300}
                multiline
              />
              <Text style={styles.fieldHint}>
                The reviewer compares this against your listing address — a match speeds verification up.
              </Text>
            </View>
            <Pressable
              style={styles.darkButton}
              onPress={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Start verification"
              accessibilityState={{ disabled: submitMutation.isPending, busy: submitMutation.isPending }}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Icon name="shieldCheck" size={15} color={colors.white} />
                  <Text style={styles.darkButtonText}>Start verification</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Server-computed comparison of the declared document address against
            the CURRENT listing address. Amber only for a pincode contradiction
            — low text overlap gets a nudge, never an accusation. */}
        {verification?.addressMatch?.verdict === 'mismatch' && (
          <View style={styles.matchWarnBox}>
            <Text style={styles.matchWarnTitle}>The document and listing addresses disagree</Text>
            <Text style={styles.matchWarnText}>{verification.addressMatch.notes[0]}</Text>
            <Text style={styles.matchWarnText}>
              Fix the listing address, or upload the document that matches it — a reviewer will compare them.
            </Text>
          </View>
        )}
        {verification?.addressMatch?.verdict === 'partial' && (
          <Text style={styles.matchNote}>{verification.addressMatch.notes[0]}</Text>
        )}
        {verification?.addressMatch?.verdict === 'match' && (
          <Text style={styles.matchNote}>
            Document address matches the listing{verification.addressMatch.pincode?.match ? ' (pincode confirmed)' : ''}.
          </Text>
        )}

        {canAddDocs && (
          <View style={styles.addDocForm}>
            <Text style={styles.sectionTitle}>Add a document</Text>
            <Text style={styles.addDocHint}>Upload your document to Google Drive / Dropbox and paste the public link here.</Text>

            <View style={styles.chipWrap}>
              {DOC_TYPES.map((d) => (
                <Pressable
                  key={d.value}
                  style={[styles.chip, docType === d.value && styles.chipActive]}
                  onPress={() => setDocType(d.value)}
                  hitSlop={{ top: 4, bottom: 4 }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: docType === d.value }}
                >
                  <Text style={[styles.chipText, docType === d.value && styles.chipTextActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.input, urlError && styles.inputError]}
              placeholder="https://drive.google.com/..."
              placeholderTextColor={colors.slate500}
              value={docUrl}
              onChangeText={(v) => { setDocUrl(v); setUrlError('') }}
              autoCapitalize="none"
              keyboardType="url"
            />
            {urlError && <Text style={styles.errorText}>{urlError}</Text>}

            <Pressable
              style={[styles.submitDocButton, !docUrl && styles.disabled]}
              onPress={handleAddDoc}
              disabled={!docUrl || docMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Add document"
              accessibilityState={{ disabled: !docUrl || docMutation.isPending, busy: docMutation.isPending }}
            >
              {docMutation.isPending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Icon name="plus" size={14} color={colors.white} />
                  <Text style={styles.submitDocButtonText}>Add document</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, gap: spacing.md },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  boxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  propertyBox: { backgroundColor: colors.slate50, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.slate100 },
  propertyBoxLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  propertyBoxTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
  verifiedBox: { backgroundColor: colors.success50, borderWidth: 1, borderColor: '#BBF7D0', borderRadius: radius.md, padding: spacing.md },
  verifiedTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: '#166534' },
  verifiedBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: '#16A34A', marginTop: 2 },
  rejectedBox: { backgroundColor: colors.danger50, borderWidth: 1, borderColor: '#FECACA', borderRadius: radius.md, padding: spacing.md },
  rejectedTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: '#B91C1C' },
  rejectedBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: '#DC2626', marginTop: 2 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.sm },
  docType: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700, flexShrink: 0 },
  docUrl: { fontFamily: fonts.body, fontSize: 11, color: colors.brand600, flex: 1 },
  darkButton: { minHeight: 44, flexDirection: 'row', gap: 6, backgroundColor: colors.black, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', justifyContent: 'center' },
  darkButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  whyBox: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  whyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand900 },
  whyItem: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand700 },
  addDocForm: { borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: spacing.md, gap: spacing.sm },
  fieldLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginBottom: 4 },
  addressInput: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800, minHeight: 44, textAlignVertical: 'top' },
  fieldHint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 4 },
  // The address-comparison notes. Amber only for the pincode contradiction —
  // the one accusation the comparison is allowed to make.
  matchWarnBox: { backgroundColor: colors.warning50, borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.md, padding: spacing.md },
  matchWarnTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.warning700 },
  matchWarnText: { fontFamily: fonts.body, fontSize: 11, color: colors.warning700, marginTop: 2 },
  matchNote: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
  addDocHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.slate200 },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate600 },
  chipTextActive: { color: colors.white },
  input: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  inputError: { borderColor: colors.danger },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.danger },
  submitDocButton: { flexDirection: 'row', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', justifyContent: 'center' },
  submitDocButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  disabled: { opacity: 0.5 },
})
