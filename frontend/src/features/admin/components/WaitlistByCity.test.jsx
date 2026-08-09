/**
 * The rollup that answers "which city next".
 *
 * The data has been in `WaitlistEntry` for a year and was only ever rendered as
 * a paginated list, so nobody could see it. The failure worth pinning is the
 * silent one: a rollup derived from the twenty rows on screen looks exactly
 * like a rollup over every entry, and ranks cities by who signed up most
 * recently rather than by demand.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import WaitlistByCity from './WaitlistByCity'

const ROWS = [
  { city: 'Kochi', count: 12, lastSignup: '2026-08-01T00:00:00.000Z' },
  { city: 'Jaipur', count: 3, lastSignup: '2026-08-08T00:00:00.000Z' },
]

describe('WaitlistByCity', () => {
  it('renders each city with its count', () => {
    renderWithProviders(<WaitlistByCity rows={ROWS} />)
    expect(screen.getByText('Kochi')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Jaipur')).toBeTruthy()
  })

  it('keeps the order the server sent', () => {
    // Sorted by COUNT server-side. Re-sorting here — or rendering an object's
    // key order — would put the most recent signup on top and answer a
    // different question under the same heading.
    renderWithProviders(<WaitlistByCity rows={ROWS} />)
    const cities = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(cities[0]).toContain('Kochi')
    expect(cities[1]).toContain('Jaipur')
  })

  it('says the count covers every entry, not the page on screen', () => {
    renderWithProviders(<WaitlistByCity rows={ROWS} />)
    expect(screen.getByText(/counted across every entry/i)).toBeTruthy()
  })

  it('renders nothing at all when there is no waitlist', () => {
    // A heading above an empty box is the bug the spatial panel shipped with
    // once — see .claude/ui-ux.md.
    const { container } = renderWithProviders(<WaitlistByCity rows={[]} />)
    expect(container.textContent).toBe('')
  })

  it('survives a row with no signup date', () => {
    const { container } = renderWithProviders(<WaitlistByCity rows={[{ city: 'Surat', count: 1, lastSignup: null }]} />)
    expect(screen.getByText('Surat')).toBeTruthy()
    expect(container.textContent).not.toContain('Invalid Date')
  })
})
