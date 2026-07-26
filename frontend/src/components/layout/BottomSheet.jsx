import { useRef, useState, useEffect, useCallback } from 'react'

const SNAPS = [0.30, 0.60, 0.95]  // fraction of viewport height
const SNAP_THRESHOLD = 0.08       // fraction distance to snap

export default function BottomSheet({ children, initialSnap = 0 }) {
  const [snapIdx, setSnapIdx] = useState(initialSnap)
  const [dragging, setDragging] = useState(false)
  const [dragY, setDragY] = useState(null)
  const startYRef = useRef(null)
  const startSnapRef = useRef(null)
  const sheetRef = useRef(null)

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const snapHeights = SNAPS.map(s => Math.round(vh * s))
  const height = dragging && dragY !== null ? dragY : snapHeights[snapIdx]

  const onPointerDown = useCallback((e) => {
    startYRef.current = e.clientY
    startSnapRef.current = snapHeights[snapIdx]
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [snapIdx, snapHeights])

  const onPointerMove = useCallback((e) => {
    if (!dragging) return
    const delta = startYRef.current - e.clientY
    const newH = Math.max(snapHeights[0] * 0.5, Math.min(vh * 0.98, startSnapRef.current + delta))
    setDragY(newH)
  }, [dragging, snapHeights, vh])

  const onPointerUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    const currentH = dragY ?? snapHeights[snapIdx]

    let closest = 0
    let minDist = Infinity
    snapHeights.forEach((sh, i) => {
      const dist = Math.abs(sh - currentH)
      if (dist < minDist) { minDist = dist; closest = i }
    })

    // Velocity snap: if dragging fast toward a snap, overshoot threshold
    const delta = currentH - snapHeights[snapIdx]
    if (delta > vh * SNAP_THRESHOLD && closest < SNAPS.length - 1) closest++
    if (delta < -vh * SNAP_THRESHOLD && closest > 0) closest--

    setSnapIdx(closest)
    setDragY(null)
  }, [dragging, dragY, snapHeights, snapIdx, vh])

  // Bounce hint on mount
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    el.style.transition = 'none'
    requestAnimationFrame(() => {
      el.style.transition = 'height 350ms cubic-bezier(0.32,0.72,0,1)'
    })
  }, [])

  return (
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-3xl md:hidden overflow-hidden"
      style={{
        height: `${height}px`,
        transition: dragging ? 'none' : 'height 300ms cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
      }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center items-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="w-10 h-1 rounded-full bg-slate-200 hover:bg-slate-300 transition-colors" />
      </div>

      {/* Snap dots indicator */}
      <div className="flex justify-center gap-1.5 pb-2">
        {SNAPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setSnapIdx(i)}
            className={`rounded-full transition-all duration-200 ${
              i === snapIdx ? 'w-4 h-1.5 bg-brand-500' : 'w-1.5 h-1.5 bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto h-full pb-8">
        {children}
      </div>
    </div>
  )
}
