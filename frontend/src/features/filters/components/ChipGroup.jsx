// Chip multi-select (or single-select) for one filter id. Long lists
// (searchable) get an inline search box that narrows the chips.
import { useState } from 'react'
import { Search } from 'lucide-react'
import FilterChip from './FilterChip'

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
    <div>
      {label && <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>}
      {searchable && (
        <div className="relative mb-2.5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search amenities"
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {shown.map((o) => (
          <FilterChip
            key={String(o.value)}
            label={o.label}
            icon={renderIcon?.(o.value)}
            active={single ? selected === o.value : selected.includes(o.value)}
            onClick={() => toggle(o.value)}
          />
        ))}
        {shown.length === 0 && <p className="text-sm text-slate-400">No matches</p>}
      </div>
    </div>
  )
}
