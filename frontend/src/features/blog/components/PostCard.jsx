import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { formatPostDate } from '../format'

/**
 * One article in a list. `featured` is the lead card on the index — same
 * component, wider layout, so the two cannot drift in what they show.
 */
export default function PostCard({ post, featured = false }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`group flex flex-col rounded-2xl bg-white ring-1 ring-slate-200 p-5 transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
        featured ? 'sm:p-8' : ''
      }`}
    >
      <span className="text-badge font-semibold uppercase tracking-wide text-brand-700">
        {post.clusterLabel}
      </span>

      <h3
        className={`mt-2 font-bold text-slate-800 leading-tight group-hover:text-brand-700 ${
          featured ? 'text-2xl' : 'text-lg'
        }`}
      >
        {post.title}
      </h3>

      <p className={`mt-2 text-slate-600 leading-relaxed ${featured ? 'text-base' : 'text-sm'}`}>
        {post.excerpt}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
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
