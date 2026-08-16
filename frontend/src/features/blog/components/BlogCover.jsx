import { ImageIcon } from 'lucide-react'

// The visual for an article, in a card and at the top of the page.
//
// If the post carries `hero.url` that image wins outright. Otherwise this is a
// PLACEHOLDER — deliberately plain, and deliberately reading as "an image goes
// here" rather than as finished art (operator decision 2026-08-07; real images
// are coming later).
//
// A generated map-contour cover lived here briefly and was removed with it. It
// looked finished, which was exactly the problem: a placeholder that looks
// designed never gets replaced, because nothing about the page says it is
// waiting on anything. git has the history if it is ever wanted back.
//
// To add a real image: run backend/scripts/stamp-blog-logo.mjs (it writes the
// files into frontend/public/blog/) and set `hero` in the post's JSON. No code
// change here.
//
//   "hero": { "url": "/blog/security-deposits.jpg", "alt": "..." }
//
// hero.url is always the plain .jpg — that is also the og:image
// (backend/src/features/seo/blogMeta.js), and WhatsApp's preview bot needs
// JPG. For the page itself the browser is offered the WebP variants the stamp
// script writes beside it (<slug>_thumb.webp 800w / <slug>_full.webp 1600w,
// the same _thumb/_full pattern property uploads use), via <picture> — the
// JPG only downloads where WebP or srcset is unsupported.

// Only a local cover has the variant files; an external hero.url renders as a
// plain <img> rather than promising WebP nothing generated.
const LOCAL_COVER = /^\/blog\/([\w-]+)\.jpg$/

export default function BlogCover({ post, priority = false, className = '' }) {
  const { hero, title } = post

  if (hero?.url) {
    const img = (
      <img
        src={hero.url}
        alt={hero.alt || title}
        // Intrinsic size so the decoder knows the shape before bytes arrive;
        // layout is still owned by aspect-video + object-cover.
        width={1600}
        height={900}
        // `priority` is the article hero; a card cover is below the fold.
        loading={priority ? 'eager' : 'lazy'}
        // Lowercase on purpose — React 18 passes an unknown lowercase attribute
        // through to the DOM; the camelCase prop the lint rule wants only
        // exists in React 19 and would console-warn here instead of working.
        // eslint-disable-next-line react/no-unknown-property
        fetchpriority={priority ? 'high' : undefined}
        decoding="async"
        className={`w-full aspect-video object-cover ${className}`}
      />
    )

    const local = LOCAL_COVER.exec(hero.url)
    if (!local) return img

    const base = `/blog/${local[1]}`
    return (
      <picture>
        <source
          type="image/webp"
          srcSet={`${base}_thumb.webp 800w, ${base}_full.webp 1600w`}
          // The hero spans the reading shell (~1496px at the cap); a card sits
          // in BlogPage's 1/2/3-column grid, so it never needs the 1600w file.
          sizes={
            priority
              ? '(min-width: 1560px) 1496px, 100vw'
              : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
          }
        />
        {img}
      </picture>
    )
  }

  return (
    // aria-hidden: a placeholder carries no information, and announcing
    // "image placeholder" to a screen reader is noise, not access. The headline
    // beside it already says what the article is.
    <div
      aria-hidden="true"
      className={`flex w-full aspect-video items-center justify-center bg-slate-100 ${className}`}
    >
      <ImageIcon size={32} strokeWidth={1.5} className="text-slate-500" />
    </div>
  )
}
