import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { uploadService } from '@services/upload.service'

export default function ImageUploader({ value = [], onChange, onUploadingChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true)
    onUploadingChange?.(true)
    setError('')
    try {
      const slots = Math.min(files.length, 10 - value.length)
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

  function remove(idx) {
    onChange(value.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {value.map((url, i) => (
          <div key={url} className="relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80 leading-none"
            >
              ×
            </button>
            {i === 0 && (
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-brand-600 text-white text-xs rounded font-medium">
                Cover
              </span>
            )}
          </div>
        ))}

        {value.length < 10 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-[4/3] rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-brand-400 hover:bg-brand-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {uploading ? (
              <span className="text-xs text-slate-400">Uploading...</span>
            ) : (
              <>
                <Plus className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
                <span className="text-xs text-slate-400">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-slate-400">First photo is the cover. Max 10 photos, 5 MB each (JPEG, PNG, WebP).</p>
    </div>
  )
}
