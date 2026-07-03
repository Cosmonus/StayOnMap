import { Link } from 'react-router-dom'
import { CITY_LIST_LABEL } from '@/config/cities'

const LINKS = {
  Explore: [
    { label: 'Home',       to: '/' },
    { label: 'Properties', to: '/properties' },
    { label: 'Rules',      to: '/rules' },
    { label: 'About',      to: '/about' },
    { label: 'Intelligence', to: '/intelligence' },
    { label: 'Contact',    to: '/contact' },
  ],
  'For Owners': [
    { label: 'List Your Property', to: '/user' },
    { label: 'Manage Listings',    to: '/user' },
    { label: 'Rental Agreements',  to: '/user' },
    { label: 'Track Payments',     to: '/user' },
  ],
  'For Tenants': [
    { label: 'Browse Rentals', to: '/properties' },
    { label: 'Saved Homes',    to: '/user?tab=wishlist' },
    { label: 'How It Works',   to: '/about' },
    { label: 'Get in Touch',   to: '/contact' },
  ],
}

const SOCIALS = [
  {
    label: 'Website',
    href: 'https://www.srigokulkrishnan.com',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/srigokulkrishnan/',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: 'Twitter / X',
    href: 'https://x.com/srigokulkrishn',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622z"/>
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer className="bg-[#111111] text-white">

      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2 no-underline mb-4">
              <span className="font-display font-bold text-xl text-white tracking-tight">
                Stay<span className="text-brand-500">OnMap</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-xs">
              Owner-direct rentals in {CITY_LIST_LABEL}. No broker. No commission. Just a home and the person who owns it.
            </p>

            {/* Socials */}
            <div className="flex items-center gap-2">
              {SOCIALS.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-brand-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors duration-150"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{group}</p>
              <ul className="flex flex-col gap-2.5">
                {items.map(({ label, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="text-sm text-slate-400 hover:text-white transition-colors duration-150 no-underline"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Bottom bar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            © {new Date().getFullYear()} StayOnMap. All rights reserved.
          </p>
          <Link to="/privacy" className="text-xs text-slate-500 hover:text-white transition-colors duration-150 no-underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-xs text-slate-500 hover:text-white transition-colors duration-150 no-underline">
            Terms of Service
          </Link>
        </div>
        <p className="text-xs text-slate-600 text-center sm:text-right">
          Built by{' '}
          <a
            href="https://www.srigokulkrishnan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white transition-colors duration-150 no-underline"
          >
            Sri Gokul Krishnan
          </a>
        </p>
      </div>

    </footer>
  )
}
