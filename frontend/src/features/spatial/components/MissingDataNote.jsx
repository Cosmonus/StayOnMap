// What we don't know about this place.
//
// Rendered inline, never behind an expander. "We don't know X" is information
// a renter can act on, and hiding it is how a page starts reading as more
// certain than it is. This component exists so that omission takes a
// deliberate code change rather than happening by default.
export default function MissingDataNote({ missing }) {
  if (!missing?.length) return null

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        What we don&apos;t know
      </p>
      <ul className="space-y-1">
        {missing.map((note, i) => (
          <li key={i} className="text-[11px] text-slate-500 leading-snug flex gap-1.5">
            <span aria-hidden="true" className="text-slate-300 shrink-0">·</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
