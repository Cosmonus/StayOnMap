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

// A landing page per locality — the shape the actual search intent has. Nobody
// searches "rentals in India"; they search "2bhk in anna nagar".
//
// The server already rendered this page's <head> before React loaded (see
// backend features/seo/prerender.service.js) — `SEOMeta` here is the client-side
// half, so an in-app navigation to this route gets the same title a crawler saw.
// Both read the same API response, so they cannot describe different inventory.
//
// A page only exists where there ARE listings: the backend 404s an empty
// locality rather than serving a page about nothing, and the sitemap is built
// from the same list. With ~5 real listings, generating a page per known area
// name would be hundreds of near-empty pages.
export default function LocalityPage() {
  const { citySlug, localitySlug } = useParams()

  const { data, isLoading, error } = useQuery({
    queryKey: ['locality', citySlug, localitySlug],
    queryFn: () => localityService.get(citySlug, localitySlug).then((r) => r.data),
  })

  // How this session STARTED, when it started here rather than on the map.
  //
  // `trackOnce` dedupes by event NAME, so this records the FIRST locality page
  // of a session and no later ones — which is the definition of an entry
  // marker, not a limitation. Browsing on to three more localities is
  // navigation within a visit that already began; counting each as an arrival
  // would inflate the denominator every segment rate is measured against, the
  // same reason `map_view` uses trackOnce rather than firing on every pan.
  //
  // Fired regardless of whether the fetch succeeds: somebody who landed on a
  // locality page that turned out to be empty still arrived from search, and
  // dropping that loses the denominator for the only question this page exists
  // to answer.
  //
  // Deliberately not a funnel STEP — see features/analytics/events.js. It is a
  // segment: "of the people who landed from search, how many reached each
  // step". Adding it above `map_view` would make every direct-to-map session
  // read as a drop-off from a page it never saw.
  useEffect(() => {
    trackOnce('seo_landing_view', { page: 'locality', citySlug, localitySlug })
  }, [citySlug, localitySlug])

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
            We don&apos;t have any homes in this area right now. The map shows everything
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

  const { locality, city, properties, count, medianRent } = data
  const homes = `${count} ${count === 1 ? 'home' : 'homes'}`

  return (
    <Shell>
      <SEOMeta
        title={`Rent in ${locality}, ${city} — ${homes} without brokerage`}
        description={`${homes} for rent in ${locality}, ${city}, listed directly by owners.${
          medianRent ? ` Median rent ${formatCurrency(medianRent)}/mo.` : ''
        } No brokerage, no agents.`}
        canonical={canonical(`/rent/${citySlug}/${localitySlug}`)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* The city is a LINK now, not a label (2026-08-08). A locality page
            had no route upward, so /rent/chennai/adyar was a leaf: a crawler
            arriving from search could reach one area and nothing else, and a
            person had to go back to the map to see the rest of the city. This
            is also the visible half of the BreadcrumbList in the page's
            structured data — the trail a search result shows should be a trail
            the page actually has. */}
        <Link
          to={`/rent/${citySlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-700 mb-2"
        >
          <MapPin className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden="true" />
          {city}
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Rent in {locality}</h1>
        <p className="text-sm text-slate-600 mt-1.5">
          {homes} listed directly by owners
          {medianRent && <> &middot; median {formatCurrency(medianRent)}/mo</>}
          {' '}&middot; no brokerage
        </p>

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
