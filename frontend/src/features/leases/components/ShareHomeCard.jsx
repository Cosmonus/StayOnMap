import { useEffect, useRef, useState } from 'react'
import { PartyPopper } from 'lucide-react'
import Modal from '@components/common/Modal'

// The "I'm home" share card (docs/points-and-sharing.md §4). The card carries
// AREA + CITY + MONTH and nothing else — no address, no photo, no listing
// link, no owner name. That boundary is what keeps it clear of the roadmap's
// "never share listings" rule; do not add to it. Drawn client-side on a
// canvas so no image is ever stored or served.
const SIZE = 1080
const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui"

function drawCard(canvas, { area, city, month }) {
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#fafaf8'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#12a374'
  ctx.fillRect(0, 0, SIZE, 18)
  ctx.fillRect(0, SIZE - 18, SIZE, 18)

  ctx.textAlign = 'center'
  ctx.font = `140px ${FONT}`
  ctx.fillText('🏡', SIZE / 2, 300)

  ctx.fillStyle = '#0d0c0a'
  ctx.font = `bold 96px ${FONT}`
  ctx.fillText("I'm home!", SIZE / 2, 460)

  ctx.fillStyle = '#0d8a5f'
  ctx.font = `bold 72px ${FONT}`
  ctx.fillText(area, SIZE / 2, 610)

  ctx.fillStyle = '#78736a'
  ctx.font = `44px ${FONT}`
  ctx.fillText(area === city ? month : `${city} · ${month}`, SIZE / 2, 690)

  ctx.font = `36px ${FONT}`
  ctx.fillText('Found broker-free on', SIZE / 2, 900)
  ctx.font = `bold 52px ${FONT}`
  const stay = 'Stay', onMap = 'OnMap'
  const w1 = ctx.measureText(stay).width
  const w2 = ctx.measureText(onMap).width
  const x = (SIZE - w1 - w2) / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = '#0d0c0a'
  ctx.fillText(stay, x, 970)
  ctx.fillStyle = '#0d8a5f'
  ctx.fillText(onMap, x + w1, 970)
}

async function canvasToFile(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  return new File([blob], 'stayonmap-im-home.png', { type: 'image/png' })
}

export default function ShareHomeButton({ lease }) {
  const [open, setOpen] = useState(false)
  const canvasRef = useRef(null)

  const area = lease.property?.landmark || lease.property?.city || ''
  const city = lease.property?.city || ''
  const month = new Date(lease.signedAt || lease.startDate)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  useEffect(() => {
    if (!open || !canvasRef.current) return
    // Ensure the display font is loaded before drawing, else canvas falls back
    document.fonts.ready.then(() => {
      if (canvasRef.current) drawCard(canvasRef.current, { area, city, month })
    })
  }, [open, area, city, month])

  async function share() {
    const file = await canvasToFile(canvasRef.current)
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }) } catch { /* user closed the sheet */ }
      return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="py-2 px-4 text-sm font-semibold text-brand-700 border border-brand-200 hover:bg-brand-50 rounded-xl transition-colors inline-flex items-center gap-1.5"
      >
        <PartyPopper className="w-4 h-4" strokeWidth={2} />
        Share: I&apos;m home
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="You found a home 🎉">
        <div className="space-y-4">
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="w-full rounded-2xl border border-slate-100" />
          <p className="text-xs text-slate-400 text-center">
            Only your area, city and move-in month are on the card — never the address, a photo or a link.
          </p>
          <button
            onClick={share}
            className="w-full py-2.5 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a] transition-colors"
          >
            Share
          </button>
        </div>
      </Modal>
    </>
  )
}
