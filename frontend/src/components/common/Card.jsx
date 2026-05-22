// Generic card container
// Props: padding (none|sm|md|lg), shadow (none|sm|md), hoverable, children

export default function Card({
  children,
  padding = 'md',
  shadow = 'sm',
  hoverable = false,
  className = '',
  ...props
}) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  const shadows = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white ${paddings[padding]} ${shadows[shadow]} ${hoverable ? 'transition-shadow hover:shadow-md' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
