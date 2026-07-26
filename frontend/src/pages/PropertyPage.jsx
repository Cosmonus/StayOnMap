import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SearchX } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { formatPrice } from '@utils/format'
import Header from '@components/layout/Header'
import Footer from '@components/layout/Footer'
import SEOMeta from '@components/common/SEOMeta'
import { BRAND, canonical } from '@lib/seo'
import PropertyDetailBody from '@features/properties/components/detail/PropertyDetailBody'
import { formatType, formatFurnished, bhkLabelFor } from '@features/properties/components/detail/detailUtils'

// ── Loading state ────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 animate-pulse">
      {/* Must track the real container in PropertyDetailBody, or the page
          jumps sideways the moment the skeleton is replaced. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden h-[420px]">
          <div className="col-span-2 row-span-2 bg-slate-200" />
          <div className="bg-slate-200" />
          <div className="bg-slate-200" />
          <div className="bg-slate-200" />
          <div className="bg-slate-200" />
        </div>
        <div className="h-8 w-96 bg-slate-200 rounded-lg" />
        <div className="h-5 w-64 bg-slate-200 rounded" />
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
// Thin composer: fetch + SEO + shell. All presentation lives in
// PropertyDetailBody (shared with the admin detail view — see the operator
// decision recorded on that component).
export default function PropertyPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const { data: property, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyService.getById(id).then(r => r.data),
  })

  // Layout wrapper (shared header + footer, logged-in or guest)
  const Shell = ({ children }) => (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex-1 pt-16">{children}</div>
      <Footer />
    </div>
  )

  if (isLoading) {
    return <Shell><PageSkeleton /></Shell>
  }

  if (error || !property) {
    return (
      <Shell>
        <SEOMeta title="Property not found" noindex />
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-24">
          <SearchX className="w-16 h-16 mb-4 text-slate-200" strokeWidth={1.5} />
          <p className="text-lg font-semibold text-slate-700">Property not found</p>
          <p className="text-sm mt-1">This listing may have been removed or is no longer available.</p>
          <button onClick={() => navigate(-1)} className="min-h-[44px] mt-6 px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
            Go back
          </button>
        </div>
      </Shell>
    )
  }

  // ── SEO ──────────────────────────────────────────────────────────────────
  const images = property.images ?? []
  const bhkLabel = bhkLabelFor(property)
  const primaryImage = images.find(i => i.isPrimary)?.url ?? images[0]?.url
  const seoTitle = [bhkLabel, formatType(property.type), 'in', property.city]
    .filter(Boolean).join(' ')
  const seoDesc = [
    bhkLabel, formatType(property.type),
    property.pricingModel === 'SALE' ? 'for sale in' : 'for rent in',
    property.area ? `${property.area}, ` : '', property.city,
    '—', formatPrice(property), property.furnished ? `· ${formatFurnished(property.furnished)}` : '',
    '· No brokerage ·', BRAND.name,
  ].filter(Boolean).join(' ')

  const propertyJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description ?? seoDesc,
    url: canonical(`/property/${id}`),
    image: primaryImage ?? undefined,
    offers: {
      '@type': 'Offer',
      price: property.rent,
      priceCurrency: 'INR',
      priceSpecification: { '@type': 'UnitPriceSpecification', priceType: 'monthly' },
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address ?? '',
      addressLocality: property.city,
      addressRegion: property.state ?? '',
      postalCode: property.pincode ?? '',
      addressCountry: 'IN',
    },
  }

  return (
    <Shell>
        {/* ── Page-level SEO ───────────────────────────────────────── */}
        <SEOMeta
          title={seoTitle}
          description={seoDesc.slice(0, 160)}
          image={primaryImage}
          canonical={canonical(`/property/${id}`)}
          jsonLd={propertyJsonLd}
        />
        {/* ── Scrollable main content ──────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <PropertyDetailBody property={property} variant="public" />
        </main>
    </Shell>
  )
}
