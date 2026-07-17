// Renders the entire filter body from config/filters.js — sections and
// controls are generated from the schema, nothing here is filter-specific.
// `sections`/`defs` default to the user config; the admin panel passes its own
// superset (config/adminFilters.js) to get the same UI plus status/riskLevel.
import { visibleSections, visibleRows, countSectionActive, clearSectionPatch, FILTER_SECTIONS, PARAM_DEFS } from '@/config/filters'
import { AmenityIcon } from '@components/common/AmenityIcon'
import FilterSection from './FilterSection'
import ChipGroup from './ChipGroup'
import RangeControl from './RangeControl'
import ToggleRow from './ToggleRow'
import FieldRow from './FieldRow'

function Row({ row, draft, patch }) {
  switch (row.kind) {
    case 'range':
      return (
        <RangeControl
          label={row.label}
          unit={row.unit}
          chips={row.chips}
          slider={row.slider}
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
          renderIcon={row.withIcons ? (value) => <AmenityIcon name={value} size={13} /> : undefined}
          value={draft[row.id]}
          onChange={(v) => patch({ [row.id]: v })}
        />
      )
    case 'toggles':
      return (
        <div className="flex flex-col gap-1">
          {row.items.map((item) => (
            <ToggleRow
              key={item.id}
              label={item.label}
              hint={item.hint}
              checked={!!draft[item.id]}
              onChange={(v) => patch({ [item.id]: v })}
            />
          ))}
        </div>
      )
    case 'number':
    case 'date':
      return (
        <FieldRow
          label={row.label}
          type={row.kind}
          unit={row.unit}
          placeholder={row.placeholder}
          value={draft[row.id]}
          onChange={(v) => patch({ [row.id]: v })}
        />
      )
    default:
      return null
  }
}

export default function DynamicFilterRenderer({ draft, patch, sectionConfig = FILTER_SECTIONS, defs = PARAM_DEFS }) {
  const selectedTypes = draft.types ?? []
  const sections = visibleSections(selectedTypes, sectionConfig)

  return (
    <div className="pb-1">
      {sections.map((section) => (
        <FilterSection
          key={section.id}
          label={section.label}
          defaultOpen={section.defaultOpen || countSectionActive(section, draft, defs) > 0}
          activeCount={countSectionActive(section, draft, defs)}
          onClear={() => patch(clearSectionPatch(section, selectedTypes, defs))}
        >
          {visibleRows(section, selectedTypes).map((row, i) => (
            <Row key={`${section.id}-${row.id ?? row.idMin ?? row.kind}-${i}`} row={row} draft={draft} patch={patch} />
          ))}
        </FilterSection>
      ))}
    </div>
  )
}
