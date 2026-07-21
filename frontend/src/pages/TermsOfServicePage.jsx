import { Link } from 'react-router-dom'
import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { LegalPageLayout, Section } from '@components/common/LegalPageLayout'

const SECTIONS = [
  { id: 'acceptance',   label: 'Acceptance of terms' },
  { id: 'eligibility',  label: 'Eligibility' },
  { id: 'account',      label: 'Account registration & security' },
  { id: 'nature',       label: 'Nature of the platform' },
  { id: 'roles',        label: 'Tenant & owner roles' },
  { id: 'listings',     label: 'Listings & verification' },
  { id: 'appointments', label: 'Appointments, leases & fees' },
  { id: 'conduct',      label: 'User conduct' },
  { id: 'reviews',      label: 'Reviews, reports & moderation' },
  { id: 'ip',           label: 'Intellectual property' },
  { id: 'disclaimers',  label: 'Disclaimers' },
  { id: 'liability',    label: 'Limitation of liability' },
  { id: 'indemnity',    label: 'Indemnification' },
  { id: 'termination',  label: 'Termination & suspension' },
  { id: 'law',          label: 'Governing law & disputes' },
  { id: 'changes',      label: 'Changes to these terms' },
  { id: 'contact',      label: 'Contact' },
]

export default function TermsOfServicePage() {
  return (
    <>
      <SEOMeta
        title="Terms of Service"
        description="The rules and disclaimers that govern your use of StayOnMap."
        canonical={canonical('/terms')}
      />
      <LegalPageLayout title="Terms of Service" lastUpdated="July 21, 2026" sections={SECTIONS}>

        <Section id="acceptance" title="1. Acceptance of terms">
          <p>
            By creating an account or otherwise using StayOnMap&rsquo;s website, mobile app, or
            related services (the &ldquo;Platform&rdquo;), you agree to these Terms of Service and our{' '}
            <Link to="/privacy" className="text-brand-600">Privacy Policy</Link>. If you do not
            agree, please do not use the Platform.
          </p>
          <p>
            StayOnMap is operated by Cosmonus Pvt. Ltd.{' '}
            (&ldquo;StayOnMap&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          </p>
        </Section>

        <Section id="eligibility" title="2. Eligibility">
          <p>
            You must be at least 18 years old and legally capable of entering a binding
            contract under Indian law to use the Platform. By registering, you confirm this
            is true.
          </p>
        </Section>

        <Section id="account" title="3. Account registration & security">
          <p>
            You are responsible for keeping your login credentials confidential and for all
            activity under your account. Tell us immediately if you suspect unauthorized
            access. One account can act as both a tenant and an owner &mdash; you become an owner
            the moment you create your first listing.
          </p>
        </Section>

        <Section id="nature" title="4. Nature of the platform">
          <p>
            <strong>StayOnMap is a discovery and connection platform &mdash; not a broker, agent,
            landlord, or party to any tenancy.</strong> We help tenants and owners find each
            other directly and provide tools (chat, appointment scheduling, lease document
            tracking) to support that process. We do not inspect properties in person, do not
            guarantee the accuracy of any listing, and are not a party to any rental agreement,
            lease, or payment arrangement made between a tenant and an owner.
          </p>
          <p>
            Owner verification (Section 6) is a good-faith check of documents an owner
            chooses to submit &mdash; it reduces risk but is not a guarantee of ownership, legal
            authority to rent, or property condition. Always verify a listing independently
            before paying any deposit or signing any agreement.
          </p>
        </Section>

        <Section id="roles" title="5. Tenant & owner roles">
          <p><strong>Tenants</strong> can browse listings, save favourites, request visits,
            chat with owners, sign leases offered to them, and leave reviews.</p>
          <p><strong>Owners</strong> can create and manage listings (up to 3 active listings on
            the free tier), respond to visit requests, offer leases, and respond to reviews
            and reports on their properties.</p>
        </Section>

        <Section id="listings" title="6. Listings & verification">
          <p>
            You may only list a property you own or are legally authorized to rent out. All
            listing details &mdash; rent, deposit, photos, availability &mdash; must be accurate and kept
            up to date. We may ask for verification documents before or after a listing goes
            live, and may suspend a listing pending review if we receive a credible report
            about it (see <Link to="/rules" className="text-brand-600">Community Rules</Link>).
          </p>
        </Section>

        <Section id="appointments" title="7. Appointments, leases & fees">
          <p>
            StayOnMap does not charge tenants any commission or brokerage fee, and does not
            currently charge owners for listing a property (free tier: up to 3 active
            listings). We do not currently process rent or deposit payments through the
            Platform &mdash; any payment arrangement is made directly between tenant and owner, at
            their own risk. Never send a deposit or rent through a channel that cannot be verified.
          </p>
          <p>
            Lease documents tracked in the Platform (offer, sign, reject, terminate) are a
            convenience for recording terms both parties agreed to &mdash; they do not replace a
            legally executed rental agreement where one is required by local law.
          </p>
        </Section>

        <Section id="conduct" title="8. User conduct">
          <p>
            You agree to use the Platform honestly and lawfully, and to follow our{' '}
            <Link to="/rules" className="text-brand-600">Community Rules</Link>, which are
            incorporated into these Terms by reference. Prohibited conduct includes (without
            limitation): posting fake or misleading listings, demanding payment outside the
            Platform as an unauthorized intermediary, harassment, discrimination, and
            attempting to circumvent verification or moderation.
          </p>
        </Section>

        <Section id="reviews" title="9. Reviews, reports & moderation">
          <p>
            Reviews and reports must reflect a genuine experience or good-faith concern. We
            moderate reported content and may remove reviews, suspend listings, or block
            accounts that violate these Terms or our Community Rules. Reports can be submitted
            anonymously, but false reports made to harass an owner or tenant are themselves a
            violation of these Terms.
          </p>
        </Section>

        <Section id="ip" title="10. Intellectual property">
          <p>
            The StayOnMap name, logo, and platform design are our property. You retain
            ownership of content you upload (listing photos, descriptions, reviews), but grant
            us a license to display it on the Platform for the purpose of operating the
            service.
          </p>
        </Section>

        <Section id="disclaimers" title="11. Disclaimers">
          <p>
            The Platform is provided &ldquo;as is&rdquo; without warranties of any kind, express or
            implied. We do not warrant that listings are accurate, that owners are who they
            claim to be beyond what our verification process checks, or that the Platform will
            be uninterrupted or error-free. TrustScore and risk indicators are computed from
            available signals (reviews, reports, verification status) and are informational,
            not a guarantee of safety or legitimacy.
          </p>
        </Section>

        <Section id="liability" title="12. Limitation of liability">
          <p>
            To the maximum extent permitted by law, StayOnMap and{' '}
            Cosmonus Pvt. Ltd. are not liable for any indirect,
            incidental, or consequential damages arising from your use of the Platform,
            including disputes, losses, or damages arising from a tenancy, lease, or payment
            arrangement between users &mdash; those are between the tenant and owner directly.
          </p>
        </Section>

        <Section id="indemnity" title="13. Indemnification">
          <p>
            You agree to indemnify and hold StayOnMap harmless from any claim arising from
            your listing, your conduct on the Platform, or your violation of these Terms.
          </p>
        </Section>

        <Section id="termination" title="14. Termination & suspension">
          <p>
            We may suspend or terminate your account for violating these Terms or our
            Community Rules, including a permanent ban for demanding unauthorized commission
            as a broker/intermediary (zero tolerance, no warnings &mdash; see{' '}
            <Link to="/rules" className="text-brand-600">Community Rules</Link>). You may
            delete your account at any time by contacting us.
          </p>
        </Section>

        <Section id="law" title="15. Governing law & disputes">
          <p>
            These Terms are governed by the laws of India. Any dispute will be subject to the
            exclusive jurisdiction of the courts in Chennai, Tamil Nadu.
          </p>
        </Section>

        <Section id="changes" title="16. Changes to these terms">
          <p>
            We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date
            above will change and, for material changes, we will notify you via email or an in-app notice.
            Continued use after a change takes effect means you accept the updated Terms.
          </p>
        </Section>

        <Section id="contact" title="17. Contact">
          <p>
            Questions about these Terms? Email us at{' '}
            <a href="mailto:hello@cosmonus.com" className="text-brand-600">hello@cosmonus.com</a>.
          </p>
        </Section>

      </LegalPageLayout>
    </>
  )
}
