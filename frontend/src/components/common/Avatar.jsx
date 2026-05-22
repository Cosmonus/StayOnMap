// User avatar with image or initials fallback
// Props: src, name, size (sm|md|lg)

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  }

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizes[size]} ${className}`}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-brand-100 font-medium text-brand-700 ${sizes[size]} ${className}`}
      aria-label={name}
    >
      {initials}
    </span>
  )
}
