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
// To add a real image: put the file in frontend/public/blog/ and set `hero` in
// the post's JSON. No code change here.
//
//   "hero": { "url": "/blog/security-deposits.jpg", "alt": "..." }

export default function BlogCover({ post, priority = false, className = '' }) {
  const { hero, title } = post

  if (hero?.url) {
    return (
      <img
        src={hero.url}
        alt={hero.alt || title}
        // `priority` is the article hero; a card cover is below the fold.
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`w-full aspect-video object-cover ${className}`}
      />
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
