// Horizontal or vertical divider
// Props: orientation (horizontal|vertical), label (optional center text)

export default function Divider({
  orientation = 'horizontal',
  label,
  className = '',
}) {
  if (orientation === 'vertical') {
    return <div className={`w-px self-stretch bg-slate-200 ${className}`} role="separator" />
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`} role="separator">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium text-slate-500 uppercase">{label}</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
    )
  }

  return <hr className={`border-t border-slate-200 ${className}`} />
}
