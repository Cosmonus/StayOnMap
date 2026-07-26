import Modal from '@components/common/Modal'
import FactRow from './FactRow'
import ConfidenceMeter from './ConfidenceMeter'
import MissingDataNote from './MissingDataNote'
import SourcesFooter from './SourcesFooter'
import PoiListView from './PoiListView'
import { MODULE_META } from '../meta'

// The full report for one module — every measurement, how sure we are, and
// what we couldn't find out.
//
// Generic like the card: it renders whatever the envelope carries and knows
// nothing about metro stations or PM2.5, so a new backend module gets its
// report for free.
//
// `sheet` makes this a swipe-to-dismiss bottom sheet under md and a centred
// dialog above it — the reports are long, and a centred modal on a phone puts
// the interesting part behind a scroll inside a scroll.
export default function ModuleDetailModal({ envelope, isOpen, onClose, coords }) {
  const meta = MODULE_META[envelope.key] ?? { title: envelope.key }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={meta.title} size="2xl" sheet>
      {/* The question this module answers. It sits here rather than on the
          card, where it restated the title while the answer sat directly
          beneath it — here there's room for the framing. */}
      {meta.prompt && <p className="mb-3 text-xs text-slate-500">{meta.prompt}</p>}

      {envelope.assessment && (
        <div className="mb-1">
          <p className="text-sm font-bold text-slate-800">{envelope.assessment.label}</p>
          {/* Cut from the card as duplication of the measurements below; it
              belongs here, where it reads as the summary of them. */}
          {envelope.assessment.detail && (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{envelope.assessment.detail}</p>
          )}
        </div>
      )}

      <ConfidenceMeter confidence={envelope.confidence} />

      {envelope.facts.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Measurements
          </p>
          <div className="rounded-xl border border-slate-100 px-3.5">
            {envelope.facts.map((f) => <FactRow key={f.key} fact={f} />)}
          </div>
        </div>
      )}

      {/* The named places behind the counts above — pick a category, search
          it, get directions. Renders nothing for modules whose facts aren't
          places (environment) or when coords weren't provided. */}
      {coords && <PoiListView moduleKey={envelope.key} lat={coords.lat} lng={coords.lng} />}

      {/* Always rendered, never behind a further expander — see MissingDataNote. */}
      <MissingDataNote missing={envelope.missing} />
      <SourcesFooter sources={envelope.sources} computedAt={envelope.computedAt} />
    </Modal>
  )
}
