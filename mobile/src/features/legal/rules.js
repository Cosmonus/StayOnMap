// Community Rules, as data. Mirrors frontend/src/pages/RulesPage.jsx's RULES
// and PERSONAS constants.
//
// This is not marketing copy: the Terms of Service incorporate these rules "by
// reference" (§8) and cite them for the permanent broker ban (§14), on BOTH
// platforms. Until 2026-07-27 mobile named them in the Terms and had nowhere to
// send anyone — a legal document pointing at a page that does not exist.
//
// ⚠ SECOND COPY. Edit alongside frontend/src/pages/RulesPage.jsx.

export const PERSONAS = [
  { id: 'owners', label: 'Owners', tagline: 'You list. You set the terms. You keep 100% of the rent.' },
  { id: 'tenants', label: 'Tenants', tagline: 'You browse. You contact. You move in — zero commission.' },
  { id: 'brokers', label: 'Brokers', tagline: 'Unauthorized commission demands are not welcome here.' },
]

export const RULES = {
  owners: {
    summary: 'Be honest, be responsive, be fair. Your listing represents a home someone will live in.',
    dos: [
      'List only properties you own or are legally authorized to rent out — verify ownership to earn the Verified badge',
      'Complete your profile before listing — name, phone, city, and a verified email are required to host',
      'Upload real photos — at least 3 clear images of the actual property',
      'State the exact rent — or lump-sum lease amount — deposit, and maintenance charges upfront',
      'Respond to tenant inquiries within 48 hours',
      'Reply to reviews and reports on your listing — your response is shown alongside them',
      'Mark your listing as rented as soon as it is taken',
      'Treat every inquiry with equal respect regardless of background',
    ],
    donts: [
      'Don’t post fake or placeholder listings to "test the market"',
      'Don’t bait-and-switch — the listed price is the final price',
      'Don’t demand token money or any fee just to show the property',
      'Don’t discriminate based on religion, caste, gender, or marital status',
      'Don’t list the same property multiple times to game visibility — duplicates are detected and raise your risk score',
      'Don’t share tenant contact details with third parties',
    ],
  },
  tenants: {
    summary: 'Be genuine, show up, communicate. Owners invest time in every inquiry.',
    dos: [
      'Inquire only if you have genuine interest in renting',
      'Be honest about your occupation, family size, and move-in timeline',
      'Book visits through in-app appointments — and show up on time, or cancel in advance',
      'Keep conversations in the in-app chat — it protects both sides if something goes wrong',
      'Report suspicious or misleading listings immediately — anonymously if you prefer',
      'Write an honest review after living somewhere — it’s what the next renter relies on',
    ],
    donts: [
      'Don’t use the platform to window-shop with no intent to rent',
      'Don’t ask owners to negotiate commission for third parties',
      'Don’t share identity documents or bank details with anyone — StayOnMap never asks for them',
      'Don’t ghost after a visit — a polite "not interested" goes a long way',
      'Don’t pressure owners into lowering prices through fake competing offers',
      'Don’t post fake reviews — for or against a property',
    ],
  },
  brokers: {
    summary: 'Property managers with owner authorization are welcome. Commission demands are not.',
    dos: [
      'Property managers with written owner authorization may list on their behalf',
      'Clearly disclose that you are managing on behalf of the owner',
      'Follow all owner rules when acting as an authorized manager',
      'Contact us at hello@stayonmap.com to register as a property manager',
    ],
    donts: [
      'Don’t list properties you don’t own or aren’t authorized to manage',
      'Don’t demand commission from tenants — this platform is 100% free for tenants',
      'Don’t pose as a direct owner when you are acting as an intermediary',
      'Don’t use StayOnMap as a lead generation tool to funnel tenants elsewhere',
      'Don’t ask tenants for cash, UPI transfers, or any payment in exchange for access to a listing',
    ],
    warning: 'If a tenant files a complaint against you for demanding extra cash or unauthorized commission, your account will be permanently banned — no warnings, no appeals.',
    note: 'StayOnMap was built to remove the practice of demanding months of hard-earned rent as commission. Brokers who act in good faith as authorized property managers are welcome.',
  },
}
