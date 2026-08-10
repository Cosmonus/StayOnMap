/**
 * Picking a day and a time for a visit.
 *
 * Two user-reported faults, and both are the kind that look like a design
 * choice rather than a bug:
 *
 *   1. The day strip is `overflow-x-auto no-scrollbar`, which is right on a
 *      phone — you swipe it — and left desktop with nothing at all: no
 *      scrollbar to drag (we hid it) and no arrows. A mouse user reached about
 *      the first week and had no way to know the other three existed.
 *   2. VISIT_SLOTS is 09:00–20:00 every half hour. Twenty-three near-identical
 *      pills in one flat grid is a wall, not a choice.
 *
 * The fix for the second one has its own trap, which is why FLAT_MAX exists:
 * grouping five slots across two tabs HIDES three of them to solve a problem
 * that does not exist at five. The first version of this did exactly that and
 * AppointmentForm's existing test caught it.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, within, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { DayStrip, TimeGrid, buildDays } from './VisitSlotPicker'

const days = buildDays({ count: 30, unavailable: [], hasSlots: () => true })
const slotsBetween = (from, to) => {
  const out = []
  for (let m = from * 60; m <= to * 60; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  }
  return out
}

describe('the day strip is reachable with a mouse', () => {
  it('offers arrows, because the scrollbar is hidden', () => {
    renderWithProviders(<DayStrip days={days} value={null} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: /show later days/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show earlier days/i })).toBeInTheDocument()
  })

  it('keeps the arrows OUT of the radio group', () => {
    // A screen reader walking the group should hear thirty days, not
    // thirty-two, and "Show later days" is not a day.
    renderWithProviders(<DayStrip days={days} value={null} onChange={() => {}} />)

    const group = screen.getByRole('radiogroup', { name: /pick a day/i })
    expect(within(group).queryByRole('button', { name: /show later days/i })).toBeNull()
    expect(within(group).getAllByRole('radio')).toHaveLength(30)
  })

  // jsdom gives every element a width of zero, so the strip never looks like it
  // overflows and both arrows are correctly disabled. Faking the two
  // measurements the component reads is the only way to exercise the edge logic
  // at all — without it these tests would assert nothing and pass.
  const overflowing = ({ client = 400, scroll = 2000 } = {}) => {
    const spies = [
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(client),
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(scroll),
    ]
    return () => spies.forEach((s) => s.mockRestore())
  }

  it('scrolls the strip forward and back', () => {
    const restore = overflowing()
    try {
      renderWithProviders(<DayStrip days={days} value={null} onChange={() => {}} />)
      const group = screen.getByRole('radiogroup', { name: /pick a day/i })
      const scrollBy = vi.fn()
      group.scrollBy = scrollBy

      fireEvent.click(screen.getByRole('button', { name: /show later days/i }))
      expect(scrollBy.mock.calls[0][0].left).toBeGreaterThan(0)

      // Now that we are away from the start, back becomes possible. The
      // component learns that from a scroll event, the same way the browser
      // tells it.
      group.scrollLeft = 500
      fireEvent.scroll(group)

      fireEvent.click(screen.getByRole('button', { name: /show earlier days/i }))
      expect(scrollBy.mock.calls[1][0].left).toBeLessThan(0)
    } finally { restore() }
  })

  it('offers no way back from the start, and a way forward', () => {
    // There is nothing to the left of today, and an arrow that never disables
    // reads as broken.
    const restore = overflowing()
    try {
      renderWithProviders(<DayStrip days={days} value={null} onChange={() => {}} />)
      expect(screen.getByRole('button', { name: /show earlier days/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /show later days/i })).toBeEnabled()
    } finally { restore() }
  })

  it('hides both when the whole month already fits', () => {
    const restore = overflowing({ client: 2000, scroll: 2000 })
    try {
      renderWithProviders(<DayStrip days={days} value={null} onChange={() => {}} />)
      expect(screen.getByRole('button', { name: /show later days/i })).toBeDisabled()
      expect(screen.getByRole('button', { name: /show earlier days/i })).toBeDisabled()
    } finally { restore() }
  })
})

describe('a full day of times is grouped, a short window is not', () => {
  const full = slotsBetween(9, 20)      // 23 — the reported wall
  const short = slotsBetween(10, 12)    // 5

  it('shows every slot flat when there are few', () => {
    // Grouping five would hide three behind a tab to solve nothing.
    renderWithProviders(<TimeGrid slots={short} value={null} onChange={() => {}} />)

    expect(screen.getAllByRole('radio')).toHaveLength(short.length)
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('splits a full day by part of day', () => {
    renderWithProviders(<TimeGrid slots={full} value={null} onChange={() => {}} />)

    expect(screen.getByRole('tab', { name: /morning/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /afternoon/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /evening/i })).toBeInTheDocument()
  })

  it('puts far fewer pills on screen at once', () => {
    // The whole point. 23 was eight rows of near-identical buttons.
    renderWithProviders(<TimeGrid slots={full} value={null} onChange={() => {}} />)

    const shown = screen.getAllByRole('radio').length
    expect(shown).toBeLessThanOrEqual(10)
    expect(shown).toBeGreaterThan(0)
  })

  it('opens on the morning, and switches on a tab press', () => {
    renderWithProviders(<TimeGrid slots={full} value={null} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: '9:00 AM' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /evening/i }))
    expect(screen.getByRole('radio', { name: '5:00 PM' })).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: '9:00 AM' })).toBeNull()
  })

  it('opens on the group holding the time already chosen', () => {
    // Coming back to a part-filled form must not look like the choice was lost.
    renderWithProviders(<TimeGrid slots={full} value="18:30" onChange={() => {}} />)

    expect(screen.getByRole('radio', { name: '6:30 PM' })).toBeChecked()
    expect(screen.getByRole('tab', { name: /evening/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('never opens an empty group when the day changes under it', () => {
    // An owner's window can leave a period with nothing in it. A tab pressed on
    // one day must not survive into a day that has no such slots.
    const { rerender } = renderWithProviders(<TimeGrid slots={full} value={null} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('tab', { name: /evening/i }))

    rerender(<TimeGrid slots={slotsBetween(9, 14)} value={null} onChange={() => {}} />)
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0)
  })

  it('still says so when a day has nothing left', () => {
    renderWithProviders(<TimeGrid slots={[]} value={null} onChange={() => {}} />)
    expect(screen.getByText(/no times left on this day/i)).toBeInTheDocument()
  })

  it('reports the picked time in 24-hour form, whatever it displays', () => {
    // The grid shows 12-hour and the API takes HH:MM — utils/time.js's rule.
    const onChange = vi.fn()
    renderWithProviders(<TimeGrid slots={full} value={null} onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: '11:30 AM' }))
    expect(onChange).toHaveBeenCalledWith('11:30')
  })
})
