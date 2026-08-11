/**
 * The visit window cannot be set inside-out.
 *
 * `properties.validation.js` rejects `start >= end` with "Window start must be
 * before end". The wizard had no matching check, so an owner could set "visits
 * from 8 PM until 9 AM" on step 5, finish the wizard, and meet a raw server
 * error at Publish — with nothing on the page saying which of the two fields
 * was wrong.
 *
 * The fix is not a better error message. It is that the option is never offered:
 * `.claude/ui-ux.md` says the same about the old listing cap — disable the
 * thing, never hand someone a rejection.
 *
 * Bounds are EXCLUSIVE. A window that opens and closes at the same minute is not
 * a window, and the server agrees (`<`, not `<=`).
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import TimeSelect from './TimeSelect'
import { VISIT_SLOTS } from '@utils/time'

const openList = async (user, name) => {
  await user.click(screen.getByRole('combobox', { name }))
  return screen.getAllByRole('option').map((o) => o.textContent)
}

describe('TimeSelect bounds', () => {
  it('offers every slot when unbounded', async () => {
    const { user } = renderWithProviders(
      <TimeSelect label="Visits from" slots={VISIT_SLOTS} value="" onChange={() => {}} />,
    )
    const labels = await openList(user, /visits from/i)
    expect(labels).toHaveLength(VISIT_SLOTS.length)
  })

  it('offers only times AFTER the start', async () => {
    const { user } = renderWithProviders(
      <TimeSelect label="Visits until" slots={VISIT_SLOTS} after="17:00" value="" onChange={() => {}} />,
    )
    const labels = await openList(user, /visits until/i)
    expect(labels[0]).toBe('5:30 PM')
    expect(labels).not.toContain('5:00 PM')   // exclusive — not a window
    expect(labels).not.toContain('9:00 AM')
  })

  it('offers only times BEFORE the end', async () => {
    const { user } = renderWithProviders(
      <TimeSelect label="Visits from" slots={VISIT_SLOTS} before="10:00" value="" onChange={() => {}} />,
    )
    const labels = await openList(user, /visits from/i)
    expect(labels).toEqual(['9:00 AM', '9:30 AM'])
  })

  it('leaves nothing to pick when the bounds meet, rather than offering a bad answer', async () => {
    // An empty list is honest here: with the start at 8 PM, which is the last
    // visit slot, there is genuinely no valid end. Better than offering one the
    // server will refuse.
    const { user } = renderWithProviders(
      <TimeSelect label="Visits until" slots={VISIT_SLOTS} after="20:00" value="" onChange={() => {}} />,
    )
    await user.click(screen.getByRole('combobox', { name: /visits until/i }))
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('keeps the none option under bounds — it is not a time', async () => {
    // "No curfew" is the absence of an answer and must survive filtering.
    const { user } = renderWithProviders(
      <TimeSelect label="Curfew" after="22:00" allowNone value="" onChange={() => {}} />,
    )
    const labels = await openList(user, /curfew/i)
    expect(labels[0]).toBe('No curfew')
    expect(labels[1]).toBe('10:30 PM')
  })

  it('shows 12-hour labels while the value stays 24-hour', async () => {
    // The contract utils/time.js exists for: the API takes HH:MM, people read
    // AM/PM, and the two must not leak into each other.
    const picked = []
    const { user } = renderWithProviders(
      <TimeSelect label="Visits from" slots={VISIT_SLOTS} value="" onChange={(v) => picked.push(v)} />,
    )
    await user.click(screen.getByRole('combobox', { name: /visits from/i }))
    await user.click(screen.getByRole('option', { name: '6:00 PM' }))
    expect(picked).toEqual(['18:00'])
  })
})
