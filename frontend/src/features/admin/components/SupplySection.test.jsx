/**
 * The supply readouts, and the four sentences they must never say.
 *
 * These cards exist because a marketplace with ~13 listings cannot be judged by
 * its renter funnel. What makes them worth testing is not the arithmetic — the
 * backend owns that, and `marketplace-metrics.test.js` pins it — but the
 * FAILURE MODE: every one of these numbers is plausible when wrong, and the
 * card is silent about it. A zero that should be an em-dash reads as a healthy
 * platform with nothing to fix, and nobody goes looking.
 *
 * So each test below asserts an absence as much as a presence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const marketplace = vi.fn()
vi.mock('@services/admin.service', () => ({ adminService: { marketplace: (params) => marketplace(params) } }))

const { default: SupplySection } = await import('./SupplySection')

// The shape the endpoint actually returns, with everything empty — a fresh
// deployment, which is the state these cards spend their first weeks in.
const EMPTY = {
  supply: { weeks: 12, publishedTrackedSince: '2026-08-10', series: [] },
  drafts: { days: 90, staleDays: 7, open: 0, stale: 0, medianAgeHours: null, byStep: [] },
  responsiveness: { days: 30, conversations: 0, answered: 0, neverAnswered: 0, medianMinutes: null, p90Minutes: null },
  chain: { days: 90, steps: [{ key: 'conversations', label: 'Conversations started', count: 0 }], medianDaysToLease: null, samples: 0 },
  dead: { days: 30, live: 0, unseen: 0, seenButUncontacted: 0, worst: [] },
  readiness: { live: 0, photos: { none: 0, few: 0, enough: 0 }, noDescription: 0, verified: 0, worst: [] },
}

const withData = (over) => ({ ...EMPTY, ...over })

beforeEach(() => vi.clearAllMocks())

async function renderWith(data) {
  marketplace.mockResolvedValue({ data })
  const view = renderWithProviders(<SupplySection />)
  await waitFor(() => expect(marketplace).toHaveBeenCalled())
  return view
}

describe('an empty deployment', () => {
  it('says nothing has happened yet, never that the numbers are zero', async () => {
    await renderWith(EMPTY)
    // "No renter has messaged an owner yet" is a different claim from "0 minute
    // median reply time", and only one of them is true on day one.
    expect(await screen.findByText(/No renter has messaged an owner yet/i)).toBeTruthy()
    expect(screen.getByText(/Nobody has a listing half-written/i)).toBeTruthy()
  })

  it('renders every card rather than hiding the ones with no data', async () => {
    // A card that disappears when empty means the operator cannot tell "we
    // measure this and it is zero" from "we do not measure this".
    await renderWith(EMPTY)
    // findBy first: waitFor(mock called) only proves the request went out, and
    // the cards are still skeletons for a tick after it resolves.
    expect(await screen.findByText('New listings by week')).toBeTruthy()
    for (const heading of [
      'Unfinished listings',
      'Owner reply time',
      'Conversation to tenancy',
      'Listings nobody is looking at',
      'Are the listings good enough',
    ]) {
      expect(screen.getByText(heading), `${heading} card is missing`).toBeTruthy()
    }
  })
})

describe('owner reply time', () => {
  it('leads with how many renters were never answered', async () => {
    await renderWith(withData({
      responsiveness: { days: 30, conversations: 10, answered: 6, neverAnswered: 4, medianMinutes: 45, p90Minutes: 900 },
    }))
    expect(await screen.findByText(/never answered/i)).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('45m')).toBeTruthy()
  })

  it('shows an em-dash, not 0m, when nobody has replied at all', async () => {
    // 0m would read as "owners reply instantly" — the exact inversion of what
    // a null median means.
    await renderWith(withData({
      responsiveness: { days: 30, conversations: 3, answered: 0, neverAnswered: 3, medianMinutes: null, p90Minutes: null },
    }))
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThan(0))
    expect(screen.queryByText('0m')).toBeNull()
  })
})

describe('the draft funnel', () => {
  it('names the step people stalled on', async () => {
    await renderWith(withData({
      drafts: { days: 90, staleDays: 7, open: 3, stale: 1, medianAgeHours: 30, byStep: [{ stepKey: 'photos', count: 2 }, { stepKey: 'price', count: 1 }] },
    }))
    expect(await screen.findByText('Photos')).toBeTruthy()
    expect(screen.getByText('Price')).toBeTruthy()
  })

  it('falls back to the raw key for a step this build does not know', async () => {
    // A wizard step added on mobile and not yet mirrored here must show up as
    // itself, not vanish from the chart.
    await renderWith(withData({
      drafts: { days: 90, staleDays: 7, open: 1, stale: 0, medianAgeHours: 2, byStep: [{ stepKey: 'brand_new_step', count: 1 }] },
    }))
    expect(await screen.findByText('brand_new_step')).toBeTruthy()
  })
})

describe('the supply trend', () => {
  it('discloses the date from which going-live is known', async () => {
    // Otherwise the missing early bars read as "we published nothing".
    await renderWith(withData({
      supply: {
        weeks: 12,
        publishedTrackedSince: '2026-08-10',
        series: [{ week: '2026-08-03', created: 4, published: 0, left: 0, net: 0 }],
      },
    }))
    expect(await screen.findByText(/only recorded from 2026-08-10/i)).toBeTruthy()
  })

  it('states the net beside its parts', async () => {
    await renderWith(withData({
      supply: {
        weeks: 12,
        publishedTrackedSince: '2026-08-10',
        series: [
          { week: '2026-08-03', created: 5, published: 5, left: 2, net: 3 },
          { week: '2026-08-10', created: 1, published: 1, left: 3, net: -2 },
        ],
      },
    }))
    // +1 over the two weeks, and the sign is shown: a net can be negative, and
    // "1" without it reads as growth.
    expect(await screen.findByText('+1')).toBeTruthy()
    expect(screen.getByText(/left the market/i)).toBeTruthy()
  })
})

describe('dead inventory', () => {
  it('keeps the two failure modes apart', async () => {
    // No views is a visibility problem; views with no messages is a listing
    // problem. Summed, they point at neither.
    await renderWith(withData({
      dead: {
        days: 30, live: 9, unseen: 4, seenButUncontacted: 2,
        worst: [{ id: 'p1', title: 'Quiet 2BHK', city: 'Chennai', views: 0, conversations: 0 }],
      },
    }))
    expect(await screen.findByText(/never opened/i)).toBeTruthy()
    expect(screen.getByText(/seen, never messaged/i)).toBeTruthy()
    expect(screen.getByText('Quiet 2BHK')).toBeTruthy()
  })
})

describe('the time window', () => {
  it('asks for 30 days until told otherwise', async () => {
    await renderWith(EMPTY)
    expect(marketplace).toHaveBeenCalledWith({ days: 30 })
  })

  it('refetches for the window the operator picked', async () => {
    marketplace.mockResolvedValue({ data: EMPTY })
    const { user } = renderWithProviders(<SupplySection />)
    await screen.findByText('New listings by week')

    await user.click(screen.getByRole('button', { name: '7 days' }))
    await waitFor(() => expect(marketplace).toHaveBeenLastCalledWith({ days: 7 }))
  })

  it('marks the active window for assistive tech, not just visually', async () => {
    // A segmented control that only differs by colour tells a screen reader
    // nothing about which question is on screen.
    await renderWith(EMPTY)
    expect(await screen.findByRole('button', { name: '30 days' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-pressed')).toBe('false')
  })
})

describe('when the endpoint fails', () => {
  it('keeps the window picker on screen while the first load is in flight', async () => {
    // The moment you most want to try another window is when the screen is
    // empty and you are wondering whether that is real.
    marketplace.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<SupplySection />)
    expect(await screen.findByRole('button', { name: '30 days' })).toBeTruthy()
  })

  it('says so and offers a retry, rather than rendering empty cards', async () => {
    // The dangerous version of this failure is a screen full of zeroes that
    // looks like a working platform with no activity.
    marketplace.mockRejectedValue(new Error('boom'))
    renderWithProviders(<SupplySection />)
    expect(await screen.findByText(/Could not load supply metrics/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
    // And the picker survives the error, for the same reason.
    expect(screen.getByRole('button', { name: '90 days' })).toBeTruthy()
    expect(screen.queryByText('Owner reply time')).toBeNull()
  })
})
