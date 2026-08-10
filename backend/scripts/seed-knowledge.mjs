/**
 * Seed the help centre.
 *
 * Idempotent — upserts by slug, so re-running edits rather than duplicates.
 *
 * TEN articles, and that is the point. Every one answers a question this
 * product actually raises, and each was written from the behaviour in the code
 * rather than from what a rental platform generally does: the 11-month lock-in,
 * the lease lump sum, anonymous reporting, points that are not redeemable, the
 * city gate. A help centre padded to fifty makes the ten that matter harder to
 * find, and an article describing a feature we do not have is worse than none.
 *
 * Run:  node --env-file=.env scripts/seed-knowledge.mjs
 */
// The singleton, not `new PrismaClient()` — .claude/database.md's rule, and
// under Prisma 7 it is not a style preference. Prisma 7 removed schema-level
// `url = env(...)`, so a bare constructor throws
// PrismaClientInitializationError before it reaches a single query: the client
// now needs an explicit PrismaPg driver adapter, which src/lib/prisma.js is the
// one place that builds. This script shipped with the bare form and could never
// have run.
import { prisma } from '../src/lib/prisma.js'

const CATEGORIES = [
  { slug: 'renting', title: 'Renting a home', description: 'Searching, visiting and signing.', order: 1 },
  { slug: 'listing', title: 'Listing a property', description: 'Publishing and managing a listing.', order: 2 },
  { slug: 'money', title: 'Rent, lease and deposits', description: 'What you pay, and when.', order: 3 },
  { slug: 'safety', title: 'Trust & safety', description: 'Reporting, verification and privacy.', order: 4 },
  { slug: 'account', title: 'Your account', description: 'Sign-in, profile and data.', order: 5 },
]

const ARTICLES = [
  {
    slug: 'what-lease-means',
    category: 'money',
    title: 'What "lease" means on StayOnMap (and why there is no monthly rent)',
    audience: null,
    body: `A listing on StayOnMap is priced one of two ways, and they are completely different arrangements.

**Rent** — you pay every month, plus a refundable security deposit.

**Lease** — you pay ONE large refundable amount at the start and no monthly rent at all. The owner holds the sum, and returns it when the tenancy ends. This is the arrangement common across much of South India.

On a lease listing you will see a price like "₹8,00,000 lease" — that is the lump sum, not a monthly figure. There is no separate deposit, because the lease amount is the refundable sum.

You may still see a monthly **maintenance** charge on a flat or a house. That is not rent: it is the society or association charge for lifts, security, water pumps and common lighting, and it is paid to the association rather than to the owner.`,
  },
  {
    slug: 'lock-in-and-notice',
    category: 'money',
    title: 'Lock-in period and notice period — what is the difference?',
    audience: null,
    body: `Most Indian rental agreements carry both, and they are not the same thing.

**Lock-in (shown as "minimum stay" on homes)** — the period during which you have committed to stay. Leaving earlier usually means forfeiting the deposit or paying the remaining rent. Six months is common on a home; commercial spaces are often much longer.

**Notice period** — how far in advance you must tell the owner you are leaving, once the lock-in has passed. One month is typical.

Both are set by the owner on the listing, so you can see them before you visit. You can also filter by maximum notice period when you search.

A note on agreement length: most Indian residential agreements are written for 11 months. That is not a StayOnMap rule — a tenancy of 12 months or more must be registered under the Registration Act, and 11 months avoids that.`,
  },
  {
    slug: 'zero-brokerage',
    category: 'renting',
    title: 'Is there really no brokerage?',
    audience: null,
    body: `StayOnMap is broker-free by design. You talk to the owner directly, and we charge you nothing to find, visit or take a home.

If an owner does charge a brokerage, they have to declare it on the listing and it is shown to you before you contact them. Most listings show zero.

If somebody asks you for a fee to "confirm" a viewing, to "block" a property, or to release keys, that is worth reporting — see *Reporting a listing*.`,
  },
  {
    slug: 'booking-a-visit',
    category: 'renting',
    title: 'Booking a visit',
    audience: 'TENANT',
    body: `Open a listing and request a visit. Pick a date and a time inside the window the owner has set — you will only be offered times they have said they are available.

The owner accepts, declines or proposes a different time, and you are notified either way. Nothing is confirmed until they accept.

You can see every visit you have requested under Appointments, and cancel one you no longer want from the same place you requested it.`,
  },
  {
    slug: 'reporting-a-listing',
    category: 'safety',
    title: 'Reporting a listing',
    audience: null,
    body: `If a listing is fraudulent, misleading, unsafe or is a broker posing as an owner, report it from the listing page.

**You can report anonymously.** If you do, we cannot write back to you — so if you are willing to be contacted, leave your name on it. Either way the report reaches our moderation queue.

**The owner never learns who reported them.** They are told a concern was raised and can respond to it, and they never see your name or your messages to us.

We will tell you what we decided, including when we found nothing — a report that gets no answer is a report you were right not to trust us with.`,
  },
  {
    slug: 'owner-verification',
    category: 'safety',
    title: 'What the Verified Owner badge means',
    audience: null,
    body: `A verified owner has submitted documents showing they own or are entitled to let the property, and a person on our team has reviewed them.

It is a judgement made by a human, not an automated check, and it is not a guarantee about the property itself — it is a statement that we have seen evidence of who the owner is.

Listings without the badge are not necessarily suspect; many owners simply have not submitted documents yet.`,
  },
  {
    slug: 'what-we-show-about-you',
    category: 'safety',
    title: 'What other people can see about you',
    audience: null,
    body: `Your phone number is only ever shown to somebody you are already in a conversation with, and only if you have chosen to share it. If you set contact visibility to nobody, there is simply no call button — the other person is not told you declined.

Owners do not see the names of people who report their listing.

Your points are visible only to you. There is no leaderboard, and there never will be.`,
  },
  {
    slug: 'publishing-a-listing',
    category: 'listing',
    title: 'Publishing a listing',
    audience: 'OWNER',
    body: `Adding a listing takes six steps: what it is, where it is, photos, features, price, and a review before you publish.

You can leave at any point and come back — a half-finished listing is saved to your account, not just to the device you started on.

Once you publish, the listing goes to our team for review before it appears on the map. That is usually quick, and you are notified when it goes live.

**Photos matter more than anything else you will do here.** A listing with no photos is opened a fraction as often as one with three.`,
  },
  {
    slug: 'business-listings',
    category: 'listing',
    title: 'Why PG, commercial and short-stay need a business account',
    audience: 'OWNER',
    body: `Flats, houses and land can be listed on any account.

PG / co-living, commercial spaces and short-stay listings need a business account. These are operated rather than let — they involve more people, more turnover and more regulatory weight — and the extra step is deliberate.

Upgrading is free at the moment and takes one click from your account. It applies to new listings only; nothing you have already published is affected.`,
  },
  {
    slug: 'city-not-supported',
    category: 'account',
    title: 'My city is not on StayOnMap',
    audience: null,
    body: `StayOnMap is currently open in nine cities: Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Ahmedabad, Pune and Surat.

If you signed up from somewhere else, you are on the waiting list rather than in an account — we would rather tell you that than let you sign up into an empty map.

We open cities where there is enough supply for a search to be worth doing. Being on the list is what tells us where to go next.`,
  },
]

async function main() {
  const byslug = {}
  for (const c of CATEGORIES) {
    const row = await prisma.knowledgeCategory.upsert({
      where: { slug: c.slug },
      update: { title: c.title, description: c.description, order: c.order },
      create: c,
    })
    byslug[c.slug] = row.id
  }

  for (const a of ARTICLES) {
    const data = {
      title: a.title,
      body: a.body,
      categoryId: byslug[a.category],
      audience: a.audience,
      // Seeded articles are published: they were written to be read, and a seed
      // that leaves everything in draft looks like a broken help centre.
      published: true,
    }
    await prisma.knowledgeArticle.upsert({
      where: { slug: a.slug },
      update: data,
      create: { slug: a.slug, ...data },
    })
  }

  console.log(`seeded ${CATEGORIES.length} categories, ${ARTICLES.length} articles`)
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
