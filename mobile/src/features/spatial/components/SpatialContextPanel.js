import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import ModuleCard from './ModuleCard'
import ModuleDetailSheet from './ModuleDetailSheet'
import SummaryStrip from './SummaryStrip'

// Spatial intelligence for a location — RN mirror of web's SpatialContextPanel.
//
// The panel is a thin mapper: the backend decides which modules exist (already
// filtered to this listing's property type) and what each says. Adding a
// module never touches this file. `context` comes joined onto the property
// payload (property.spatialContext) — no extra request.
//
// One structural difference from web: the detail sheet's open state lives
// HERE, not per-card, so the summary-strip chips and the cards share one
// sheet. Cards stack in a single column — this is a phone.
const ORDER = [
  'locality',
  'mobility',
  'lifestyle', 'commerce', 'pgContext', 'stayContext', 'landContext',
  'infrastructure', 'environment', 'terrain', 'costOfLiving',
]

/**
 * Order the modules the backend sent, WITHOUT dropping unknown keys.
 * Mirror of web's inRenderOrder — see that file for why: the previous
 * `ORDER.map(...)` silently discarded any module not in the list, so a new
 * backend module rendered nowhere at all.
 */
function inRenderOrder(modules) {
  const known = ORDER.filter((key) => modules[key])
  const unknown = Object.keys(modules).filter((key) => !ORDER.includes(key))
  return [...known, ...unknown].map((key) => modules[key])
}

export default function SpatialContextPanel({ context, coords, children }) {
  const [openEnvelope, setOpenEnvelope] = useState(null)
  const modules = context?.modules ?? {}

  const envelopes = inRenderOrder(modules)
    .filter(Boolean)
    // Stored as raw JSON, so an older module shape can reach here without
    // `facts`. Skipping it loses a card; indexing it throws mid-render.
    .filter((e) => Array.isArray(e.facts))
    // A module with nothing to say AND nothing to explain is chrome. One that
    // knows why it's silent is kept — that's information.
    .filter((e) => e.facts.length > 0 || e.missing?.length > 0)

  // Four outcomes, not two — mirror of web's SpatialContextPanel, see there for
  // the reasoning. `pending` is the older boolean, still read so payloads from
  // before `status` shipped keep working.
  const status = context?.status
    ?? (context?.pending === true ? 'pending' : context ? 'ready' : null)

  const pending = status === 'pending'
  const failed = status === 'failed'
  const nothingMapped = status === 'ready' && envelopes.length === 0

  const hasPanel = envelopes.length > 0 || pending || failed || nothingMapped

  if (!hasPanel) return children ?? null

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Spatial intelligence</Text>
        <View style={styles.beta}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </View>
      <Text style={styles.hint}>
        What the area around this address is actually like — tap any card for
        the full report, where each figure came from, and what we don&apos;t know.
      </Text>

      {pending && (
        <View style={styles.pendingCard}>
          <View style={styles.pendingRow}>
            <View style={styles.pendingDot} />
            <Text style={styles.pendingTitle}>Working out what&apos;s around this address</Text>
          </View>
          <Text style={styles.pendingBody}>
            We haven&apos;t described this neighbourhood yet. It usually takes a
            few seconds — pull to refresh shortly and it&apos;ll be here.
          </Text>
        </View>
      )}

      {failed && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>We couldn&apos;t load the area report</Text>
          <Text style={styles.pendingBody}>
            Something went wrong on our side — this isn&apos;t a comment on the
            neighbourhood. Pull to refresh to try again.
          </Text>
        </View>
      )}

      {nothingMapped && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>
            We don&apos;t have enough mapped data around this address yet
          </Text>
          <Text style={styles.pendingBody}>
            Our area reports are built from open map data, and coverage is
            thinner in some neighbourhoods than others. That says nothing about
            what&apos;s actually here — only about what has been mapped so far.
          </Text>
        </View>
      )}

      {envelopes.length > 0 && (
        <SummaryStrip envelopes={envelopes} onOpenModule={setOpenEnvelope} />
      )}

      {envelopes.length > 0 && (
        <View style={styles.cards}>
          {envelopes.map((e) => (
            <ModuleCard key={e.key} envelope={e} onOpen={setOpenEnvelope} />
          ))}
        </View>
      )}

      <ModuleDetailSheet
        envelope={openEnvelope}
        visible={openEnvelope != null}
        onClose={() => setOpenEnvelope(null)}
        coords={coords}
      />

      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  beta: { backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  betaText: { fontFamily: fonts.bodySemiBold, fontSize: 9, letterSpacing: 1, color: colors.brand700 },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 16, color: colors.slate400, marginTop: 2 },
  pendingCard: {
    marginTop: spacing.sm + 2, backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate100, padding: spacing.md,
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand500 },
  pendingTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  pendingBody: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.slate400, marginTop: 6 },
  cards: { marginTop: spacing.sm + 2, gap: spacing.sm + 2 },
})
