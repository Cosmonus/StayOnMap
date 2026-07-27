export default function Avatar({ name, url, size = 40, className = '' }) {
  const initial = name?.[0]?.toUpperCase() ?? '?'
  return url ? (
    <img src={url} alt={name} className={`rounded-full object-cover shrink-0 ${className}`} style={{ width: size, height: size }} />
  ) : (
    <div className={`rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 shrink-0 ${className}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initial}
    </div>
  )
}
