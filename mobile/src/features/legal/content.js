// The legal documents, as data, so the app can render them as real screens.
//
// Mobile used to send people to https://www.stayonmap.com/privacy in a browser.
// A policy you have to leave the app to read is one most people never read, and
// on a phone with no signal it is simply unavailable — which is the wrong answer
// for the document that says what we do with someone's data.
//
// ⚠ THIS IS THE SECOND COPY. The first is frontend/src/pages/PrivacyPolicyPage.jsx
// and TermsOfServicePage.jsx. Edit BOTH, and bump LAST_UPDATED in both, or
// backend/tests/legal-parity.test.js fails — it compares this file's section
// titles and date against the web pages, because two divergent legal texts is a
// legal problem, not a formatting one.
//
// Block shapes a screen can render:
//   { p }                  paragraph
//   { lead, p }            paragraph opening with a bold run ("Location. Only if…")
//   { ul: [string | {lead, text}] }
//   { email }              a mailto row
//   { note }               small print
import { CITY_LIST_LABEL } from '@config/cities'

export const LAST_UPDATED = 'July 27, 2026'

const ADDRESS = 'Vivekanandar Street, Gandhi Nagar, Avadi, Ambattur, Tiruvallur – 600054, Tamil Nadu'
const CONTACT_EMAIL = 'hello@cosmonus.com'

export const PRIVACY = {
  key: 'privacy',
  title: 'Privacy Policy',
  sections: [
    {
      title: '1. Scope & who we are',
      blocks: [
        { p: 'This Privacy Policy explains how StayOnMap (“StayOnMap”, “we”, “us”) collects, uses, shares, and protects personal data when you use our website, mobile app, and related services (together, the “Platform”). It applies to tenants, property owners, and visitors browsing without an account.' },
        { p: `StayOnMap is operated by Cosmonus Pvt. Ltd., registered at ${ADDRESS}. StayOnMap is a data fiduciary under India’s Digital Personal Data Protection Act, 2023 (“DPDP Act”) for the personal data described below.` },
      ],
    },
    {
      title: '2. Information we collect',
      blocks: [
        { lead: 'Account information.', p: 'Name, email address, city, and a hashed password provided at registration. A phone number is optional for browsing and booking visits, but required before you can list a property — an owner has to be reachable by the people who may live there. Owners and tenants share one account system — the same person can list properties and browse as a tenant.' },
        { lead: 'Owner verification documents.', p: 'Listing a property may require documents that show authorization to rent it out — property tax receipts, utility bills, sale or rental agreements, title deeds, or business licenses (GST, trade license, homestay permit). We do not collect government identity documents such as Aadhaar or PAN, and we do not request selfies. Documents are uploaded directly by the owner and reviewed by our team; we do not independently verify them with any government database.' },
        { lead: 'Listing information.', p: 'Property address, coordinates, rent, deposit, photos, amenities, and house rules provided when creating a listing.' },
        { lead: 'Appointments & leases.', p: 'Visit requests (date, time, contact number, and any message to the owner), and — if a lease is offered and signed — lease terms (dates, rent, deposit amounts).' },
        { lead: 'Communications.', p: 'Chat messages between tenants and owners about a specific property, and any messages sent to us directly (e.g. via the Contact page).' },
        { lead: 'Reviews & reports.', p: 'Content submitted when reviewing a property or reporting a listing — reports can optionally be submitted anonymously.' },
        { lead: 'Location.', p: 'Only if you tap the locate button and grant permission. The mobile app may request precise device location (and the browser its own location) purely to centre the map where you are. It is used in the moment and never stored — we keep no history of your movement, and the app never asks for location in the background.' },
        { lead: 'Contribution record.', p: 'If you earn points, we keep a record of the actions that earned them — a review being approved, a report being upheld, verifying your email or phone, signing a lease — with the date and the item it relates to. It is visible only to you; there is no public leaderboard and points cannot be exchanged for anything.' },
        { lead: 'Usage & device data.', p: 'IP address, browser type, and basic request logs, collected automatically for security (rate limiting, abuse prevention) and debugging. We do not use third-party advertising trackers or analytics cookies.' },
        { lead: 'Waitlist signups.', p: 'Signing up from a city not supported yet stores name, email, and city so we can notify that person when we launch there — it does not create a full account.' },
      ],
    },
    {
      title: '3. How we use it',
      blocks: [
        { ul: [
          'Operate core features: browsing listings, booking visits, chat, leases, reviews, and notifications',
          'Verify property ownership before a listing goes live',
          'Compute TrustScore and risk indicators shown on listings (based on reviews, reports, and verification status — not personal documents)',
          'Send transactional emails and push notifications about appointments, leases, and account activity (never marketing without separate consent)',
          'Detect and prevent fraud, duplicate listings, and abuse',
          'Respond to support requests and moderate reported content',
          'Comply with legal obligations',
        ] },
        { p: 'We do not sell personal data, and we do not use it to serve third-party ads.' },
      ],
    },
    {
      title: '4. How we share it',
      blocks: [
        { lead: 'With other users, by design.', p: 'A property’s owner can see a tenant’s name, contact number, and message when a visit is requested. Public listing pages never show a raw phone number to anonymous visitors — contact details are only shared once someone engages with a listing. Account settings control whether a profile is visible to logged-in users only or hidden from certain features.' },
        { lead: 'Service providers.', p: 'A small number of infrastructure providers run the Platform, each processing only what is needed for their function:' },
        { ul: [
          { lead: 'Supabase', text: '— stores uploaded property images and verification documents' },
          { lead: 'Google Cloud Platform', text: '— hosts our application servers and database' },
          { lead: 'Google Maps Platform', text: '— powers map display, address search, and geocoding (search queries and coordinates are sent to Google to resolve locations)' },
          { lead: 'Our email provider', text: '— delivers transactional emails (appointment updates, password resets, sign-in codes). Depending on configuration this is either an SMTP provider (currently Google, via Gmail) or Resend’s transactional API. Your email address and the message content pass through whichever is active.' },
          { lead: 'Expo', text: '— and through it Google (FCM) on Android or Apple (APNs) on iOS, delivers push notifications to your device. The notification’s title and text pass through these services.' },
          { lead: 'Upstash', text: '— Redis used for caching and rate limiting; holds short-lived technical data, not profile information' },
          { lead: 'Sentry', text: '— error monitoring, when enabled. Receives crash and error reports, which can incidentally include the request path and account id involved.' },
        ] },
        { p: 'We do not share data with these providers for their own marketing purposes.' },
        { lead: 'Not currently enabled.', p: 'The Platform can use an AI provider (Anthropic) to help detect fraudulent listings and fake reviews. This is switched off today and no listing or review content is sent to any AI provider. If we turn it on, we will update this policy before doing so.' },
        { lead: 'Legal & safety.', p: 'Information may be disclosed if required by law, to enforce our Terms of Service, or to protect the rights, safety, or property of StayOnMap, our users, or the public.' },
        { lead: 'Business transfers.', p: 'If StayOnMap is involved in a merger, acquisition, or asset sale, information may be transferred as part of that transaction, subject to this policy.' },
      ],
    },
    {
      title: '5. Storage & international transfer',
      blocks: [
        { p: 'Our infrastructure providers may store or process data outside India. Using the Platform is treated as consent to this transfer, which we carry out consistent with the DPDP Act’s requirements for cross-border data transfer.' },
      ],
    },
    {
      title: '6. Data retention',
      blocks: [
        { p: 'Account data is kept for as long as an account is active. A request to delete an account results in personal data being removed within a reasonable period, except where records must be retained for legal, tax, or dispute-resolution purposes (e.g. a completed lease’s basic terms). Verification documents are retained only as long as needed to support the listing they relate to.' },
      ],
    },
    {
      title: '7. Your rights',
      blocks: [
        { p: 'As a data principal under the DPDP Act, you can:' },
        { ul: [
          'Access a summary of the personal data we hold about you',
          'Correct or update inaccurate or incomplete data',
          'Request erasure of your data, subject to our legal retention obligations',
          'Withdraw consent for optional processing (e.g. push notifications) at any time',
          'Nominate another individual to exercise these rights on your behalf in the event of your death or incapacity',
          'Lodge a complaint with our Grievance Officer, and escalate to the Data Protection Board of India if unresolved',
        ] },
        { p: 'To exercise any of these, contact us using the details in Section 13.' },
      ],
    },
    {
      title: '8. Cookies & tracking',
      blocks: [
        { p: 'StayOnMap’s authentication is entirely token-based (a JWT stored in browser local storage) — we do not use tracking or advertising cookies, and we do not run third-party analytics scripts that follow visitors across other sites.' },
      ],
    },
    {
      title: '9. Children’s privacy',
      blocks: [
        { p: 'The Platform is intended for users aged 18 and over, consistent with signing legal rental agreements. We do not knowingly collect data from anyone under 18. Anyone who believes a minor has created an account should contact us for removal.' },
      ],
    },
    {
      title: '10. Security',
      blocks: [
        { p: 'We use industry-standard measures to protect data — passwords are hashed (never stored in plain text), verification-document uploads are validated for file type before storage, connections use HTTPS, and access to administrative tools is separately authenticated from user accounts. No system is perfectly secure, and absolute security cannot be guaranteed, but we treat data protection as a continuous responsibility, not a one-time checkbox.' },
      ],
    },
    {
      title: '11. Third-party links',
      blocks: [
        { p: 'Listings may reference third-party services (e.g. a Google Maps direction link). We are not responsible for the privacy practices of sites we do not operate.' },
      ],
    },
    {
      title: '12. Changes to this policy',
      blocks: [
        { p: 'The “Last updated” date above changes whenever this policy changes, and the revised version is posted here. Material changes affecting how data is used will be communicated via email or an in-app notice before they take effect.' },
      ],
    },
    {
      title: '13. Grievance officer & contact',
      blocks: [
        { p: 'For privacy questions, data requests, or complaints, contact our Grievance Officer:' },
        { p: 'Sri Gokul Krishnan' },
        { email: CONTACT_EMAIL },
        { p: `Address: ${ADDRESS}` },
        { note: `StayOnMap currently operates in ${CITY_LIST_LABEL}.` },
      ],
    },
  ],
}

export const TERMS = {
  key: 'terms',
  title: 'Terms of Service',
  sections: [
    {
      title: '1. Acceptance of terms',
      blocks: [
        { p: 'By creating an account or otherwise using StayOnMap’s website, mobile app, or related services (the “Platform”), you agree to these Terms of Service and our Privacy Policy. If you do not agree, please do not use the Platform.' },
        { p: 'StayOnMap is operated by Cosmonus Pvt. Ltd. (“StayOnMap”, “we”, “us”).' },
      ],
    },
    {
      title: '2. Eligibility',
      blocks: [
        { p: 'You must be at least 18 years old and legally capable of entering a binding contract under Indian law to use the Platform. By registering, you confirm this is true.' },
      ],
    },
    {
      title: '3. Account registration & security',
      blocks: [
        { p: 'You are responsible for keeping your login credentials confidential and for all activity under your account. Tell us immediately if you suspect unauthorized access. One account can act as both a tenant and an owner — you become an owner the moment you create your first listing.' },
      ],
    },
    {
      title: '4. Nature of the platform',
      blocks: [
        { lead: 'StayOnMap is a discovery and connection platform — not a broker, agent, landlord, or party to any tenancy.', p: 'We help tenants and owners find each other directly and provide tools (chat, appointment scheduling, lease document tracking) to support that process. We do not inspect properties in person, do not guarantee the accuracy of any listing, and are not a party to any rental agreement, lease, or payment arrangement made between a tenant and an owner.' },
        { p: 'Owner verification (Section 6) is a good-faith check of documents an owner chooses to submit — it reduces risk but is not a guarantee of ownership, legal authority to rent, or property condition. Always verify a listing independently before paying any deposit or signing any agreement.' },
      ],
    },
    {
      title: '5. Tenant & owner roles',
      blocks: [
        { lead: 'Tenants', p: 'can browse listings, save favourites, request visits, chat with owners, sign leases offered to them, and leave reviews.' },
        { lead: 'Owners', p: 'can create and manage listings, respond to visit requests, offer leases, and respond to reviews and reports on their properties.' },
      ],
    },
    {
      title: '6. Listings & verification',
      blocks: [
        { p: 'You may only list a property you own or are legally authorized to rent out. All listing details — rent, deposit, photos, availability — must be accurate and kept up to date. We may ask for verification documents before or after a listing goes live, and may suspend a listing pending review if we receive a credible report about it (see our Community Rules).' },
      ],
    },
    {
      title: '7. Appointments, leases & fees',
      blocks: [
        { p: 'StayOnMap does not charge tenants any commission or brokerage fee, and does not currently charge owners for listing a property. We do not currently process rent or deposit payments through the Platform — any payment arrangement is made directly between tenant and owner, at their own risk. Never send a deposit or rent through a channel that cannot be verified.' },
        { p: 'Lease documents tracked in the Platform (offer, sign, reject, terminate) are a convenience for recording terms both parties agreed to — they do not replace a legally executed rental agreement where one is required by local law.' },
      ],
    },
    {
      title: '8. User conduct',
      blocks: [
        { p: 'You agree to use the Platform honestly and lawfully, and to follow our Community Rules, which are incorporated into these Terms by reference. Prohibited conduct includes (without limitation): posting fake or misleading listings, demanding payment outside the Platform as an unauthorized intermediary, harassment, discrimination, and attempting to circumvent verification or moderation.' },
      ],
    },
    {
      title: '9. Reviews, reports & moderation',
      blocks: [
        { p: 'Reviews and reports must reflect a genuine experience or good-faith concern. We moderate reported content and may remove reviews, suspend listings, or block accounts that violate these Terms or our Community Rules. Reports can be submitted anonymously, but false reports made to harass an owner or tenant are themselves a violation of these Terms.' },
      ],
    },
    {
      title: '10. Intellectual property',
      blocks: [
        { p: 'The StayOnMap name, logo, and platform design are our property. You retain ownership of content you upload (listing photos, descriptions, reviews), but grant us a license to display it on the Platform for the purpose of operating the service.' },
      ],
    },
    {
      title: '11. Disclaimers',
      blocks: [
        { p: 'The Platform is provided “as is” without warranties of any kind, express or implied. We do not warrant that listings are accurate, that owners are who they claim to be beyond what our verification process checks, or that the Platform will be uninterrupted or error-free. TrustScore and risk indicators are computed from available signals (reviews, reports, verification status) and are informational, not a guarantee of safety or legitimacy.' },
      ],
    },
    {
      title: '12. Limitation of liability',
      blocks: [
        { p: 'To the maximum extent permitted by law, StayOnMap and Cosmonus Pvt. Ltd. are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including disputes, losses, or damages arising from a tenancy, lease, or payment arrangement between users — those are between the tenant and owner directly.' },
      ],
    },
    {
      title: '13. Indemnification',
      blocks: [
        { p: 'You agree to indemnify and hold StayOnMap harmless from any claim arising from your listing, your conduct on the Platform, or your violation of these Terms.' },
      ],
    },
    {
      title: '14. Termination & suspension',
      blocks: [
        { p: 'We may suspend or terminate your account for violating these Terms or our Community Rules, including a permanent ban for demanding unauthorized commission as a broker/intermediary (zero tolerance, no warnings). You may delete your account at any time by contacting us.' },
      ],
    },
    {
      title: '15. Governing law & disputes',
      blocks: [
        { p: 'These Terms are governed by the laws of India. Any dispute will be subject to the exclusive jurisdiction of the courts in Chennai, Tamil Nadu.' },
      ],
    },
    {
      title: '16. Changes to these terms',
      blocks: [
        { p: 'We may update these Terms from time to time. The “Last updated” date above will change and, for material changes, we will notify you via email or an in-app notice. Continued use after a change takes effect means you accept the updated Terms.' },
      ],
    },
    {
      title: '17. Contact',
      blocks: [
        { p: 'Questions about these Terms? Email us at:' },
        { email: CONTACT_EMAIL },
      ],
    },
  ],
}

export const LEGAL_DOCS = { privacy: PRIVACY, terms: TERMS }
