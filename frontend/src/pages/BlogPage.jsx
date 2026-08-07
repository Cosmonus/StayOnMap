import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { blogService } from '@services/blog.service'
import PostCard from '@features/blog/components/PostCard'

// The article index. Thin composer — no logic beyond picking which cluster to
// show, which is view state and belongs here.
//
// The server renders this route's <head> before React loads (see
// backend/src/features/seo), so what SEOMeta sets is the hydrated copy. Both
// have to say the same thing; the shared wording lives in the two files rather
// than being fetched, because a <head> that arrives after a fetch is a <head>
// no crawler waited for.
const TITLE = 'Renting in India — guides & city insights'
const DESCRIPTION =
  'Practical guides to renting in India: agreements, deposits, tenant rights, '
  + 'city and neighbourhood comparisons, and what the data actually says.'

function SkeletonCard() {
  return <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
}

export default function BlogPage() {
  const [cluster, setCluster] = useState(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['blog', 'index'],
    queryFn: () => blogService.list().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const posts = data?.posts ?? []
  const clusters = data?.clusters ?? {}
  // Only offer a filter for clusters that actually have an article. A chip
  // that leads to an empty list is a promise the content plan has not kept yet.
  const available = Object.entries(clusters).filter(([key]) => posts.some((p) => p.cluster === key))
  const visible = cluster ? posts.filter((p) => p.cluster === cluster) : posts
  const [lead, ...rest] = visible

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      <SEOMeta title={TITLE} description={DESCRIPTION} canonical={canonical('/blog')} />

      <div className="mx-auto max-w-5xl px-4 md:px-8 py-10 md:py-14">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-800 leading-tight">Renting, explained</h1>
          <p className="mt-3 max-w-[60ch] text-base text-slate-600 leading-relaxed">
            Deposits, agreements, tenant rights, and how to read a neighbourhood before you
            sign. Written by people who have moved cities, argued with landlords, and lost a
            deposit or two learning this the hard way.
          </p>
        </header>

        {available.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCluster(null)}
              className={`min-h-[44px] rounded-xl px-4 text-sm font-medium transition-colors ${
                cluster === null
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-800'
              }`}
            >
              All
            </button>
            {available.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCluster(key)}
                className={`min-h-[44px] rounded-xl px-4 text-sm font-medium transition-colors ${
                  cluster === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
            <p className="text-base text-slate-600">We couldn&apos;t load the articles just now.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 min-h-[44px] rounded-xl bg-[#111111] px-6 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !isError && !visible.length && (
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-800">Nothing here yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              The first guides are being written. In the meantime, the map is the useful part.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-[#111111] px-6 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
            >
              Open the map
            </Link>
          </div>
        )}

        {!isLoading && !isError && visible.length > 0 && (
          <>
            <PostCard post={lead} featured />
            {rest.length > 0 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {rest.map((p) => <PostCard key={p.slug} post={p} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
