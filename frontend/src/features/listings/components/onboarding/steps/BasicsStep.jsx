import Select from '@components/common/Select'
import { CATEGORIES, DESCRIBE, FIELDS } from '../../../config/onboarding.js'
import FieldControl, { fieldSpan, FieldLabel, toSelectOptions } from '../FieldControl'
import { StepHead } from '../WizardChrome'

// Step 1 — the category, then the questions that category implies. Picking a
// type and answering its first question used to be three separate pages; they
// are one decision, so they are one screen.

function CategoryCard({ ck, cat, active, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(ck)}
      aria-pressed={active}
      className={`text-left p-4 rounded-2xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        active ? 'bg-brand-50 border-brand-600' : 'bg-white border-slate-200 hover:border-slate-400'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-base font-bold leading-snug ${active ? 'text-brand-700' : 'text-slate-900'}`}>{cat.label}</span>
        {cat.tier === 'biz' && (
          <span className="shrink-0 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            BUSINESS
          </span>
        )}
      </div>
      <span className="block text-sm text-slate-500 mt-1">{cat.long}</span>
    </button>
  )
}

export default function BasicsStep({ categoryKey, draft, setDraft, onPickCategory }) {
  const describe = categoryKey ? DESCRIBE[categoryKey] : null
  const setField = (key, value) => setDraft((d) => ({ ...d, fields: { ...d.fields, [key]: value } }))
  // No picker when editing: changing what KIND of property a live listing is
  // would rewrite every other answer on it, so that is a relist, not an edit.
  const canPickCategory = typeof onPickCategory === 'function'

  return (
    <div>
      <StepHead
        title={canPickCategory ? 'What are you listing?' : `Your ${CATEGORIES[categoryKey]?.short.toLowerCase() ?? 'listing'}`}
        sub={canPickCategory
          ? 'Six categories, and the answer shapes every question after this one.'
          : 'The basics renters filter on. Type can’t change on a live listing — relist instead.'}
      />

      {canPickCategory && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(CATEGORIES).map(([ck, cat]) => (
            <CategoryCard key={ck} ck={ck} cat={cat} active={ck === categoryKey} onPick={onPickCategory} />
          ))}
        </div>
      )}

      {describe && (
        <>
          {canPickCategory && <hr className="my-8 border-slate-100" />}

          {/* The describe question is the first cell of the same grid as the
              specs, not a block of its own — it is one dropdown like the rest,
              and separating it cost a whole row of vertical space. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
            <div>
              <FieldLabel>{describe.q}</FieldLabel>
              <Select
                value={draft.fields[describe.k]}
                onChange={(v) => setField(describe.k, v)}
                options={toSelectOptions(describe.opts)}
                placeholder="Select…"
              />
            </div>
            {FIELDS[categoryKey].map((f) => (
              <div key={f.k} className={fieldSpan(f)}>
                <FieldControl field={f} values={draft.fields} onChange={setField} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
