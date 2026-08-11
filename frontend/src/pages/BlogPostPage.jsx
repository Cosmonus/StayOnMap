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

  // Whether the READING GROUP is one column or two. It no longer decides the
  // page width — the shell is max-w-page either way, so the frame matches
  // Guides whatever an article contains. An article too short for a contents
  // list (under four sections) simply centres its prose at 68ch instead of
  // reserving a 16rem column for something that will not be there.
  const showSidebar = isWide && !!post?.body && hasTableOfContents(post.body)

  // White, matching /blog and the other editorial pages. An article is prose,
  // not an app screen — see .claude/ui-ux.md's "App shell", which exempts
  // long-form pages from the slate50 canvas.
  return (
    <div className="min-h-screen bg-white pt-16">
      {post && (
        <SEOMeta
          title={post.seoTitle}
          description={post.description}
          canonical={canonical(`/blog/${post.slug}`)}
        />
      )}

      {/* `max-w-page`, the same shell as Guides (/blog) and Services — so
          navigating from the listing to an article does not jump the page frame
          inward. Widened from max-w-6xl/3xl on 2026-08-11.

          The prose is wide too, but not shell-wide. The measure is a token
          (`max-w-measure`, 90ch — see tailwind.config.js), widened from 68ch on
          the same day: the first pass gave the extra width to the cover and the
          related-posts grid and left the text where it was, which read as the
          image growing and the article not. 90ch is a quarter wider.
          It stops short of the full 1496px because a line of body text there
          runs ~160 characters and the eye loses the start of the next line long
          before that — the failure mode is people stopping reading, not the page
          looking wrong. The remaining slack goes to the cover, the related-posts
          grid (the SAME three-up as /blog, which is what makes the two pages
          read as one place) and the CTA. */}
      <article className="mx-auto max-w-page px-4 md:px-8 py-8 md:py-12">
        <Link
          to="/blog"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          All guides
        </Link>

        {/* Both states keep the reading measure rather than filling the shell.
            A skeleton that is wider than the article it stands in for promises
            the wrong shape, and a one-line error centred in 1560px of white
            reads as a broken page rather than a handled one. */}
        {isLoading && <div className="mt-6 mx-auto w-full max-w-measure"><ArticleSkeleton /></div>}

        {isError && error?.response?.status !== 404 && (
          <div className="mt-8 mx-auto w-full max-w-measure rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
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
            {/* The cover spans the full shell — it is the one element allowed
                to be as wide as the layout.

                Its HEIGHT is capped, and that is the load-bearing part. BlogCover
                is `aspect-video`, so at the 1496px content width it renders 842px
                tall: an entire viewport of cover before a word of the article.
                Worse, most posts have no image yet, so what fills it is the
                PLACEHOLDER — which is deliberately plain so it reads as "an image
                goes here" and gets replaced (BlogCover, operator decision
                2026-08-07). At 842px it stops reading as a placeholder and starts
                reading as a broken page: the decision undone by scale rather than
                by anyone disagreeing with it.
                Capping the height rather than the width keeps the wide cover and
                loses the void. `object-cover` on the image means a real hero
                crops rather than squashes. */}
            <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-slate-200 animate-fade-in">
              <BlogCover post={post} priority className="max-h-[460px]" />
            </div>

            {/* The reading group: header, prose and contents, centred as one
                unit at exactly the width of its own columns
                (68ch + the gap + the sidebar). Sized to its CONTENT rather than
                to the page, because the alternative — letting these stretch and
                pushing the sidebar to the far edge with `justify-between` —
                opens a ~500px void between the text and its own table of
                contents at 1560. Centring the pair keeps them reading as one
                thing, and keeps the header aligned with the prose beneath it. */}
            <div className={`mx-auto w-full ${showSidebar ? 'max-w-reading' : 'max-w-measure'}`}>
              <header className="mt-8 max-w-measure animate-slide-up">
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
              {/* No `justify-between`: the wrapper above is exactly the width of
                  these two columns plus the gap, so there is no slack left to
                  distribute — and asking for it back would reintroduce the void. */}
              {/* `1fr`, not a repeat of the measure: the GROUP above is already
                  measure + gap + sidebar, so the remaining space IS the measure
                  and stating it twice is two numbers that must agree with
                  nothing making them agree. */}
              <div className={showSidebar ? 'grid grid-cols-[minmax(0,1fr)_16rem] items-start gap-12' : ''}>
                <div className="min-w-0 max-w-measure">
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
            </div>

            {/* Outside the reading group, so these take the full page width.
                RelatedPosts is the SAME `sm:grid-cols-2 lg:grid-cols-3` as
                BlogPage's listing, which is the point: at max-w-page the two
                render identically, and an article's footer looks like the page
                you arrived from instead of a narrower echo of it. */}
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
