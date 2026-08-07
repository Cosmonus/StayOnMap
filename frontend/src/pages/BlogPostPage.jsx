import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock } from 'lucide-react'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { blogService } from '@services/blog.service'
import { useMediaQuery } from '@hooks/useMediaQuery'
import NotFoundPage from '@pages/NotFoundPage'
import ArticleBody from '@features/blog/components/ArticleBody'
import BlogCover from '@features/blog/components/BlogCover'
import TableOfContents from '@features/blog/components/TableOfContents'
import FaqAccordion from '@features/blog/components/FaqAccordion'
import RelatedPosts from '@features/blog/components/RelatedPosts'
import { formatPostDate, showsUpdated } from '@features/blog/format'
import { hasTableOfContents } from '@features/blog/markdown'

// One article. Thin composer.
//
// The <head> for this route is rendered by the SERVER before React loads
// (backend/src/features/seo/blogMeta.js) — that is what link previews and
// crawlers read, since neither executes JS. SEOMeta below sets the same values
// again on the client so an in-app navigation between articles updates the tab
// title. The structured data is deliberately NOT repeated here: the server
// already put it in the initial HTML, and two copies of BlogPosting on one
// page is the ambiguity stripDefaults() exists to prevent.

function ArticleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-3/4 rounded-xl bg-slate-100 animate-pulse" />
      <div className="h-4 w-1/3 rounded-lg bg-slate-100 animate-pulse" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 rounded-lg bg-slate-100 animate-pulse" style={{ width: `${90 - (i % 3) * 12}%` }} />
        ))}
      </div>
    </div>
  )
}

export default function BlogPostPage() {
  const { slug } = useParams()
  // The contents list is ONE mounted component, not two hidden by CSS — it
  // renders a `<nav>` with a fixed `id`, and two of those in a document is a
  // duplicate-id a11y bug, not just wasted markup. `lg` = the sidebar's
  // breakpoint below.
  const isWide = useMediaQuery('(min-width: 1024px)')

  const { data: post, isLoading, isError, error } = useQuery({
    queryKey: ['blog', 'post', slug],
    queryFn: () => blogService.getBySlug(slug).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => err?.response?.status !== 404 && count < 2,
  })

  // An unknown slug is a genuine 404, not an error state — one answer for
  // "this URL doesn't exist", the same page the router's catch-all renders.
  // Rendered in place rather than redirected to, so the address bar still
  // shows the URL that failed. The server already 404s this route, so nginx
  // served the plain shell and this is what fills it.
  if (isError && error?.response?.status === 404) return <NotFoundPage />

  // The extra width exists to hold the contents sidebar. An article too short
  // to have one (under four sections) keeps the original single-column page
  // rather than stranding a 68ch text column against the left edge of a
  // 1152px one.
  const showSidebar = isWide && !!post?.body && hasTableOfContents(post.body)

  return (
    <div className="min-h-screen bg-slate-50 pt-16">
      {post && (
        <SEOMeta
          title={post.seoTitle}
          description={post.description}
          canonical={canonical(`/blog/${post.slug}`)}
        />
      )}

      {/* The page is wide; the TEXT is not. `ArticleBody` caps itself at 68ch
          and the header matches, so the extra width goes to the contents
          sidebar rather than stretching lines nobody can read. */}
      <article className={`mx-auto px-4 md:px-8 py-8 md:py-12 ${showSidebar ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <Link
          to="/blog"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          All guides
        </Link>

        {isLoading && <div className="mt-6"><ArticleSkeleton /></div>}

        {isError && error?.response?.status !== 404 && (
          <div className="mt-8 rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
            <p className="text-base text-slate-600">We couldn&apos;t load this article.</p>
            <Link
              to="/blog"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#111111] px-6 text-sm font-semibold text-white hover:bg-[#2a2a2a]"
            >
              Back to all guides
            </Link>
          </div>
        )}

        {post && (
          <>
            {/* The cover sits ABOVE the header, full content width rather than
                capped at the prose measure — it is the one element on the page
                that is allowed to be as wide as the layout, and clipping it to
                68ch beside an empty sidebar column looked like a mistake. */}
            <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-slate-200 animate-fade-in">
              <BlogCover post={post} priority />
            </div>

            <header className="mt-8 max-w-[68ch] animate-slide-up">
              <span className="text-badge font-semibold uppercase tracking-wide text-brand-700">
                {post.clusterLabel}
              </span>
              <h1 className="mt-2 text-4xl font-bold text-slate-800 leading-tight">{post.title}</h1>
              <p className="mt-4 text-lg text-slate-600 leading-relaxed">{post.description}</p>

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span className="font-medium text-slate-600">{post.author.name}</span>
                {post.author.role && <span className="text-slate-500">· {post.author.role}</span>}
                <span aria-hidden="true">·</span>
                <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={16} aria-hidden="true" />
                  {post.readingMinutes} min read
                </span>
              </div>

              {showsUpdated(post) && (
                <p className="mt-2 text-xs text-slate-500">
                  Updated <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt)}</time>
                </p>
              )}
            </header>

            <hr className="my-8 border-slate-200" />

            {/* Columns are sized to their CONTENT, not to fractions of the
                page: prose at its 68ch measure, contents at 16rem, and
                `justify-between` puts the slack in the middle so the sidebar
                sits on the right edge instead of floating mid-page. */}
            <div className={showSidebar ? 'grid grid-cols-[minmax(0,68ch)_16rem] items-start justify-between gap-12' : ''}>
              <div className="min-w-0 max-w-[68ch]">
                {!showSidebar && <TableOfContents markdown={post.body} />}

                <ArticleBody markdown={post.body} />

                {post.sources?.length > 0 && (
                  <section aria-labelledby="sources-heading" className="mt-12 rounded-2xl bg-white ring-1 ring-slate-200 p-5">
                    <h2 id="sources-heading" className="text-sm font-semibold text-slate-800 mb-3">
                      Sources
                    </h2>
                    <ol className="space-y-2">
                      {post.sources.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed">
                          <span aria-hidden="true" className="font-mono text-xs text-slate-500 min-w-[1.25rem]">
                            {i + 1}.
                          </span>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-700 underline underline-offset-2 hover:text-brand-600"
                          >
                            {s.label}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}

                <FaqAccordion items={post.faq} />
              </div>

              {/* Sticky, but capped and scrollable — the property page's lesson
                  is that a sticky column TALLER than the viewport pins on
                  contact and strands what is below it. A contents list is short
                  by construction (h2s only, hidden under four), so the cap is a
                  backstop for a monster article, not the normal case. */}
              {showSidebar && (
                <aside className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
                  <TableOfContents markdown={post.body} />
                </aside>
              )}
            </div>

            <RelatedPosts posts={post.related} />

            <section className="mt-14 rounded-2xl bg-[#111111] px-6 py-8 text-center">
              <h2 className="text-xl font-bold text-white">See what&apos;s actually available</h2>
              {/* eslint-disable-next-line no-restricted-syntax -- the #111111 CTA card, where slate-300 is ~12:1 and the correct muted tone (same case as Footer) */}
              <p className="mt-2 mx-auto max-w-[46ch] text-sm text-slate-300 leading-relaxed">
                Every home on StayOnMap is listed by its owner — no brokerage, no agents.
                Browse them on the map and see the neighbourhood before you visit.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Open the map
              </Link>
            </section>
          </>
        )}
      </article>
    </div>
  )
}
