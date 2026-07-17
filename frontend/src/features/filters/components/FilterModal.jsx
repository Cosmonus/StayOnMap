// The public map's filter modal — wires the global stores to FilterSheet,
// which is the shared UI (the admin panel renders the same sheet with its own
// state and config superset). Applying only changes which pins the next server
// fetch returns; the map itself never moves or reloads.
import { useUiStore } from '@store/uiStore'
import { useFilterStore } from '@store/filterStore'
import FilterSheet from './FilterSheet'

export default function FilterModal() {
  const isOpen = useUiStore((s) => s.filterModalOpen)
  const close = useUiStore((s) => s.closeFilterModal)
  const filters = useFilterStore((s) => s.filters)
  const setFilters = useFilterStore((s) => s.setFilters)

  return (
    <FilterSheet
      isOpen={isOpen}
      onClose={close}
      value={filters}
      onApply={setFilters}
    />
  )
}
