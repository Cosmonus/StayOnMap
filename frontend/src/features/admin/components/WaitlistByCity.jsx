/**
 * Demand we turned away, by city — the answer to "which city do we open next".
 *
 * Extracted from AdminPage's WaitlistSection so it can be tested: the rollup is
 * computed server-side over EVERY entry, and the failure that matters is a
 * client that quietly re-derives it from whichever page of twenty is on screen.
 * That version renders identically and is wrong.
 */
export default function WaitlistByCity({ rows }) {
  if (!rows?.length) return null

  const max = Math.max(1, ...rows.map((r) => r.count))

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5">
      <h2 className="text-sm font-bold text-slate-900">Where they are waiting</h2>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">
        Signups from cities we haven&apos;t launched in, counted across every entry &mdash; not
        just this page. The top row is the strongest case for launching next.
      </p>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.city}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <span className="text-sm font-medium text-slate-800">{row.city}</span>
              <span className="text-xs text-slate-500 shrink-0">
                <span className="font-mono font-semibold text-slate-800">{row.count}</span>
                {row.lastSignup && (
                  <> &middot; latest {new Date(row.lastSignup).toLocaleDateString('en-IN')}</>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
