/**
 * The overflow menu.
 *
 * The property worth pinning is the one that shipped broken: a caller that
 * forgets `trigger` gets a button with NOTHING IN IT. It renders, it is
 * focusable, it opens the menu — and on screen it is an empty bordered box that
 * nobody recognises as a control. That is exactly how it reached production in
 * the admin panel's Review Listings detail, reported as "the menu shows empty".
 *
 * There is no error, no warning and no visual difference from a deliberate
 * blank, which is why this needs a test rather than care.
 */
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import ActionMenu from './ActionMenu'

const ITEMS = [{ key: 'a', label: 'Recalculate trust & risk', onClick: vi.fn() }]

describe('the trigger', () => {
  it('is never empty, even when the caller forgets one', () => {
    renderWithProviders(<ActionMenu items={ITEMS} label="Re-run checks" />)

    const button = screen.getByRole('button', { name: 'Re-run checks' })
    // An SVG glyph, not merely a non-empty string: `textContent` stays '' for an
    // icon, so asserting on text would pass for the broken version too.
    expect(button.querySelector('svg')).toBeTruthy()
  })

  it('still prefers the one the caller chose', () => {
    renderWithProviders(
      <ActionMenu items={ITEMS} label="Options" trigger={<span data-testid="mine">⋯</span>} />,
    )
    expect(screen.getByTestId('mine')).toBeTruthy()
  })

  it('carries an accessible name — the glyph is not one', () => {
    renderWithProviders(<ActionMenu items={ITEMS} label="Re-run checks" />)
    expect(screen.getByRole('button', { name: 'Re-run checks' })).toBeTruthy()
  })
})

describe('opening it', () => {
  it('shows the items only after a click', () => {
    renderWithProviders(<ActionMenu items={ITEMS} label="Re-run checks" />)
    expect(screen.queryByText('Recalculate trust & risk')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Re-run checks' }))
    expect(screen.getByText('Recalculate trust & risk')).toBeTruthy()
  })

  it('runs the item and closes', () => {
    const onClick = vi.fn()
    renderWithProviders(<ActionMenu items={[{ key: 'a', label: 'Do it', onClick }]} label="Menu" />)

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(screen.getByText('Do it'))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Do it')).toBeNull()
  })
})
