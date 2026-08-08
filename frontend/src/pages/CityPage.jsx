import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, SearchX } from 'lucide-react'
import { localityService } from '@services/locality.service'
import { formatCurrency } from '@utils/format'
import Header from '@components/layout/Header'
import Footer from '@components/layout/Footer'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { trackOnce } from '@lib/analytics'
import PropertyCard from '@features/properties/components/PropertyCard'

// The city landing page — the broadest query we can honestly answer ("flats for
// rent in Chennai"). It replaced five `/properties?city=X` sitemap URLs, which
// could never rank because Google reads a query parameter as a variant of
// `/properties` rather than a page of its own.
//
// The server rendered this page's <head> before React loaded (backend
// features/seo/prerender.service.js); `SEOMeta` is the client-side half, so an
// in-app navigation gets the same title a crawler saw. Both read the same API
// response, so they cannot describe different inventory.
//
// A city with nothing in it 404s rather than serving a page about no homes.
export default function CityPage() {
  const { citySlug } = useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['city', citySlug],
    queryFn: () => localityService.getCity(citySlug).then((r) => r.data),
  })

  // See LocalityPage for the full reasoning: an entry marker, not a funnel
  // step, deduped by name so only the first landing of a session counts.
  useEffect(() => {
    trackOnce('seo_landing_view', { page: 'city', citySlug })
  }, [citySlug])

  const Shell = ({ children }) => (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex-1 pt-16">{children}</div>
      <Footer />
    </div>
  )

  if (isLoading) {
    return (
      <Shell>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-pulse">
          <div className="h-8 w-72 bg-slate-200 rounded-lg" />
          <div className="h-5 w-96 bg-slate-200 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <div key={i} className="h-72 bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      </Shell>
    )
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <SearchX className="w-6 h-6" strokeWidth={1.8} />
          </div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">Nothing listed here yet</h1>
          <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
            We don&apos;t have any homes in this city right now. The map shows everything
            that is available.
          </p>
          <Link
            to="/"
            className="inline-flex items-center min-h-[44px] px-6 py-3 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a]"
          >
            Open the map
          </Link>
        </div>
      </Shell>
    )
  }

  const { city, properties, localities, count, medianRent } = data
  const homes = `${count} ${count === 1 ? 'home' : 'homes'}`

  return (
    <Shell>
      <SEOMeta
        title={`Rent in ${city} — ${homes} without brokerage`}
        description={`${homes} for rent in ${city}, listed directly by owners.${
          medianRent ? ` Median rent ${formatCurrency(medianRent)}/mo.` : ''
        } No brokerage, no agents.`}
        canonical={canonical(`/rent/${citySlug}`)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
          <MapPin className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
          India
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Rent in {city}</h1>
        <p className="text-sm text-slate-600 mt-1.5">
          {homes} listed directly by owners
          {medianRent && <> &middot; median {formatCurrency(medianRent)}/mo</>}
          {' '}&middot; no brokerage
        </p>

        {/* Down into the areas. This is the internal linking that makes a city
            page worth having rather than a second copy of /properties: it is
            the only place a crawler can discover the locality pages, and the
            only place a person sees which areas actually have homes. The list
            is already filtered to indexable localities server-side — linking to
            a noindex page would spend this page's authority on a dead end. */}
        {localities.length > 0 && (
          <nav aria-label={`Areas in ${city}`} className="mt-6 flex flex-wrap gap-2">
            {localities.map((l) => (
              <Link
                key={l.localitySlug}
                to={`/rent/${citySlug}/${l.localitySlug}`}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-brand-600 hover:text-brand-700"
              >
                {l.locality}
                <span className="text-xs text-slate-500">{l.count}</span>
              </Link>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Looking somewhere else?{' '}
            <Link to="/" className="font-semibold text-brand-600 hover:text-brand-700">
              See every home on the map
            </Link>
            .
          </p>
        </div>
      </div>
    </Shell>
  )
}
