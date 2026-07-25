import { useState, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { imgUrl } from '@utils/format'

// ── Image Lightbox ──────────────────────────────────────────────────────────
export default function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const len = images.length

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + len) % len)
    if (e.key === 'ArrowRight') setIdx(i => (i + 1) % len)
  }, [len, onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={0}
      role="dialog"
    >
      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close gallery"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5 text-white" strokeWidth={2} />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
        {idx + 1} / {len}
      </div>

      {/* Image */}
      <img
        src={imgUrl(images[idx]?.url, 'detail')}
        alt={`Photo ${idx + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Nav */}
      {len > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + len) % len) }}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % len) }}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" strokeWidth={2.5} />
          </button>
        </>
      )}

      {/* Thumbnails */}
      {len > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto no-scrollbar px-2">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={(e) => { e.stopPropagation(); setIdx(i) }}
              aria-label={`Go to photo ${i + 1}`}
              className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-white opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}
            >
              <img src={imgUrl(img.url, 'card')} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
