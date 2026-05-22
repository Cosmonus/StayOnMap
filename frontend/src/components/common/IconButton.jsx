// Icon-only button (square, centered icon)
// Props: icon (ReactNode), size (sm|md|lg), variant (ghost|outline), label (aria)

export default function IconButton({
  icon,
  size = 'md',
  variant = 'ghost',
  label,
  disabled = false,
  onClick,
  className = '',
}) {
  const sizes = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
  }

  const variants = {
    ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
    outline: 'text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${sizes[size]} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {icon}
    </button>
  )
}
