import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { formatPostDate } from '../format'

/**
 * One article, wherever articles are listed. Every card is the same card —
 * there is no lead/featured variant, so a grid of them lines up.
 *
 * `h-full` + `mt-auto` on the byline is what makes that true: excerpts differ
 * in length, and without it three cards in a row have their dates at three
 * different heights.
 */
export default function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex h-full flex-col rounded-2xl bg-white ring-1 ring-slate-200 p-5 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="text-badge font-semibold uppercase tracking-wide text-brand-700">
        {post.clusterLabel}
      </span>

      <h3 className="mt-2 text-lg font-bold text-slate-800 leading-tight group-hover:text-brand-700">
        {post.title}
      </h3>

      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        {post.excerpt}
      </p>

      <div className="mt-auto pt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>{post.author.name}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <Clock size={16} aria-hidden="true" />
          {post.readingMinutes} min read
        </span>
      </div>
    </Link>
  )
}
