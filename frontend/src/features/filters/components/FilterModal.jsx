// The map's filter modal — centered on desktop, bottom sheet on mobile.
// Edits a local DRAFT (with a live viewport result count); nothing hits the
// store — or the map — until Apply. The map itself never moves or reloads:
// applying only changes which pins the next server fetch returns.
import { useEffect, useState } from 'react'
import Modal from '@components/common/Modal'
import { useUiStore } from '@store/uiStore'
import { useFilterStore } from '@store/filterStore'
import { DEFAULT_FILTERS, SEARCH_KEYS, countActiveFilters, staleFilterPatch } from '@/config/filters'
import { useFilterCount } from '../hooks/useFilterCount'
import PropertyTypeSwitcher from './PropertyTypeSwitcher'
import DynamicFilterRenderer from './DynamicFilterRenderer'

export default function FilterModal() {
  const isOpen = useUiStore((s) => s.filterModalOpen)
  const close = useUiStore((s) => s.closeFilterModal)
  const setFilters = useFilterStore((s) => s.setFilters)

  const [draft, setDraft] = useState(DEFAULT_FILTERS)

  // Re-seed the draft from the store each time the modal opens
  useEffect(() => {
    if (isOpen) setDraft(useFilterStore.getState().filters)
  }, [isOpen])

  const { count, isFetching } = useFilterCount(draft, isOpen)
  const activeCount = countActiveFilters(draft)

  const patch = (p) => setDraft((d) => ({ ...d, ...p }))

  function handleReset() {
    setDraft((d) => ({
      ...DEFAULT_FILTERS,
      ...Object.fromEntries(SEARCH_KEYS.map((k) => [k, d[k]])),
    }))
  }

  function handleApply() {
    setFilters(draft)
    close()
  }

  const applyLabel = count === null
    ? 'Show results'
    : `Show ${count} ${count === 1 ? 'place' : 'places'}`

  return (
    <Modal isOpen={isOpen} onClose={close} title="Filters" size="2xl" sheet
      footer={
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleReset}
            disabled={activeCount === 0}
            className="text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900 disabled:text-slate-300 disabled:no-underline transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={`px-6 py-2.5 rounded-xl bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold transition-all active:scale-[0.98] ${isFetching ? 'opacity-80' : ''}`}
          >
            {applyLabel}
          </button>
        </div>
      }
    >
      <div className="mb-2">
        <p className="text-sm font-medium text-slate-700 mb-2.5">Property type</p>
        <PropertyTypeSwitcher
          selectedTypes={draft.types ?? []}
          onChange={(types) => patch({ types, ...staleFilterPatch(types) })}
        />
      </div>
      <DynamicFilterRenderer draft={draft} patch={patch} />
    </Modal>
  )
}
