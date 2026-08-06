// Simple CSS tooltip — no JS positioning library needed for now
// Props: text, position (top|bottom|left|right), children

export default function Tooltip({
  children,
  text,
  position = 'top',
  className = '',
}) {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span className={`relative inline-flex group ${className}`}>
      {children}
      <span
        role="tooltip"
        // #1c1c1c was a fourth near-black in a palette that has exactly two
        // (#111111 dark CTA, #2a2a2a its hover) plus slate-900. rounded-md is
        // off the radius scale too.
        className={`absolute ${positions[position]} pointer-events-none z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100`}
      >
        {text}
      </span>
    </span>
  )
}
