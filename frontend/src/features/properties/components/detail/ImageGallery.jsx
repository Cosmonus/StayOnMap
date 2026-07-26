import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImageOff, LayoutGrid } from 'lucide-react'

// ── Image Gallery (Grid + Carousel) ─────────────────────────────────────────
// The availability pill and the photo count sit on the gallery itself rather
// than in the title block: they're the two things a renter checks before
// deciding whether to keep reading, and the image is where the eye already is.
export default function ImageGallery({ images, avail, onOpenLightbox }) {
  const [mobileIdx, setMobileIdx] = useState(0)
  const list = images ?? []

  if (!list.length) {
    return (
      <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center">
        <div className="text-center text-slate-300">
          <ImageOff className="w-16 h-16 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    )
  }

  // Each entry tiles its photo count exactly, leaving no blank cells. Anything
  // from 5 up uses the 5-slot hero layout and hides the rest behind "+N more".
  const GALLERY_LAYOUTS = {
    1: { grid: 'grid-cols-1 grid-rows-1', hero: '' },
    2: { grid: 'grid-cols-2 grid-rows-1', hero: '' },
    3: { grid: 'grid-cols-3 grid-rows-2', hero: 'col-span-2 row-span-2' },
    4: { grid: 'grid-cols-2 grid-rows-2', hero: '' },
  }
  const layout = GALLERY_LAYOUTS[list.length] ?? { grid: 'grid-cols-4 grid-rows-2', hero: 'col-span-2 row-span-2' }
  const visible = list.length >= 5 ? list.slice(0, 5) : list

  const availPill = (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-sm ${avail.bg}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${avail.dot}`} />
      <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
    </div>
  )

  return (
    <>
      {/* Desktop: a grid sized to the photos that exist. The previous version
          always drew the 5-slot layout and padded the gap with blank grey
          cells, so a listing with one photo — which is most of them — rendered
          as one image beside four empty boxes and read as a failed load. */}
      <div className="hidden md:block relative">
        <div className={`grid gap-2 rounded-2xl overflow-hidden h-[420px] ${layout.grid}`}>
          {visible.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={() => onOpenLightbox(i)}
              className={`relative group overflow-hidden ${i === 0 ? layout.hero : ''}`}
            >
              <img
                src={img.url}
                alt={i === 0 ? 'Property' : ''}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              {i === visible.length - 1 && list.length > visible.length && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">+{list.length - visible.length} more</span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="absolute top-4 left-4">{availPill}</div>

        <button
          onClick={() => onOpenLightbox(0)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-float transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2.5} />
          {list.length === 1 ? 'View photo' : `View all ${list.length} photos`}
        </button>
      </div>

      {/* Mobile: Carousel */}
      <div className="md:hidden relative rounded-2xl overflow-hidden">
        <button onClick={() => onOpenLightbox(mobileIdx)} className="w-full">
          <div className="aspect-[4/3] bg-slate-100">
            <img src={list[mobileIdx]?.url} alt="Property" decoding="async" className="w-full h-full object-cover" />
          </div>
        </button>
        <div className="absolute top-3 left-3">{availPill}</div>
        {list.length > 1 && (
          <>
            <button
              onClick={() => setMobileIdx(i => (i - 1 + list.length) % list.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMobileIdx(i => (i + 1) % list.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
            <div className="absolute bottom-3 right-4 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {mobileIdx + 1} / {list.length}
            </div>
          </>
        )}
      </div>
    </>
  )
}
