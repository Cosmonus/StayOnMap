import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

// The five variants `.claude/ui-ux.md` names, plus `dark`.
//
// `dark` is the #111111 account/commitment action — sign in, publish, pay,
// delete-my-account. It is not a shade of the brand and must not become one:
// jade means "interactive", #111111 means "this commits you to something".
// It was hand-rolled at ~30 call sites before it was a variant.
const VARIANTS = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700',
  secondary: 'bg-white text-brand-700 border border-brand-200 hover:bg-brand-50',
  outline:   'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100',
  danger:    'bg-red-600 text-white hover:bg-red-700',
  dark:      'bg-[#111111] text-white hover:bg-[#2a2a2a]',
}

// Heights, not paddings. 44px is the mobile floor from ui-ux.md and 40px the
// desktop one, so `md` carries both and steps down at `sm:`. The old scale was
// px-3 py-1.5 / px-4 py-2, which rendered 32-36px controls — under the floor at
// every size, and off the spacing scale besides.
const SIZES = {
  sm: 'min-h-[36px] px-3 text-sm gap-1.5',
  md: 'min-h-[44px] sm:min-h-[40px] px-4 text-sm gap-2',
  lg: 'min-h-[48px] px-6 text-base gap-2',
}

const BASE =
  'inline-flex items-center justify-center font-semibold rounded-xl transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    to,
    href,
    type = 'button',
    className = '',
    ...rest
  },
  ref,
) {
  const cls = [
    BASE,
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    fullWidth ? 'w-full' : '',
    className,
  ].join(' ')

  const spinner = loading ? (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  ) : null

  // A link is a link. Rendering navigation as a <button onClick={navigate}>
  // loses middle-click, open-in-new-tab and the status-bar preview, and reads
  // to a screen reader as an action rather than a destination.
  if (to && !disabled && !loading) {
    return (
      <Link ref={ref} to={to} className={`${cls} no-underline`} {...rest}>
        {children}
      </Link>
    )
  }
  if (href && !disabled && !loading) {
    return (
      <a ref={ref} href={href} className={`${cls} no-underline`} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      // Announces the pending state instead of leaving a screen-reader user
      // with a button that silently stopped responding.
      aria-busy={loading || undefined}
      className={cls}
      {...rest}
    >
      {spinner}
      {children}
    </button>
  )
})

export default Button
