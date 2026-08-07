import PostCard from './PostCard'

/**
 * Where to go next. Resolved server-side (see blog.service.js) — an article
 * that names no reachable related posts falls back to others in its cluster,
 * so no article is ever a dead end.
 */
export default function RelatedPosts({ posts }) {
  if (!posts?.length) return null

  return (
    <section aria-labelledby="related-heading" className="mt-14">
      <h2 id="related-heading" className="text-2xl font-bold text-slate-800 mb-5">
        Keep reading
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((p) => <PostCard key={p.slug} post={p} />)}
      </div>
    </section>
  )
}
