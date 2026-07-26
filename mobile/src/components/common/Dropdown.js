import { useState } from 'react'
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Icon from './Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

/**
 * Props:
 *   label     – sheet title shown when open
 *   options   – [{ value, label, hint? }] — `hint` is a muted second line in
 *               the sheet, for choices that need a word of explanation to pick
 *               between ("Villa — premium standalone home")
 *   multiple  – if true, use `values`/`onChange(nextArray)`; otherwise `value`/`onChange(value)`
 *   value / values / onChange / placeholder
 */
export default function Dropdown({ label, value, values, multiple = false, options, onChange, placeholder = 'Any' }) {
  const [open, setOpen] = useState(false)

  const selectedValues = multiple ? (values ?? []) : [value]
  const selectedLabels = options.filter((o) => selectedValues.includes(o.value)).map((o) => o.label)
  const displayText = selectedLabels.length ? selectedLabels.join(', ') : placeholder

  function handlePick(optionValue) {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue]
      onChange(next)
    } else {
      onChange(optionValue)
      setOpen(false)
    }
  }

  return (
    <View>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}, ${displayText}`}
      >
        <Text style={[styles.triggerText, !selectedLabels.length && styles.placeholder]} numberOfLines={1}>
          {displayText}
        </Text>
        <Icon name="chevronDown" size={16} color={colors.slate500} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel={`Close ${label ?? placeholder} picker`}
              >
                <Icon name="close" size={18} color={colors.slate500} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const active = selectedValues.includes(item.value)
                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => handlePick(item.value)}
                    accessibilityRole={multiple ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: active }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                      {!!item.hint && <Text style={styles.optionHint}>{item.hint}</Text>}
                    </View>
                    {active && <Icon name="check" size={16} color={colors.brand600} />}
                  </Pressable>
                )
              }}
            />
            {multiple && (
              <View style={styles.doneRow}>
                <Pressable style={styles.doneButton} onPress={() => setOpen(false)} accessibilityRole="button">
                  <Text style={styles.doneButtonText}>Done</Text>
                </Pressable>
              </View>
            )}
            <SafeAreaView edges={['bottom']} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, backgroundColor: colors.white,
  },
  triggerText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate800 },
  placeholder: { color: colors.slate500 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '70%', ...shadows.sheet },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.slate100 },
  sheetTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48 },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.base, color: colors.slate700 },
  optionTextActive: { color: colors.brand700, fontFamily: fonts.bodySemiBold },
  optionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.slate100, marginHorizontal: spacing.lg },
  doneRow: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.slate100 },
  doneButton: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  doneButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
