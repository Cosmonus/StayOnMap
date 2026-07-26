
// The frame every step renders inside: who you are, where you are in the
// flow, and that nothing is being lost. Kept separate from the steps
// themselves so a step is only ever its own questions.

export function WizardHeader({ title, savedAt, onExit }) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-4 px-4 md:px-8 py-4 bg-white border-b border-slate-100">
      {/* No wordmark here — the app Header is still mounted on /list, and two
          logos stacked reads as a broken page. */}
      <p className="text-base font-bold text-slate-900 truncate min-w-0">{title}</p>
      <div className="flex items-center gap-4 shrink-0">
        {savedAt && (
          <span className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-600" aria-hidden="true" />
            Saved just now
          </span>
        )}
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
        >
          Save &amp; exit
        </button>
      </div>
    </div>
  )
}

export function WizardFooter({ note, backLabel, onBack, nextLabel, onNext, nextDisabled, primary }) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-4 px-4 md:px-8 py-4 border-t border-slate-100 bg-white">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] px-3 py-3 -ml-3 rounded-xl text-sm font-bold text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors"
      >
        {backLabel}
      </button>
      {note && <p className="hidden md:block text-sm text-slate-500 text-center truncate">{note}</p>}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={`min-h-[44px] px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          primary ? 'bg-[#111111] hover:bg-[#2a2a2a]' : 'bg-brand-600 hover:bg-brand-700'
        }`}
      >
        {nextLabel}
      </button>
    </div>
  )
}

// Every step opens the same way: the question, then one line of why it
// matters. Nothing on a step is a surprise by the time you reach the fields.
export function StepHead({ title, sub }) {
  return (
    <div className="mb-8">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight">{title}</h1>
      {sub && <p className="text-base text-slate-600 leading-relaxed mt-3 max-w-2xl">{sub}</p>}
    </div>
  )
}
