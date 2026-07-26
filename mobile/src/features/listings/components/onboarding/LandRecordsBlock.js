import { View, Text, TextInput, Switch, StyleSheet } from 'react-native'
import Dropdown from '@components/common/Dropdown'
import Icon from '@components/common/Icon'
import { landRecordsFor, CONVERSION_OPTIONS, EC_YEAR_OPTIONS } from '@config/landRecords'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// LAND only, and on the LOCATION step rather than step 1 — deliberately, twice
// over. A survey number IS location information: it is how the state identifies
// this exact piece of ground. And the labels can only be written once the city
// is known, because the record is called something different in each state
// (config/landRecords.js explains which and why).
//
// Mirror of web's LandRecordsBlock.jsx.
export default function LandRecordsBlock({ draft, setDraft }) {
  const city = draft.location.city
  const records = landRecordsFor(city)
  const f = draft.fields
  const set = (key, value) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))

  if (!city) {
    return (
      <View style={styles.muted}>
        <Text style={styles.mutedText}>
          Pick a city above and we&apos;ll ask for the right land record — patta, khata, 7/12 and
          porcha are all different documents, and we&apos;d rather ask by name.
        </Text>
      </View>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text style={styles.heading}>Land records</Text>
        <Text style={styles.sub}>
          What a buyer&apos;s lawyer will ask for first. All optional — say &ldquo;not available
          yet&rdquo; rather than guessing.
        </Text>
      </View>

      <View style={styles.privacyNote}>
        <Icon name="shieldCheck" size={16} color={colors.slate500} />
        <Text style={styles.privacyText}>
          Survey and record <Text style={styles.strong}>numbers never appear on your public
          listing</Text> — only our verification team sees them. Buyers see the record type, which
          is what tells them whether a bank will lend.
        </Text>
      </View>

      <View>
        <Text style={styles.label}>Survey number</Text>
        <TextInput
          style={styles.input}
          value={f.surveyNumber ?? ''}
          onChangeText={(v) => set('surveyNumber', v)}
          placeholder="Sy. No. 12/3B"
          placeholderTextColor={colors.slate500}
          accessibilityLabel="Survey number"
        />
      </View>

      <View>
        <Text style={styles.label}>Subdivision (optional)</Text>
        <TextInput
          style={styles.input}
          value={f.subdivisionNumber ?? ''}
          onChangeText={(v) => set('subdivisionNumber', v)}
          placeholder="2A"
          placeholderTextColor={colors.slate500}
          accessibilityLabel="Subdivision number"
        />
      </View>

      <View>
        <Text style={styles.label}>{records.typeLabel}</Text>
        <Dropdown
          label={records.typeLabel}
          value={f.landRecordType}
          onChange={(v) => set('landRecordType', v)}
          options={records.options}
          placeholder="Select…"
        />
      </View>

      <View>
        <Text style={styles.label}>{records.numberLabel}</Text>
        <TextInput
          style={styles.input}
          value={f.landRecordNumber ?? ''}
          onChangeText={(v) => set('landRecordNumber', v)}
          placeholder={records.numberPlaceholder}
          placeholderTextColor={colors.slate500}
          accessibilityLabel={records.numberLabel}
        />
      </View>

      <View>
        <Text style={styles.label}>Land use</Text>
        <Dropdown
          label="Land use"
          value={f.conversionStatus}
          onChange={(v) => set('conversionStatus', v)}
          options={CONVERSION_OPTIONS}
          placeholder="Select…"
        />
        <Text style={styles.hint}>{records.conversionHint}</Text>
      </View>

      <View>
        <Text style={styles.label}>Government guideline value (per unit)</Text>
        <TextInput
          style={styles.input}
          value={f.guidelineValue ?? ''}
          onChangeText={(v) => set('guidelineValue', v.replace(/\D/g, ''))}
          placeholder="3200"
          placeholderTextColor={colors.slate500}
          keyboardType="numeric"
          accessibilityLabel="Guideline value"
        />
        <Text style={styles.hint}>The circle rate, not your asking price</Text>
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Encumbrance certificate on hand</Text>
        <Switch
          value={!!f.ecAvailable}
          onValueChange={(v) => set('ecAvailable', v)}
          trackColor={{ true: colors.brand600, false: colors.slate200 }}
          accessibilityLabel="Encumbrance certificate on hand"
        />
      </View>

      {!!f.ecAvailable && (
        <View>
          <Text style={styles.label}>Years covered</Text>
          <Dropdown
            label="Years covered"
            value={f.ecYears}
            onChange={(v) => set('ecYears', v)}
            options={EC_YEAR_OPTIONS}
            placeholder="Select…"
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, marginTop: 4, lineHeight: 18 },
  muted: { backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md },
  mutedText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, lineHeight: 18 },
  privacyNote: {
    flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start',
    backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md,
  },
  privacyText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, lineHeight: 18 },
  strong: { fontFamily: fonts.bodySemiBold, color: colors.slate800 },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700, marginBottom: spacing.xs },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 4, lineHeight: 16 },
  input: {
    minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
    minHeight: 52, backgroundColor: colors.slate50, borderRadius: radius.lg, paddingHorizontal: spacing.md,
  },
  toggleLabel: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
})
