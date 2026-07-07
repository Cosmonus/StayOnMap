// Renders the entire filter body from config/filters.js — sections and
// controls are generated from the schema, nothing here is filter-specific.
import { View, StyleSheet } from 'react-native'
import { visibleSections, visibleRows, countSectionActive, clearSectionPatch } from '@config/filters'
import { AmenityIcon } from '@components/common/AmenityIcon'
import { colors } from '@theme/colors'
import { spacing } from '@theme/spacing'
import FilterSection from './FilterSection'
import ChipGroup from './ChipGroup'
import RangeControl from './RangeControl'
import ToggleRow from './ToggleRow'

function Row({ row, draft, patch }) {
  switch (row.kind) {
    case 'range':
      return (
        <RangeControl
          label={row.label}
          unit={row.unit}
          chips={row.chips}
          min={draft[row.idMin]}
          max={draft[row.idMax]}
          onChange={({ min, max }) => patch({ [row.idMin]: min, [row.idMax]: max })}
        />
      )
    case 'chips':
      return (
        <ChipGroup
          label={row.label}
          options={row.options}
          single={row.single}
          searchable={row.searchable}
          renderIcon={row.withIcons
            ? (value, active) => <AmenityIcon name={value} size={13} color={active ? colors.white : colors.slate400} />
            : undefined}
          value={draft[row.id]}
          onChange={(v) => patch({ [row.id]: v })}
        />
      )
    case 'toggles':
      return (
        <View style={styles.toggles}>
          {row.items.map((item) => (
            <ToggleRow
              key={item.id}
              label={item.label}
              hint={item.hint}
              checked={!!draft[item.id]}
              onChange={(v) => patch({ [item.id]: v })}
            />
          ))}
        </View>
      )
    default:
      return null
  }
}

export default function DynamicFilterRenderer({ draft, patch }) {
  const selectedTypes = draft.types ?? []
  const sections = visibleSections(selectedTypes)

  return (
    <View style={styles.list}>
      {sections.map((section) => (
        <FilterSection
          key={section.id}
          label={section.label}
          defaultOpen={section.defaultOpen || countSectionActive(section, draft) > 0}
          activeCount={countSectionActive(section, draft)}
          onClear={() => patch(clearSectionPatch(section, selectedTypes))}
        >
          {visibleRows(section, selectedTypes).map((row, i) => (
            <Row key={`${section.id}-${row.id ?? row.idMin ?? row.kind}-${i}`} row={row} draft={draft} patch={patch} />
          ))}
        </FilterSection>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm + 4, paddingBottom: spacing.xs },
  toggles: { gap: 2 },
})
