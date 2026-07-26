import { useRef, useState } from 'react'
import { Plus, ImageIcon, X, Star } from 'lucide-react'
import { uploadService } from '@services/upload.service'

const MAX = 10
const RECOMMENDED = 5

// The photo step's own board: the cover photo is rendered at the size of the
// decision it makes, and reordering is the whole interaction. The plain
// ImageUploader (a uniform grid) still serves the edit form — this one exists
// because in the wizard the FIRST photo is what a renter sees on the map, and
// a grid of equal squares says nothing about that.

function Tile({ url, idx, onRemove, onMakeCover, onDragStart, onDragOver, onDrop, className }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(idx) }}
      onDrop={onDrop}
      className={`group relative rounded-2xl overflow-hidden bg-slate-100 ${className}`}
    >
      <img src={url} alt={idx === 0 ? 'Cover photo' : `Photo ${idx + 1}`} className="w-full h-full object-cover" />
      {idx === 0 && (
        <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-bold">
          Cover photo
        </span>
      )}
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {idx !== 0 && (
          <button
            type="button"
            onClick={() => onMakeCover(idx)}
            aria-label="Make this the cover photo"
            className="w-8 h-8 rounded-full bg-white/95 text-slate-700 flex items-center justify-center hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Star size={14} strokeWidth={2.2} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(idx)}
          aria-label={`Remove photo ${idx + 1}`}
          className="w-8 h-8 rounded-full bg-white/95 text-slate-700 flex items-center justify-center hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

export default function PhotoBoard({ value = [], onChange, onUploadingChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const dragFrom = useRef(null)
  const dragOver = useRef(null)

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true)
    onUploadingChange?.(true)
    setError('')
    try {
      const slots = Math.min(files.length, MAX - value.length)
      const urls = await Promise.all(
        Array.from(files).slice(0, slots).map(async (file) => {
          const res = await uploadService.uploadPropertyImage(file)
          return res.data.url
        })
      )
      onChange([...value, ...urls])
    } catch (e) {
      setError(e.message ?? 'Upload failed. Check file size (max 5MB) and format.')
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function move(from, to) {
    if (from == null || to == null || from === to) return
    const next = [...value]
    next.splice(to, 0, next.splice(from, 1)[0])
    onChange(next)
  }

  const tileProps = {
    onRemove: (i) => onChange(value.filter((_, x) => x !== i)),
    onMakeCover: (i) => move(i, 0),
    onDragStart: (i) => { dragFrom.current = i },
    onDragOver: (i) => { dragOver.current = i },
    onDrop: () => { move(dragFrom.current, dragOver.current); dragFrom.current = null; dragOver.current = null },
  }

  const AddTile = (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading || value.length >= MAX}
      className="rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/60 flex flex-col items-center justify-center gap-2 text-brand-700 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors min-h-[140px]"
    >
      {uploading ? <span className="text-sm">Uploading…</span> : <><Plus size={20} strokeWidth={2.2} /><span className="text-sm font-semibold">Add more</span></>}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:auto-rows-[140px]">
        {value.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="sm:col-span-2 sm:row-span-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-colors min-h-[200px]"
          >
            <ImageIcon size={28} strokeWidth={1.6} aria-hidden="true" />
            <span className="text-sm font-semibold">{uploading ? 'Uploading…' : 'Add your cover photo'}</span>
          </button>
        ) : (
          value.map((url, i) => (
            <Tile key={url} url={url} idx={i} {...tileProps} className={i === 0 ? 'sm:col-span-2 sm:row-span-2' : ''} />
          ))
        )}
        {value.length > 0 && value.length < MAX && AddTile}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-slate-50">
        <p className="text-sm text-slate-600">
          <strong className="font-bold text-slate-900">{value.length} of {RECOMMENDED} recommended.</strong>{' '}
          Drag to reorder — the first photo is what shows on the map.
        </p>
        <p className="hidden sm:block text-sm text-slate-500 shrink-0">Max {MAX}, 5 MB each</p>
      </div>
    </div>
  )
}
