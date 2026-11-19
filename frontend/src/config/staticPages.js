// The <title> and description of every page whose head is fixed rather than built
// from data. ONE source for two consumers:
//   - each page's <SEOMeta> (client-side, what Google sees after rendering), and
//   - frontend/vite-plugins/staticHeads.js, which writes dist/<page>.html at build time so
//     the FIRST response already carries them. Link-preview bots (WhatsApp above
//     all) never run JS, so without that every one of these pages previewed as
//     the homepage — nine URLs with one title, one description and no canonical.
// Plain data, no imports: vite.config.js reads this file in Node.
//
// Titles are written WITHOUT the " | StayOnMap" suffix SEOMeta adds; keep them
// to 48 characters so the full title stays inside ~60. Descriptions 70-160.
export const STATIC_PAGES = {
  '/properties': {
    title: 'Browse Rental Properties',
    description:
      'Browse broker-free rentals across seven Indian states: flats, houses, PGs, shops and short stays, listed directly by owners. No broker fees.',
  },
  '/intelligence': {
    title: 'TrustScore and Fraud Detection, Explained',
    description:
      'How StayOnMap scores every listing: a live TrustScore engine, deterministic fraud detection and provenance-tracked neighbourhood data. Nothing set by hand.',
  },
  '/services': {
    title: 'Rental Services — Coming Soon',
    description:
      'StayOnMap Services will bring broker-free moving, rental agreements, home repairs, and tenant verification into one place. Coming soon.',
  },
  '/about': {
    title: 'About — Broker-Free, Map-First Renting',
    description:
      'How StayOnMap works: a broker-free rental map live across 7 Indian states, six property types, direct owner chat, in-app visits and leases, zero commission.',
  },
  '/contact': {
    title: 'Contact Us — Real Replies Within 24 Hours',
    description:
      'Questions about StayOnMap, a listing to report, or a partnership to discuss? Reach the team directly — no ticket queue, real replies within 24 hours.',
  },
  '/rules': {
    title: 'Community Rules for Owners and Tenants',
    description:
      'How owners, tenants and property managers are expected to behave on StayOnMap: honest listings, moderated reports (anonymous welcome), no commission demands.',
  },
  '/privacy': {
    title: 'Privacy Policy',
    description:
      'How StayOnMap collects, uses, and protects your personal data — including owner verification documents.',
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'The rules and disclaimers that govern your use of StayOnMap, for tenants, owners and property managers.',
  },
}
