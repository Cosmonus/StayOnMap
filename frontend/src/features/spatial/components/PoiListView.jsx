import { useMemo, useState } from 'react'
import { Search, Navigation, Clock } from 'lucide-react'
import usePoisNear from '../hooks/usePoisNear'
import { MODULE_POI_BROWSE, POI_CATEGORY_LABEL } from '../meta'

// The named places behind a module's counts — "which banks", not "how many".
//
// Interaction contract:
//   - Nothing is fetched until a category pill is chosen (opening the report
//     stays free), and each category is fetched at most once per session —
//     React Query caches it and every keystroke filters locally.
//   - Search is instant, case-insensitive, whitespace-tolerant, and matches
//     name AND brand/operator, so "icici" finds a branch whose name tag is
//     bare but whose brand is "ICICI Bank".
//   - Opening hours render only when OSM actually records them — absence of
//     an hours line means "not recorded", never a guess.

function formatDistance(m) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}

const normalize = (s) => (s ?? '').toLowerCase().trim()

export default function PoiListView({ moduleKey, lat, lng }) {
  const browse = MODULE_POI_BROWSE[moduleKey]
  const [category, setCategory] = useState(null)
  const [query, setQuery] = useState('')

  const { data, isLoading, isError, refetch } = usePoisNear({
    lat,
    lng,
    category,
    radius: browse?.radius,
    enabled: Boolean(browse && category),
  })

  const filtered = useMemo(() => {
    if (!data?.pois) return []
    const q = normalize(query)
    if (!q) return data.pois
    return data.pois.filter(
      (p) => normalize(p.name).includes(q) || normalize(p.brand).includes(q)
    )
  }, [data, query])

  if (!browse || lat == null || lng == null) return null

  return (
    <div className="mt-5">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Nearby places
      </p>

      {/* Category pills — the fetch trigger. aria-pressed carries the state
          for screen readers; the visual fill carries it for everyone else. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nearby place categories">
        {browse.categories.map((c) => {
          const active = c === category
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => { setCategory(active ? null : c); setQuery('') }}
              className={`min-h-[32px] rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'
              }`}
            >
              {POI_CATEGORY_LABEL[c] ?? c}
            </button>
          )
        })}
      </div>

      {category && (
        <div className="mt-3">
          {isLoading && (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-slate-100 p-4 text-center">
              <p className="text-xs text-slate-500">Couldn&apos;t load nearby places.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 text-xs font-semibold text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
              >
                Try again
              </button>
            </div>
          )}

          {data && !data.available && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-snug text-slate-500">
              Local place data hasn&apos;t been loaded for this city yet — this
              is &ldquo;not loaded&rdquo;, not &ldquo;nothing here&rdquo;.
            </p>
          )}

          {data?.available && (
            <>
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${(POI_CATEGORY_LABEL[category] ?? category).toLowerCase()}…`}
                  aria-label={`Search nearby ${POI_CATEGORY_LABEL[category] ?? category}`}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-500 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
              </label>

              {filtered.length === 0 && (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-snug text-slate-500">
                  {query
                    ? `Nothing matching “${query.trim()}” nearby.`
                    : `None mapped within ${formatDistance(data.radiusM)} — in a lightly-mapped area that can mean unmapped rather than absent.`}
                </p>
              )}

              {filtered.length > 0 && (
                <ul className="mt-2 max-h-72 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-100">
                  {filtered.map((p) => (
                    <li key={`${p.lat},${p.lng},${p.name}`} className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {p.name ?? `Unnamed ${(POI_CATEGORY_LABEL[p.category] ?? p.category).toLowerCase().replace(/s$/, '')}`}
                          {p.brand && p.brand !== p.name && (
                            <span className="ml-1.5 font-normal text-slate-500">· {p.brand}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {p.walkMinutes != null
                            ? `≈${p.walkMinutes} min walk · ${formatDistance(p.distanceM)}`
                            : formatDistance(p.distanceM)}
                        </p>
                        {p.openingHours && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {/* Only shown when the backend could read the hours
                                with confidence. Absent means "we don't know" —
                                never render that as closed. */}
                            {p.openState && (
                              <span
                                className={`shrink-0 rounded px-1 py-px font-semibold ${
                                  p.openState === 'open'
                                    ? 'bg-brand-50 text-brand-700'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {p.openState === 'open' ? 'Open now' : 'Closed now'}
                              </span>
                            )}
                            <span className="truncate">{p.openingHours}</span>
                          </p>
                        )}
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Directions to ${p.name ?? 'this place'}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {data.truncated && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Showing the nearest {data.pois.length} of {data.total}.
                </p>
              )}

              {filtered.some((p) => p.walkMinutes != null) && (
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  Walk times are estimates: {data.walkMethod}.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
