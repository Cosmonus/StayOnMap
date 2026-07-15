// Single labeled field bound to one filter id — mirrors web's FieldRow.jsx.
// `number` renders a plain numeric input; `date` renders a pressable field
// that opens a month-grid DatePickerSheet (RN has no native date input) and
// stores an ISO yyyy-mm-dd string, wire-compatible with web.
import { useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import DatePickerSheet from './DatePickerSheet'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FieldRow({ label, type = 'number', unit, placeholder, value, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false)

  if (type === 'number') {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.field}>
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
      </View>
    )
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateGroup}>
        <Pressable
          style={styles.field}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={value ? `${label}: ${formatDate(value)}. Change date` : `${label}: choose a date`}
        >
          <Icon name="calendar" size={14} color={colors.slate400} />
          <Text style={[styles.dateText, !value && styles.datePlaceholder]} numberOfLines={1}>
            {value ? formatDate(value) : placeholder || 'Any date'}
          </Text>
        </Pressable>
        {!!value && (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={12}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label} date`}
          >
            <Icon name="close" size={14} color={colors.slate400} />
          </Pressable>
        )}
      </View>
      <DatePickerSheet
        visible={pickerOpen}
        title={label}
        value={value}
        onSelect={onChange}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  label: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm - 2,
    minHeight: 44, width: 160,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md, paddingHorizontal: spacing.sm + 2,
  },
  input: { flex: 1, paddingVertical: 9, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  prefix: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  suffix: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  dateGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  datePlaceholder: { color: colors.slate400 },
  clearButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.slate100 },
})
