import SEOMeta from '@components/common/SEOMeta'
import { canonical } from '@lib/seo'
import { LegalPageLayout, Section } from '@components/common/LegalPageLayout'
import { CITY_LIST_LABEL } from '@/config/cities'

const SECTIONS = [
  { id: 'scope',        label: 'Scope & who we are' },
  { id: 'collect',      label: 'Information we collect' },
  { id: 'use',          label: 'How we use it' },
  { id: 'share',        label: 'How we share it' },
  { id: 'transfer',     label: 'Storage & international transfer' },
  { id: 'retention',    label: 'Data retention' },
  { id: 'rights',       label: 'Your rights' },
  { id: 'cookies',      label: 'Cookies & tracking' },
  { id: 'children',     label: 'Children’s privacy' },
  { id: 'security',     label: 'Security' },
  { id: 'thirdparty',   label: 'Third-party links' },
  { id: 'changes',      label: 'Changes to this policy' },
  { id: 'grievance',    label: 'Grievance officer & contact' },
]

export default function PrivacyPolicyPage() {
  return (
    <>
      <SEOMeta
        title="Privacy Policy"
        description="How StayOnMap collects, uses, and protects your personal data — including owner verification documents."
        canonical={canonical('/privacy')}
      />
      <LegalPageLayout title="Privacy Policy" lastUpdated="July 21, 2026" sections={SECTIONS}>

        <Section id="scope" title="1. Scope & who we are">
          <p>
            This Privacy Policy explains how StayOnMap (&ldquo;StayOnMap&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects,
            uses, shares, and protects personal data when you use our website, mobile app,
            and related services (together, the &ldquo;Platform&rdquo;). It applies to tenants, property
            owners, and visitors browsing without an account.
          </p>
          <p>
            StayOnMap is operated by Cosmonus Pvt. Ltd., registered
            at Vivekanandar Street, Gandhi Nagar, Avadi, Ambattur, Tiruvallur &ndash; 600054, Tamil Nadu. StayOnMap is a data
            fiduciary under India&rsquo;s Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act&rdquo;)
            for the personal data described below.
          </p>
        </Section>

        <Section id="collect" title="2. Information we collect">
          <p><strong>Account information.</strong> Name, email address, city, and a hashed
            password provided at registration. A phone number is optional for browsing and
            booking visits, but <strong>required before you can list a property</strong> &mdash;
            an owner has to be reachable by the people who may live there. Owners and tenants
            share one account system &mdash; the same person can list properties and browse as
            a tenant.</p>
          <p><strong>Owner verification documents.</strong> Listing a property may require
            documents that show authorization to rent it out &mdash; property tax receipts,
            utility bills, sale or rental agreements, title deeds, or business licenses
            (GST, trade license, homestay permit). We do <strong>not</strong> collect
            government identity documents such as Aadhaar or PAN, and we do not request
            selfies. Documents are uploaded directly by the owner and reviewed by our team;
            we do not independently verify them with any government database.</p>
          <p><strong>Listing information.</strong> Property address, coordinates, rent, deposit,
            photos, amenities, and house rules provided when creating a listing.</p>
          <p><strong>Appointments &amp; leases.</strong> Visit requests (date, time, contact
            number, and any message to the owner), and &mdash; if a lease is offered and signed &mdash;
            lease terms (dates, rent, deposit amounts).</p>
          <p><strong>Communications.</strong> Chat messages between tenants and owners about a
            specific property, and any messages sent to us directly (e.g. via the Contact
            page).</p>
          <p><strong>Reviews &amp; reports.</strong> Content submitted when reviewing a property or
            reporting a listing &mdash; reports can optionally be submitted anonymously.</p>
          <p><strong>Location.</strong> Only if you tap the locate button and grant permission.
            The mobile app may request precise device location (and the browser its own
            location) purely to centre the map where you are. It is used in the moment and
            never stored &mdash; we keep no history of your movement, and the app never asks
            for location in the background.</p>
          <p><strong>Contribution record.</strong> If you earn points, we keep a record of the
            actions that earned them &mdash; a review being approved, a report being upheld,
            verifying your email or phone, signing a lease &mdash; with the date and the item it
            relates to. It is visible only to you; there is no public leaderboard and points
            cannot be exchanged for anything.</p>
          <p><strong>Usage &amp; device data.</strong> IP address, browser type, and basic request
            logs, collected automatically for security (rate limiting, abuse prevention) and
            debugging. We do not use third-party advertising trackers or analytics cookies.</p>
          <p><strong>Waitlist signups.</strong> Signing up from a city not supported yet
            stores name, email, and city so we can notify that person when we launch there &mdash;
            it does not create a full account.</p>
        </Section>

        <Section id="use" title="3. How we use it">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Operate core features: browsing listings, booking visits, chat, leases, reviews, and notifications</li>
            <li>Verify property ownership before a listing goes live</li>
            <li>Compute TrustScore and risk indicators shown on listings (based on reviews, reports, and verification status &mdash; not personal documents)</li>
            <li>Send transactional emails and push notifications about appointments, leases, and account activity (never marketing without separate consent)</li>
            <li>Detect and prevent fraud, duplicate listings, and abuse</li>
            <li>Respond to support requests and moderate reported content</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>We do not sell personal data, and we do not use it to serve third-party ads.</p>
        </Section>

        <Section id="share" title="4. How we share it">
          <p><strong>With other users, by design.</strong> A property&rsquo;s owner can see a tenant&rsquo;s
            name, contact number, and message when a visit is requested. Public listing pages
            never show a raw phone number to anonymous visitors &mdash; contact details are only
            shared once someone engages with a listing. Account settings control whether a
            profile is visible to logged-in users only or hidden from certain features.</p>
          <p><strong>Service providers.</strong> A small number of infrastructure
            providers run the Platform, each processing only what is needed for their
            function:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><strong>Supabase</strong> &mdash; stores uploaded property images and verification documents</li>
            <li><strong>Google Cloud Platform</strong> &mdash; hosts our application servers and database</li>
            <li><strong>Google Maps Platform</strong> &mdash; powers map display, address search, and geocoding (search queries and coordinates are sent to Google to resolve locations)</li>
            <li><strong>Our email provider</strong> &mdash; delivers transactional emails (appointment updates, password resets, sign-in codes). Depending on configuration this is either an SMTP provider (currently Google, via Gmail) or <strong>Resend</strong>&rsquo;s transactional API. Your email address and the message content pass through whichever is active.</li>
            <li><strong>Expo</strong>, and through it <strong>Google (FCM)</strong> on Android or <strong>Apple (APNs)</strong> on iOS &mdash; deliver push notifications to your device. The notification&rsquo;s title and text pass through these services.</li>
            <li><strong>Upstash</strong> &mdash; Redis used for caching and rate limiting; holds short-lived technical data, not profile information</li>
            <li><strong>Sentry</strong> &mdash; error monitoring, when enabled. Receives crash and error reports, which can incidentally include the request path and account id involved.</li>
          </ul>
          <p>We do not share data with these providers for their own marketing purposes.</p>
          <p><strong>Not currently enabled.</strong> The Platform can use an AI provider
            (Anthropic) to help detect fraudulent listings and fake reviews. This is switched
            off today and no listing or review content is sent to any AI provider. If we turn
            it on, we will update this policy before doing so.</p>
          <p><strong>Legal &amp; safety.</strong> Information may be disclosed if required by law,
            to enforce our Terms of Service, or to protect the rights, safety, or property of
            StayOnMap, our users, or the public.</p>
          <p><strong>Business transfers.</strong> If StayOnMap is involved in a merger,
            acquisition, or asset sale, information may be transferred as part of that
            transaction, subject to this policy.</p>
        </Section>

        <Section id="transfer" title="5. Storage & international transfer">
          <p>
            Our infrastructure providers may store or process data outside India. Using the
            Platform is treated as consent to this transfer, which we carry out consistent with
            the DPDP Act&rsquo;s requirements for cross-border data transfer.
          </p>
        </Section>

        <Section id="retention" title="6. Data retention">
          <p>
            Account data is kept for as long as an account is active. A request to
            delete an account results in personal data being removed within a reasonable period, except
            where records must be retained for legal, tax, or dispute-resolution
            purposes (e.g. a completed lease&rsquo;s basic terms). Verification documents are
            retained only as long as needed to support the listing they relate to.
          </p>
        </Section>

        <Section id="rights" title="7. Your rights">
          <p>As a data principal under the DPDP Act, you can:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>Access a summary of the personal data we hold about you</li>
            <li>Correct or update inaccurate or incomplete data</li>
            <li>Request erasure of your data, subject to our legal retention obligations</li>
            <li>Withdraw consent for optional processing (e.g. push notifications) at any time</li>
            <li>Nominate another individual to exercise these rights on your behalf in the event of your death or incapacity</li>
            <li>Lodge a complaint with our Grievance Officer, and escalate to the Data Protection Board of India if unresolved</li>
          </ul>
          <p>To exercise any of these, contact us using the details in Section 13.</p>
        </Section>

        <Section id="cookies" title="8. Cookies & tracking">
          <p>
            StayOnMap&rsquo;s authentication is entirely token-based (a JWT stored in browser
            local storage) &mdash; we do not use tracking or advertising cookies, and we do not run
            third-party analytics scripts that follow visitors across other sites.
          </p>
        </Section>

        <Section id="children" title="9. Children’s privacy">
          <p>
            The Platform is intended for users aged 18 and over, consistent with signing legal
            rental agreements. We do not knowingly collect data from anyone under 18. Anyone
            who believes a minor has created an account should contact us for removal.
          </p>
        </Section>

        <Section id="security" title="10. Security">
          <p>
            We use industry-standard measures to protect data &mdash; passwords are hashed
            (never stored in plain text), verification-document uploads are validated for file
            type before storage, connections use HTTPS, and access to administrative tools is
            separately authenticated from user accounts. No system is perfectly secure, and
            absolute security cannot be guaranteed, but we treat data protection as a continuous
            responsibility, not a one-time checkbox.
          </p>
        </Section>

        <Section id="thirdparty" title="11. Third-party links">
          <p>
            Listings may reference third-party services (e.g. a Google Maps direction link).
            We are not responsible for the privacy practices of sites we do not operate.
          </p>
        </Section>

        <Section id="changes" title="12. Changes to this policy">
          <p>
            The &ldquo;Last updated&rdquo; date above changes whenever this policy changes, and the
            revised version is posted here. Material changes affecting how data is used will be
            communicated via email or an in-app notice before they take effect.
          </p>
        </Section>

        <Section id="grievance" title="13. Grievance officer & contact">
          <p>
            For privacy questions, data requests, or complaints, contact our Grievance Officer:
          </p>
          <p>
            Sri Gokul Krishnan<br />
            Email: <a href="mailto:hello@cosmonus.com" className="text-brand-600">hello@cosmonus.com</a><br />
            Address: Vivekanandar Street, Gandhi Nagar, Avadi, Ambattur, Tiruvallur &ndash; 600054, Tamil Nadu
          </p>
          <p className="text-xs text-slate-400">
            StayOnMap currently operates in {CITY_LIST_LABEL}.
          </p>
        </Section>

      </LegalPageLayout>
    </>
  )
}
