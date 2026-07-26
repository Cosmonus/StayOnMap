import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Share2, Heart } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { savedService } from '@services/saved.service'

// Public-page top bar: back + share + save. Mounted only for the public
// variant, so its save/share state and queries never run in the admin view.
export default function DetailTopBar({ property }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const id = property.id

  // Check if this property is already saved
  const { data: savedList } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then(r => r.data),
    enabled: !!user,
  })

  useEffect(() => {
    if (savedList && id) {
      setSaved(savedList.some(s => s.propertyId === id))
    }
  }, [savedList, id])

  const saveMutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(id) : savedService.unsave(id),
    onMutate: (isSaving) => setSaved(isSaving),
    onError: (_err, isSaving) => setSaved(!isSaving),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  const handleShare = useCallback(() => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: property?.title, url })
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [property?.title])

  return (
    <div className="flex items-center justify-between py-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to properties</span>
        <span className="sm:hidden">Back</span>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={handleShare}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
        >
          <Share2 className="w-4 h-4" strokeWidth={1.8} />
          {copied ? 'Copied!' : 'Share'}
        </button>
        <button
          onClick={() => user ? saveMutation.mutate(!saved) : openLoginModal()}
          className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium transition-all border ${saved ? 'bg-red-50 text-red-600 border-red-200' : 'text-slate-600 hover:bg-white hover:shadow-sm border-transparent hover:border-slate-200'}`}
        >
          <Heart className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} strokeWidth={1.8} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}
