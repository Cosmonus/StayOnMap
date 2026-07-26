import { STEPS } from '../config/onboarding.js'
import BasicsStep from './onboarding/steps/BasicsStep'
import LocationStep from './onboarding/steps/LocationStep'
import PhotosStep from './onboarding/steps/PhotosStep'
import FeaturesStep from './onboarding/steps/FeaturesStep'
import PriceStep from './onboarding/steps/PriceStep'
import ReviewStep from './onboarding/steps/ReviewStep'

// ONE form, two jobs: adding a listing and editing one.
//
// They were separate components with separate field lists, and the difference
// cost more than the duplication: the edit form was type-BLIND — a `type`
// dropdown and nothing else — so on web you could not edit a plot's survey
// number, a PG's beds, a shop's frontage or anything else the wizard collects.
// Editing quietly offered a smaller product than adding.
//
// Now both render the same six type-aware panels behind the same tab bar. The
// only differences are the ones that genuinely exist:
//   create   all six tabs, Review last, Publish
//   edit     five tabs (nothing to review — it is already live), Save, and the
//            category is fixed, because a listing becoming a different KIND of
//            property is a relist, not an edit

const PANEL = {
  basics: BasicsStep,
  location: LocationStep,
  photos: PhotosStep,
  features: FeaturesStep,
  pricing: PriceStep,
  review: ReviewStep,
}

// Tab labels are shorter than the wizard's step labels — a tab bar is read at a
// glance, a step header is read as a sentence.
const TAB_LABEL = {
  basics: 'Basic info',
  location: 'Location',
  photos: 'Photos',
  features: 'Features',
  pricing: 'Price',
  review: 'Review',
}

export function tabsFor(mode) {
  return mode === 'edit' ? STEPS.filter((s) => s.k !== 'review') : STEPS
}

export default function ListingFormTabs({
  mode = 'create',
  categoryKey,
  draft,
  setDraft,
  activeTab,
  onTabChange,
  onPickCategory,
  missing = [],
  profile,
  onUploadingChange,
}) {
  const tabs = tabsFor(mode)
  const Panel = PANEL[activeTab] ?? BasicsStep
  // Which tabs still have something outstanding — the same list the review step
  // shows, surfaced on the tab bar so it's visible from anywhere rather than
  // only at the end.
  const incomplete = new Set(missing.map((m) => m.stepK))

  const panelProps = {
    categoryKey,
    draft,
    setDraft,
    // Only the create flow can choose a category; in edit mode BasicsStep
    // renders the questions without the picker.
    ...(activeTab === 'basics' ? { onPickCategory } : {}),
    ...(activeTab === 'photos' ? { onUploadingChange } : {}),
    ...(activeTab === 'review' ? { missing, profile, onJump: onTabChange } : {}),
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 -mx-1 px-1">
        {tabs.map((t) => {
          const active = t.k === activeTab
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => onTabChange(t.k)}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-t ${
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {TAB_LABEL[t.k]}
              {/* A dot, not a count: the number is on the review tab, and a
                  badge per tab turned the bar into a scoreboard. */}
              {incomplete.has(t.k) && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="incomplete" />
              )}
            </button>
          )
        })}
      </div>

      <div className="pt-8">
        {categoryKey ? <Panel {...panelProps} /> : <BasicsStep {...panelProps} />}
      </div>
    </div>
  )
}
