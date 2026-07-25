import { colors } from '@theme/colors'

// The seven PropertyStatus values, each with what it MEANS for the owner.
// "DRAFT" names the database column; "Not published yet" says why nobody can
// see it.
//
// Shared because MyListings and ManageListing both need it and had separate
// copies. That divergence already cost something: OCCUPIED was dropped from the
// MyListings copy on the grounds that it "isn't a PropertyStatus" — it is
// (prisma/schema.prisma, set by markTenant along with currentTenantId and
// occupiedSince). `.claude/database.md` omits it and is wrong; the schema is
// authoritative. A rented-out listing was falling through to the DRAFT entry
// and being labelled "Not published yet".
export const LISTING_STATUS = {
  DRAFT:     { bg: colors.slate100,  text: colors.slate600,   label: 'Draft',     meaning: 'Not published yet' },
  PENDING:   { bg: colors.warning50, text: colors.warning700, label: 'In review', meaning: 'Waiting on moderation' },
  ACTIVE:    { bg: colors.success50, text: '#15803D',         label: 'Live',      meaning: 'Visible to renters' },
  INACTIVE:  { bg: colors.slate100,  text: colors.slate600,   label: 'Paused',    meaning: 'Hidden from search' },
  OCCUPIED:  { bg: '#EEF2FF',        text: '#4338CA',         label: 'Rented',    meaning: 'Currently occupied' },
  SUSPENDED: { bg: colors.danger50,  text: colors.danger600,  label: 'Suspended', meaning: 'Removed by moderation' },
  REJECTED:  { bg: colors.danger50,  text: colors.danger600,  label: 'Rejected',  meaning: 'Needs changes before it can go live' },
}

export const statusOf = (status) => LISTING_STATUS[status] ?? LISTING_STATUS.DRAFT
