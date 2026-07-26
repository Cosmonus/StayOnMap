import { PHOTO_HINTS } from '../../../config/onboarding.js'
import PhotoBoard from '../PhotoBoard'
import { StepHead } from '../WizardChrome'

// Step 3 — alone, because photos decide whether anyone enquires and because
// it is the step most likely to be interrupted (the owner walks the property
// with their phone). Everything is uploaded and autosaved as it lands, so
// leaving mid-step costs nothing.
export default function PhotosStep({ categoryKey, draft, setDraft, onUploadingChange }) {
  return (
    <div>
      <StepHead
        title="Add photos"
        sub="The single biggest factor in whether anyone enquires. Five or more, landscape, daylight."
      />
      <p className="text-sm text-slate-500 mb-5">{PHOTO_HINTS[categoryKey]}</p>
      <PhotoBoard
        value={draft.images}
        onChange={(urls) => setDraft((d) => ({ ...d, images: urls }))}
        onUploadingChange={onUploadingChange}
      />
    </div>
  )
}
