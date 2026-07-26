import { useState } from 'react'
import Toggle from '@components/common/Toggle'
import { FEATURES, FEATURES_VISIBLE, RULES, TITLE_HINTS, DESC_PROMPTS } from '../../../config/onboarding.js'
import { StepHead } from '../WizardChrome'
import { FieldLabel, Txt } from '../FieldControl'
import TimeSelect from '@components/common/TimeSelect'

// Step 4 — amenities, house rules, and the words a renter reads, on one
// screen. They were three pages; they are all answers to "what is it like",
// and the title reads better when the amenities are still on screen.

function AmenityChips({ categoryKey, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const f = FEATURES[categoryKey]
  const hidden = f.opts.length - FEATURES_VISIBLE
  const shown = expanded ? f.opts : f.opts.slice(0, FEATURES_VISIBLE)

  return (
    <div>
      <FieldLabel>{f.label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {shown.map((name) => {
          const on = selected.includes(name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => onToggle(name)}
              aria-pressed={on}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                on ? 'bg-brand-50 text-brand-700 border-brand-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              {on && <span aria-hidden="true">✓ </span>}{name}
            </button>
          )
        })}
        {hidden > 0 && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="px-3 py-2 text-sm font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-full"
          >
            + {hidden} more
          </button>
        )}
      </div>
    </div>
  )
}

// Renters filter on exactly these, so an unanswered rule is a listing that
// never appears in a "pets allowed" search. Hidden entirely for land and
// commercial, which have no such rules.
function HouseRules({ categoryKey, answers, onSet }) {
  const rules = RULES[categoryKey] ?? []
  if (rules.length === 0) return null

  return (
    <div>
      <FieldLabel>House rules</FieldLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 max-w-2xl">
        {rules.map((r) =>
          r.t === 'time' ? (
            <div key={r.k} className="py-3">
              {/* A picker, not a text box: "10", "10 am" and "morning" all
                  typed fine here and none of them is a time. */}
              <TimeSelect value={answers[r.k]} onChange={(v) => onSet(r.k, v)} placeholder="No curfew" allowNone />
              <p className="text-xs text-slate-500 mt-1.5">{r.label} — {r.hint}</p>
            </div>
          ) : (
            <div key={r.k} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100">
              <span className="text-sm text-slate-700">{r.label}</span>
              <Toggle checked={!!answers[r.k]} onChange={(v) => onSet(r.k, v)} />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default function FeaturesStep({ categoryKey, draft, setDraft }) {
  const hint = TITLE_HINTS[categoryKey]

  function toggleAmenity(name) {
    setDraft((d) => ({
      ...d,
      amenityNames: d.amenityNames.includes(name)
        ? d.amenityNames.filter((n) => n !== name)
        : [...d.amenityNames, name],
    }))
  }
  const setRule = (k, v) => setDraft((d) => ({ ...d, rules: { ...d.rules, [k]: v } }))

  return (
    <div className="space-y-8">
      <StepHead
        title="Features and the words renters read"
        sub="We have pre-written a title from what you have told us. Change it if you can do better."
      />

      <AmenityChips categoryKey={categoryKey} selected={draft.amenityNames} onToggle={toggleAmenity} />

      <HouseRules categoryKey={categoryKey} answers={draft.rules ?? {}} onSet={setRule} />

      <div>
        <FieldLabel>Listing title</FieldLabel>
        <Txt
          value={draft.title}
          onChange={(v) => setDraft((d) => ({ ...d, title: v.slice(0, 100) }))}
          ph={hint.placeholder}
          label="Listing title"
        />
        <p className="text-xs text-slate-500 mt-1.5">
          {draft.titlePrefilled ? 'Pre-filled from type, size and locality · ' : `e.g. “${hint.example}” · `}
          {draft.title.length} of 100 characters
        </p>
      </div>

      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value.slice(0, 2000) }))}
          rows={5}
          placeholder="Describe the space, the light, the neighbourhood…"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500 resize-none leading-relaxed"
        />
        <ul className="mt-2 space-y-1">
          {DESC_PROMPTS[categoryKey].map((p) => (
            <li key={p} className="text-xs text-slate-500">· {p}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
