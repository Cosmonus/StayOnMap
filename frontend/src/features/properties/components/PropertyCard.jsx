import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { savedService } from '@services/saved.service'
import { imgUrl, formatCompact, formatAge, isAvailableToday } from '@utils/format'
import TrustBadge from '@components/common/TrustBadge'

// Plain text, no emoji/color — Airbnb's restraint: one muted line under the
// title carries all the spec info, instead of a row of colored chips.
const FURNISHED_LABEL = {
  FULLY: 'Furnished',
  SEMI: 'Semi furnished',
  UNFURNISHED: 'Unfurnished',
}

const TYPE_LABEL = {
  APARTMENT: 'Apartment', HOUSE: 'House', VILLA: 'Villa',
  PG: 'PG', INDEPENDENT_HOUSE: 'Independent house', COMMERCIAL: 'Commercial',
}

function HeartIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke={filled ? '#ef4444' : 'white'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

export default function PropertyCard({ property, isSaved: initialSaved = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const qc = useQueryClient()
  const [saved, setSaved] = useState(initialSaved)
  const [imgIdx, setImgIdx] = useState(0)

  const images = property.images?.length
    ? property.images.map(img => imgUrl(img?.url ?? img, 'card'))
    : [null]
  const totalImages = images.length

  const mutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving
        ? savedService.save(property.id).then(r => r.data)
        : savedService.unsave(property.id).then(r => r.data),
    onMutate: (isSaving) => setSaved(isSaving),
    onError: (_err, isSaving) => setSaved(!isSaving),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  function handleHeartClick(e) {
    e.stopPropagation()
    if (!user) { openLoginModal(); return }
    mutation.mutate(!saved)
  }

  const availableNow = isAvailableToday(property.availableFrom)
  const postedAge = formatAge(property.createdAt)
  const bhkLabel = property.bhk === 0 ? 'Studio' : property.bhk ? `${property.bhk} BHK` : null
  const specLine = [
    bhkLabel,
    FURNISHED_LABEL[property.furnished],
    property.type && TYPE_LABEL[property.type],
    property.area && `${Math.round(Number(property.area))} sq.ft`,
  ].filter(Boolean).join(' · ')

  return (
    <div
      onClick={() => navigate(`/property/${property.id}`)}
      className="group cursor-pointer h-full flex flex-col"
    >
      {/* Image — borderless, photo-forward; the only feedback is a soft lift on hover */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 shadow-sm group-hover:shadow-lg transition-shadow duration-200">
        {images[imgIdx] ? (
          <img
            src={images[imgIdx]}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#cbd5e1">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
        )}

        {/* Available Now badge — top left */}
        {availableNow && (
          <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-bold text-white leading-none">Available Now</span>
          </div>
        )}

        {/* Top right: trust badge + heart */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {property.trustScore?.badge && property.trustScore.badge !== 'UNRATED' && (
            <TrustBadge badge={property.trustScore.badge} size="sm" />
          )}
          <button
            onClick={handleHeartClick}
            aria-label={saved ? 'Remove from saved' : 'Save property'}
            className="w-8 h-8 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center hover:scale-110 active:scale-95 transition-transform duration-150 ease-spring"
          >
            <HeartIcon filled={saved} />
          </button>
        </div>

        {/* Image counter pill — bottom right */}
        {totalImages > 1 && (
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm">
            <span className="text-[10px] font-semibold text-white leading-none">{imgIdx + 1}/{totalImages}</span>
          </div>
        )}

        {/* Dot nav */}
        {totalImages > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_img, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i) }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body — no card chrome, just typography hierarchy on plain background */}
      <div className="pt-3 flex-1 flex flex-col">
        {/* Price — primary decision variable for a rental search */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <p className="text-xl font-bold text-slate-900 font-mono leading-none">
            {formatCompact(Number(property.rent))}
            <span className="text-xs font-normal text-slate-400 ml-1">/mo</span>
          </p>
          {property.deposit > 0 && (
            <p className="text-xs text-slate-400 shrink-0">
              {formatCompact(Number(property.deposit))} dep.
            </p>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-1 mb-1">
          {property.title}
        </h3>

        {/* Specs — one muted line instead of colored chips */}
        {specLine && (
          <p className="text-xs text-slate-500 truncate mb-1.5">{specLine}</p>
        )}

        {/* Location + posted age — pinned to bottom */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <p className="text-xs text-slate-400 flex items-center gap-1 min-w-0">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span className="truncate">{property.city}</span>
          </p>
          {postedAge && (
            <span className="text-[10px] text-slate-300 shrink-0">{postedAge}</span>
          )}
        </div>
      </div>
    </div>
  )
}
