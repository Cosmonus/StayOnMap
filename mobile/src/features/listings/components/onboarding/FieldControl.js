import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native'
import Dropdown from '@components/common/Dropdown'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// `seg` renders as a DROPDOWN, not a row of pills (changed 2026-07-26) —
// mirrors web's FieldControl.jsx. Multi-select stays chips (the amenity grid on
// step 4): that's a different question and a different control.
//
// Mirrors OnboardingWizard.js's NUMERIC_FIELD_KEYS — used here only to pick
// a numeric keyboard, not for payload coercion (that stays the single
// source of truth in OnboardingWizard.js).
const NUMERIC_KEYS = new Set([
  'bhk', 'sharing', 'bathrooms', 'floor', 'totalFloors', 'area', 'extent', 'roadWidth',
  'carpetArea', 'frontage', 'totalBeds', 'availableBeds', 'noticePeriodDays', 'maxGuests', 'beds',
])

// The config carries option tuples ([value, label]); DESCRIBE carries a third
// hint element, which Dropdown renders as a muted second line in its sheet.
export function toSelectOptions(opts) {
  return opts.map(([value, label, hint]) => ({ value, label, hint }))
}

function Count({ value, onChange, label }) {
  const n = value ?? 0
  return (
    <View style={styles.countRow}>
      <Pressable
        onPress={() => onChange(Math.max(0, n - 1))}
        disabled={n <= 0}
        style={[styles.countButton, n <= 0 && styles.countButtonDisabled]}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        accessibilityState={{ disabled: n <= 0 }}
      >
        <Text style={styles.countButtonText}>–</Text>
      </Pressable>
      <Text style={styles.countValue}>{n}</Text>
      <Pressable
        onPress={() => onChange(n + 1)}
        style={styles.countButton}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
      >
        <Text style={styles.countButtonText}>+</Text>
      </Pressable>
    </View>
  )
}

function Txt({ value, onChange, ph, suf, numeric }) {
  return (
    <View style={styles.txtWrap}>
      <TextInput
        style={[styles.txtInput, suf && { paddingRight: 44 }]}
        value={value != null ? String(value) : ''}
        onChangeText={onChange}
        placeholder={ph}
        placeholderTextColor={colors.slate500}
        keyboardType={numeric ? 'numeric' : 'default'}
      />
      {!!suf && (
        <View style={styles.txtSuffixWrap} pointerEvents="none">
          <Text style={styles.txtSuffix}>{suf}</Text>
        </View>
      )}
    </View>
  )
}

export default function FieldControl({ field: f, values, onChange }) {
  if (f.t === 'two') {
    const [aKey, aLabel, aPh] = f.a
    const [bKey, bLabel, bPh] = f.b
    return (
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{f.label}</Text>
        <View style={styles.twoRow}>
          <View style={styles.twoCol}>
            <Text style={styles.subLabel}>{aLabel}</Text>
            <Txt value={values[aKey]} onChange={(v) => onChange(aKey, v)} ph={aPh} numeric={NUMERIC_KEYS.has(aKey)} />
          </View>
          <View style={styles.twoCol}>
            <Text style={styles.subLabel}>{bLabel}</Text>
            <Txt value={values[bKey]} onChange={(v) => onChange(bKey, v)} ph={bPh} numeric={NUMERIC_KEYS.has(bKey)} />
          </View>
        </View>
      </View>
    )
  }

  const body =
    f.t === 'seg' ? <Dropdown label={f.label} value={values[f.field]} onChange={(v) => onChange(f.field, v)} options={toSelectOptions(f.opts)} placeholder="Select…" /> :
    f.t === 'count' ? <Count value={values[f.field]} onChange={(v) => onChange(f.field, v)} label={f.label} /> :
    f.t === 'txt' ? <Txt value={values[f.field]} onChange={(v) => onChange(f.field, v)} ph={f.ph} suf={f.suf} numeric={NUMERIC_KEYS.has(f.field)} /> :
    null

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{f.label}</Text>
      {body}
    </View>
  )
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: spacing.lg },
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginBottom: spacing.sm },
  subLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginBottom: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  countButton: { width: 40, height: 40, borderRadius: radius.full, borderWidth: 1, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  countButtonDisabled: { opacity: 0.4 },
  countButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate700 },
  countValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.slate800, width: 28, textAlign: 'center' },
  txtWrap: { position: 'relative' },
  txtInput: { borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate800 },
  txtSuffixWrap: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
  txtSuffix: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500 },
  twoRow: { flexDirection: 'row', gap: spacing.md },
  twoCol: { flex: 1 },
})
