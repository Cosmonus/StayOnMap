import { Link } from 'react-router-dom'
import SEOMeta from '@components/common/SEOMeta'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <SEOMeta title="Page not found" noindex={true} />

      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-sm text-slate-500 font-mono">404</p>

        <svg
          width="80"
          height="104"
          viewBox="0 0 80 104"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M40 0C17.909 0 0 17.909 0 40c0 26.25 40 64 40 64S80 66.25 80 40C80 17.909 62.091 0 40 0z"
            fill="#3B6FE8"
          />
          <circle cx="40" cy="40" r="15" fill="white" />
        </svg>

        <h1 className="text-2xl font-semibold text-slate-800">
          Looks like you&apos;ve wandered off the map.
        </h1>

        <p className="text-sm text-slate-500 max-w-xs">
          The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back on the map.
        </p>

        <Link
          to="/"
          className="min-h-[44px] px-6 py-3 bg-[#111111] hover:bg-[#2a2a2a] text-white text-sm font-semibold rounded-xl transition-colors no-underline"
        >
          Back to the map
        </Link>
      </div>
    </div>
  )
}
