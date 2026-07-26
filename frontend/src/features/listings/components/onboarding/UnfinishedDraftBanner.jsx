import { Info } from 'lucide-react'
import { STEPS, CATEGORIES, DESCRIBE, suggestTitle } from '../../config/onboarding.js'

// The other half of the wizard's autosave. Saving a half-finished listing is
// worth nothing if the owner can't find it again — before this, the draft sat
// in localStorage and the only way back to it was to start "Add listing" and
// notice it had restored itself.
//
// Says three things, in this order: that something is unfinished, WHICH one,
// and that nothing was lost. The last part is the point — an owner who thinks
// they lost their work starts over or gives up.
export default function UnfinishedDraftBanner({ draft, onResume, onStartFresh }) {
  if (!draft?.categoryKey) return null

  const { categoryKey, stepIdx = 0, draft: saved = {}, at } = draft
  const step = STEPS[stepIdx] ?? STEPS[0]

  // What to call it: the owner's own title if they got that far, otherwise the
  // one the wizard would have suggested, otherwise the category.
  const label = saved.title?.trim()
    || suggestTitle(categoryKey, { fields: saved.fields ?? {}, location: saved.location ?? {} })
    || CATEGORIES[categoryKey]?.label
    || 'a listing'

  const when = at
    ? new Date(at).toLocaleDateString('en-IN', { weekday: 'long' })
    : null

  // Step 1's label is "Type & basics"; mid-flow the plain noun reads better in
  // a sentence ("you stopped at photos"), so lowercase the last word.
  const where = step.label.toLowerCase()

  return (
    <div className="flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row p-4 rounded-2xl bg-amber-50 border border-amber-100">
      <div className="flex items-start gap-3 min-w-0">
        <Info size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="text-sm text-amber-900 leading-relaxed">
          <strong className="font-bold">You have an unfinished listing.</strong>{' '}
          <span className="text-amber-800">
            {label} — you stopped at {where}{when ? ` on ${when}` : ''}. Nothing was lost.
          </span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Only offered where a choice is actually pending (the add flow). On the
            listings page this is a reminder, not a fork — the row's own Delete
            handles discarding. */}
        {onStartFresh && (
          <button
            type="button"
            onClick={onStartFresh}
            className="min-h-[44px] px-4 py-3 rounded-xl border border-amber-300 bg-white text-amber-900 text-sm font-semibold hover:border-amber-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Start a new one
          </button>
        )}
        <button
          type="button"
          onClick={onResume}
          className="min-h-[44px] px-5 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Resume · step {step.n} of {STEPS.length}
        </button>
      </div>
    </div>
  )
}

// Exported for the page's subline, which counts the saved draft alongside the
// real ones — an unfinished listing IS a draft from the owner's point of view,
// even though the server has never seen it.
export function draftDescribeAnswered(draft) {
  const key = draft?.categoryKey
  if (!key) return false
  return draft?.draft?.fields?.[DESCRIBE[key].k] !== undefined
}
