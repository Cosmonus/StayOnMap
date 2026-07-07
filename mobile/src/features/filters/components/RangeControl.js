// Min/max numeric pair with optional one-tap preset chips — same semantics
// as web's RangeControl; RN has no dual-thumb slider primitive so ranges are
// chips + inputs here (an intentional simplification, not a gap).
import { View, Text, TextInput, StyleSheet } from 'react-native'
import FilterChip from './FilterChip'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function NumberInput({ value, placeholder, unit, onChange }) {
  return (
    <View style={styles.inputWrap}>
      {unit === '₹' && <Text style={styles.prefix}>₹</Text>}
      <TextInput
        keyboardType="number-pad"
        value={value === null || value === undefined ? '' : String(value)}
        placeholder={placeholder}
        placeholderTextColor={colors.slate400}
        onChangeText={(t) => {
          const n = Number(t.replace(/[^\d]/g, ''))
          onChange(t === '' || !Number.isFinite(n) ? null : n)
        }}
        style={styles.input}
      />
      {unit && unit !== '₹' && <Text style={styles.suffix}>{unit}</Text>}
    </View>
  )
}

export default function RangeControl({ label, unit, min, max, chips, onChange }) {
  const chipActive = (c) => min === c.min && max === c.max

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {chips && (
        <View style={styles.chips}>
          {chips.map((c) => (
            <FilterChip
              key={c.label}
              label={c.label}
              active={chipActive(c)}
              onPress={() => onChange(chipActive(c) ? { min: null, max: null } : { min: c.min, max: c.max })}
            />
          ))}
        </View>
      )}
      <View style={styles.inputsRow}>
        <NumberInput value={min} placeholder="Min" unit={unit} onChange={(v) => onChange({ min: v, max })} />
        <Text style={styles.dash}>—</Text>
        <NumberInput value={max} placeholder="Max" unit={unit} onChange={(v) => onChange({ min, max: v })} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm + 2 },
  inputsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2,
  },
  input: { flex: 1, paddingVertical: 9, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  prefix: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, marginRight: 4 },
  suffix: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginLeft: 4 },
  dash: { color: colors.slate200 },
})
