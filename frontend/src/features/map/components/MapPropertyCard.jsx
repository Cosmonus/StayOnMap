import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { savedService } from '@services/saved.service'
import { imgUrl, formatCompact, isAvailableToday } from '@utils/format'

const FURNISHED_LABEL = { FULLY: 'Fully furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }
const TYPE_LABEL = {
  APARTMENT: 'Apartment', HOUSE: 'House', VILLA: 'Villa',
  PG: 'PG', INDEPENDENT_HOUSE: 'Independent house', COMMERCIAL: 'Commercial',
}

// On-brand jade gradients — cycled per card so a stack reads with variety while
// staying within the Terrain Jade palette (no off-brand blues/purples).
const GRADIENTS = [
  'bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700',
  'bg-gradient-to-br from-brand-600 via-brand-500 to-teal-500',
  'bg-gradient-to-tr from-brand-700 via-brand-600 to-brand-400',
  'bg-gradient-to-b  from-teal-500 via-brand-500 to-brand-700',
]

export default function MapPropertyCard({ property, index = 0, isSaved: initialSaved = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const qc = useQueryClient()
  const [saved, setSaved] = useState(initialSaved)

  const thumb = property.images?.[0]?.url ?? property.images?.[0]
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const name = property.landmark?.trim() || property.city
  const available = isAvailableToday(property.availableFrom)

  const bhkLabel = property.bhk === 0 ? 'Studio' : property.bhk ? `${property.bhk} BHK` : null
  const specLine = [
    bhkLabel,
    FURNISHED_LABEL[property.furnished],
    property.type && TYPE_LABEL[property.type],
    property.area && `${Math.round(Number(property.area))} sq ft`,
  ].filter(Boolean).join(' · ')

  const mutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(property.id).then(r => r.data) : savedService.unsave(property.id).then(r => r.data),
    onMutate: (isSaving) => setSaved(isSaving),
    onError: (_err, isSaving) => setSaved(!isSaving),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  function handleHeartClick(e) {
    e.stopPropagation()
    if (!user) { openLoginModal(); return }
    mutation.mutate(!saved)
  }

  return (
    <div
      onClick={() => navigate(`/property/${property.id}`)}
      className="group cursor-pointer rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      {/* Banner — property photo if present, otherwise an on-brand jade gradient */}
      <div className={`relative h-44 ${thumb ? 'bg-slate-100' : gradient}`}>
        {thumb && (
          <img
            src={imgUrl(thumb, 'card')}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        {/* Legibility scrim under the area name */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />

        {available && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-emerald-500 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="text-[11px] font-semibold text-white leading-none">Available now</span>
          </div>
        )}

        <button
          onClick={handleHeartClick}
          aria-label={saved ? 'Remove from saved' : 'Save property'}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-110 active:scale-95 transition-transform duration-150"
        >
          <Heart size={16} fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : '#524e47'} />
        </button>

        <p className="absolute bottom-2.5 left-4 right-4 text-white font-bold text-lg leading-tight truncate drop-shadow-sm">
          {name}
        </p>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-lg font-bold text-slate-900 leading-none">
          {formatCompact(Number(property.rent))}
          <span className="text-xs font-normal text-slate-400 ml-1">/mo</span>
        </p>
        <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-1 mt-1.5">
          {property.title}
        </h3>
        {specLine && (
          <p className="text-xs text-slate-400 truncate mt-1">{specLine}</p>
        )}
      </div>
    </div>
  )
}
