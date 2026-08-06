/**
 * The Select announces itself to a screen reader.
 *
 * Every dropdown in the app is this component, and until 2026-08-07 all of them
 * announced as a bare **"button"** with no field name and no indication that a
 * list existed. The `<label>` carried no association — and could not: `htmlFor`
 * targets form controls, and the trigger is a `<button>`. So the name was
 * visible and nothing more.
 *
 * Found while fixing the City dropdown's overlapping helper text; it is a wider
 * gap than the bug it was found under, which is why it is pinned separately.
 *
 * The failure is completely invisible to a sighted user — the control looks and
 * behaves perfectly — so nothing but a test defends it.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import Select from './Select'

const OPTIONS = [
  { value: 'Chennai', label: 'Chennai' },
  { value: 'Bengaluru', label: 'Bengaluru' },
]

const renderSelect = (props = {}) => renderWithProviders(
  <Select label="Your city" options={OPTIONS} value="" onChange={() => {}} {...props} />,
)

describe('Select accessibility', () => {
  it('is reachable by its visible label', () => {
    renderSelect()
    // The whole point: a screen reader user can find "Your city", not "button".
    expect(screen.getByRole('combobox', { name: /your city/i })).toBeInTheDocument()
  })

  it('says whether the list is open', async () => {
    const { user } = renderSelect()
    const trigger = screen.getByRole('combobox', { name: /your city/i })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('exposes the options as a listbox, not a pile of buttons', async () => {
    const { user } = renderSelect()
    await user.click(screen.getByRole('combobox', { name: /your city/i }))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(OPTIONS.length)
  })

  it('marks which option is the current value', async () => {
    const { user } = renderSelect({ value: 'Chennai' })
    await user.click(screen.getByRole('combobox', { name: /your city/i }))

    expect(screen.getByRole('option', { name: /chennai/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /bengaluru/i })).toHaveAttribute('aria-selected', 'false')
  })

  // The hint is the helper text that used to be a sibling <p> at each callsite,
  // which is how it ended up sliced by the panel (bug 1). Owned by the field
  // now, so it must also be ANNOUNCED with the field rather than orphaned.
  it('associates the helper text with the control', () => {
    renderSelect({ hint: 'We are only live in nine cities' })
    const trigger = screen.getByRole('combobox', { name: /your city/i })
    const describedBy = trigger.getAttribute('aria-describedby')

    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy)).toHaveTextContent(/nine cities/i)
  })

  // Two on one page must not collide — ids are generated, not hardcoded.
  it('does not reuse ids between instances', () => {
    renderWithProviders(
      <>
        <Select label="City" options={OPTIONS} value="" onChange={() => {}} hint="one" />
        <Select label="State" options={OPTIONS} value="" onChange={() => {}} hint="two" />
      </>,
    )
    const [a, b] = screen.getAllByRole('combobox')
    expect(a.getAttribute('aria-describedby')).not.toBe(b.getAttribute('aria-describedby'))
  })
})
