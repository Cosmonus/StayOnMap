import { View, Text, Modal, Pressable, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { MODULE_META } from '../meta'
import FactRow from './FactRow'
import ConfidenceMeter from './ConfidenceMeter'
import MissingDataNote from './MissingDataNote'
import SourcesFooter from './SourcesFooter'
import PoiListView from './PoiListView'

// The full report for one module — every measurement, how sure we are, what we
// couldn't find out, and the named places behind the counts. RN mirror of
// web's ModuleDetailModal, as the house bottom-sheet (see MapFiltersSheet.js:
// RN <Modal> + onRequestClose so hardware back dismisses, per AGENTS.md §2).
//
// Generic like the card: it renders whatever the envelope carries and knows
// nothing about metro stations or PM2.5.
export default function ModuleDetailSheet({ envelope, visible, onClose, coords }) {
  if (!envelope) return null
  const meta = MODULE_META[envelope.key] ?? { title: envelope.key }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.heading}>{meta.title}</Text>
            <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close report">
              <X size={20} color={colors.slate500} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {!!meta.prompt && <Text style={styles.prompt}>{meta.prompt}</Text>}

            {envelope.assessment && (
              <View>
                <Text style={styles.assessLabel}>{envelope.assessment.label}</Text>
                {!!envelope.assessment.detail && (
                  <Text style={styles.assessDetail}>{envelope.assessment.detail}</Text>
                )}
              </View>
            )}

            <ConfidenceMeter confidence={envelope.confidence} />

            {envelope.facts.length > 0 && (
              <View style={styles.factsWrap}>
                <Text style={styles.factsHeading}>Measurements</Text>
                <View style={styles.factsCard}>
                  {envelope.facts.map((f, i) => (
                    <FactRow key={f.key} fact={f} isLast={i === envelope.facts.length - 1} />
                  ))}
                </View>
              </View>
            )}

            {coords && <PoiListView moduleKey={envelope.key} lat={coords.lat} lng={coords.lng} />}

            <MissingDataNote missing={envelope.missing} />
            <SourcesFooter sources={envelope.sources} computedAt={envelope.computedAt} />
            <View style={styles.bottomPad} />
          </ScrollView>
          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, maxHeight: '90%',
    ...shadows.sheet,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.slate200, marginTop: spacing.sm + 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md - 2 },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  prompt: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginBottom: spacing.sm + 2 },
  assessLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  assessDetail: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18, color: colors.slate500, marginTop: 4 },
  factsWrap: { marginTop: spacing.lg },
  factsHeading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  factsCard: { borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  bottomPad: { height: spacing.lg },
})
