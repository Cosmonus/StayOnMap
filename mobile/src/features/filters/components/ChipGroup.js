// Chip multi-select (or single-select) for one filter id. Long lists
// (searchable) get an inline search box that narrows the chips.
import { useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import Icon from '@components/common/Icon'
import FilterChip from './FilterChip'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function ChipGroup({ label, options, value, single = false, searchable = false, renderIcon, onChange }) {
  const [query, setQuery] = useState('')

  const selected = single ? value : (value ?? [])
  const shown = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(optionValue) {
    if (single) {
      onChange(selected === optionValue ? null : optionValue)
    } else {
      onChange(selected.includes(optionValue)
        ? selected.filter((v) => v !== optionValue)
        : [...selected, optionValue])
    }
  }

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      {searchable && (
        <View style={styles.searchWrap}>
          <Icon name="search" size={13} color={colors.slate500} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search amenities"
            placeholderTextColor={colors.slate500}
            style={styles.searchInput}
          />
        </View>
      )}
      <View style={styles.chips}>
        {shown.map((o) => {
          const active = single ? selected === o.value : selected.includes(o.value)
          return (
            <FilterChip
              key={String(o.value)}
              label={o.label}
              icon={renderIcon?.(o.value, active)}
              active={active}
              onPress={() => toggle(o.value)}
            />
          )
        })}
        {shown.length === 0 && <Text style={styles.empty}>No matches</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate700, marginBottom: spacing.sm },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2, marginBottom: spacing.sm + 2,
  },
  searchInput: { flex: 1, paddingVertical: 8, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate700 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
})
