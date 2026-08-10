/**
 * Unmet search demand — what people asked for and we could not show them.
 *
 * This file exists because the card had ZERO coverage until 2026-08-10, and the
 * gap was not theoretical: an edit that broke its JSX parse ran a full green
 * suite. Nothing imports DemandCard except AdminPage, which no test renders, so
 * vitest never transformed the file. Only `npm run lint` caught it.
 *
 * Two things worth pinning beyond "it renders":
 *   1. Zero and unknown must not look alike. "No searches recorded yet" is a
 *      different claim from "0% of searches found nothing", and only one of
 *      them is true on day one.
 *   2. The rows are ACTIONABLE. This is the most actionable data on the admin
 *      page — the one readout pointing at a specific listing to go and find —
 *      and until 2026-08-10 it offered no way to act on itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const demand = vi.fn()
vi.mock('@services/admin.service', () => ({ adminService: { demand: () => demand() } }))

const { default: DemandCard } = await import('./DemandCard')

const ROW = {
  cellGeohash: 'tdr1y', city: 'Chennai', type: 'APARTMENT',
  bhk: 2, rentBand: '20000-30000', pricingModel: 'RENT', zeroResults: 14,
}

beforeEach(() => vi.clearAllMocks())

async function renderWith(data) {
  demand.mockResolvedValue({ data })
  const view = renderWithProviders(<DemandCard />)
  await waitFor(() => expect(demand).toHaveBeenCalled())
  return view
}

describe('before anyone has searched', () => {
  it('says nothing is recorded rather than claiming every search succeeded', async () => {
    await renderWith({ days: 30, searches: 0, zeroResultRate: 0, unmet: [] })
    expect(await screen.findByText(/No searches recorded yet/i)).toBeTruthy()
    // The inversion to avoid: 0% reads as "every search found something".
    expect(screen.queryByText('0%')).toBeNull()
  })
})

describe('with demand recorded', () => {
  it('describes the ask as a sentence, not a filter dump', async () => {
    await renderWith({ days: 30, searches: 120, zeroResultRate: 38, unmet: [ROW] })
    expect(await screen.findByText(/2 BHK Flats/)).toBeTruthy()
    expect(screen.getByText('38%')).toBeTruthy()
  })

  it('makes each row openable — the action the number implies', async () => {
    await renderWith({ days: 30, searches: 120, zeroResultRate: 38, unmet: [ROW] })
    const row = await screen.findByText(/2 BHK Flats/)
    expect(
      row.closest('button'),
      'the most actionable readout on the page offers no action',
    ).toBeTruthy()
  })

  it('says so when every search found something, rather than rendering an empty list', async () => {
    await renderWith({ days: 30, searches: 40, zeroResultRate: 0, unmet: [] })
    expect(await screen.findByText(/returned at least one listing/i)).toBeTruthy()
  })
})
