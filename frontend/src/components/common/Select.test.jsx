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

/**
 * Keyboard operation — added 2026-08-11.
 *
 * Until then the only way to choose was a mouse click on an option: no arrows,
 * no Enter, no type-ahead, and the panel always opened scrolled to the top.
 *
 * That is awkward everywhere and genuinely bad on the long lists. The PG curfew
 * field offers 48 half-hours, so picking 10:30 PM meant opening a list sitting
 * at midnight and scrolling past 45 rows — every time, including when 10:30 PM
 * was already the answer. A native <select> does all of this for free; replacing
 * it meant owing it.
 */
describe('Select keyboard', () => {
  const LONG = Array.from({ length: 48 }, (_, i) => {
    const v = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
    return { value: v, label: v }
  })

  it('opens on ArrowDown and starts the cursor on the CURRENT value', async () => {
    // The scroll-position fix, asserted through the thing that drives it: a
    // cursor that starts at the top is what made a 48-item list open at
    // midnight regardless of the answer already chosen.
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="22:30" onChange={() => {}} />,
    )
    const trigger = screen.getByRole('combobox', { name: /curfew/i })
    trigger.focus()
    await user.keyboard('{ArrowDown}')

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const active = document.getElementById(trigger.getAttribute('aria-activedescendant'))
    expect(active).toHaveTextContent('22:30')
  })

  it('moves with the arrows and commits on Enter', async () => {
    const picked = []
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="22:30" onChange={(v) => picked.push(v)} />,
    )
    screen.getByRole('combobox').focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(picked).toEqual(['23:00'])
  })

  it('does not change the value while merely moving', async () => {
    // The cursor is not the selection. Arrowing past a field must not commit
    // whatever it happened to land on.
    const picked = []
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="22:30" onChange={(v) => picked.push(v)} />,
    )
    screen.getByRole('combobox').focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}')
    expect(picked).toEqual([])
  })

  it('clamps at the ends rather than wrapping', async () => {
    // One key too many on a 48-item list would otherwise teleport from 11:30 PM
    // to midnight, off-screen — the value changes and nothing shows why.
    const picked = []
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="00:00" onChange={(v) => picked.push(v)} />,
    )
    screen.getByRole('combobox').focus()
    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}{Enter}')
    expect(picked).toEqual(['00:00'])
  })

  it('jumps with Home and End', async () => {
    const picked = []
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="12:00" onChange={(v) => picked.push(v)} />,
    )
    screen.getByRole('combobox').focus()
    await user.keyboard('{ArrowDown}{End}{Enter}')
    expect(picked).toEqual(['23:30'])
  })

  it('jumps by type-ahead', async () => {
    // The 45-rows-of-scrolling fix, from the keyboard.
    const picked = []
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="" onChange={(v) => picked.push(v)} />,
    )
    screen.getByRole('combobox').focus()
    await user.keyboard('{ArrowDown}')
    await user.keyboard('22:3')
    await user.keyboard('{Enter}')
    expect(picked).toEqual(['22:30'])
  })

  it('keeps the options out of the tab order', async () => {
    // Tab used to walk all 48 options one at a time before reaching the next
    // field. The trigger holds focus; the arrows move the cursor.
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="" onChange={() => {}} />,
    )
    screen.getByRole('combobox').focus()
    await user.keyboard('{ArrowDown}')
    for (const opt of screen.getAllByRole('option')) {
      expect(opt).toHaveAttribute('tabindex', '-1')
    }
  })

  it('ignores a disabled control', async () => {
    const picked = []
    const { user } = renderWithProviders(
      <Select label="Curfew" options={LONG} value="" onChange={(v) => picked.push(v)} disabled />,
    )
    const trigger = screen.getByRole('combobox')
    trigger.focus()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(picked).toEqual([])
  })
})
