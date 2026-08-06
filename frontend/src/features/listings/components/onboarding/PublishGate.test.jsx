/**
 * The publish gate accepts a phone number the way a person types one.
 *
 * This flow is first because it is where a real user hit a wall: "they have a
 * section to add phone number but its not working while listing" (2026-08-01).
 * Two things were wrong and only one was the placeholder — the fix that landed
 * is behavioural and nothing had been holding it in place:
 *
 *   1. The server takes ten bare digits after a plain `.trim()`, which strips
 *      the ENDS of a string and nothing else, so "+91 98450 12345" is a value
 *      the user cannot successfully submit however carefully they type it.
 *      `normalizePhone` has to run before the value goes out.
 *   2. Saving on BLUR alone meant anyone who typed the number and reached
 *      straight for Publish never fired the save at all, so the gate stayed up
 *      with nothing on screen explaining why. Commit happens as you type.
 *
 * `backend/tests/placeholder-formats.test.js` pins the placeholder. This pins
 * the behaviour, which is the half a static scan cannot see.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

vi.mock('@services/user.service', () => ({
  userService: { updateProfile: vi.fn().mockResolvedValue({ data: {} }) },
}))
vi.mock('@services/auth.service', () => ({
  authService: { sendEmailVerification: vi.fn().mockResolvedValue({ data: {} }) },
}))
vi.mock('@components/common/Toaster', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const { userService } = await import('@services/user.service')
const { default: PublishGate } = await import('./PublishGate')

const MISSING_PHONE = [{ field: 'phone', label: 'Phone number' }]

function renderGate(profile = { name: 'Priya', city: 'Chennai', phone: null }) {
  return renderWithProviders(<PublishGate missing={MISSING_PHONE} profile={profile} />)
}

beforeEach(() => vi.clearAllMocks())

describe('publish gate — phone', () => {
  it('accepts the format the placeholder shows and sends bare digits', async () => {
    const { user } = renderGate()
    await user.type(screen.getByLabelText(/contact number/i), '9876543210')

    await waitFor(() => expect(userService.updateProfile).toHaveBeenCalled())
    expect(userService.updateProfile).toHaveBeenLastCalledWith({ phone: '9876543210' })
  })

  // The exact string that used to be printed under the field as an example.
  // If normalisation is ever dropped, this is the test that fails.
  it('accepts a +91 number with spaces — and strips it before sending', async () => {
    const { user } = renderGate()
    await user.type(screen.getByLabelText(/contact number/i), '+91 98450 12345')

    await waitFor(() => expect(userService.updateProfile).toHaveBeenCalled())
    expect(userService.updateProfile).toHaveBeenLastCalledWith({ phone: '9845012345' })
  })

  // Saving on blur alone is the bug that made this look broken: the user types
  // a valid number, presses Publish, and nothing happens because the field was
  // never left. Asserting without any blur is the whole point.
  it('saves while typing, without waiting for the field to be left', async () => {
    const { user } = renderGate()
    const field = screen.getByLabelText(/contact number/i)
    await user.type(field, '9845012345')

    expect(field).toHaveFocus()                       // never blurred
    await waitFor(() => expect(userService.updateProfile).toHaveBeenCalled())
  })

  it('does not send a half-typed number', async () => {
    const { user } = renderGate()
    await user.type(screen.getByLabelText(/contact number/i), '98450')

    await waitFor(() => {}, { timeout: 50 })
    expect(userService.updateProfile).not.toHaveBeenCalled()
  })

  // Indian mobile numbers start 6-9. A ten-digit number that cannot be one
  // must say so rather than failing silently at the server.
  it('explains a ten-digit number that is not a mobile, and sends nothing', async () => {
    const { user } = renderGate()
    await user.type(screen.getByLabelText(/contact number/i), '1234567890')

    expect(await screen.findByText(/valid 10-digit indian mobile/i)).toBeInTheDocument()
    expect(userService.updateProfile).not.toHaveBeenCalled()
  })

  it('does not re-save a number the profile already has', async () => {
    const { user } = renderGate({ name: 'Priya', city: 'Chennai', phone: '9845012345' })
    const field = screen.getByLabelText(/contact number/i)
    await user.clear(field)
    await user.type(field, '9845012345')

    await waitFor(() => {}, { timeout: 50 })
    expect(userService.updateProfile).not.toHaveBeenCalled()
  })
})

/**
 * The other half of the 2026-08-07 report — and the half that was actually
 * broken.
 *
 * "there we have a phone number blocker if we enter ph number it doesnt work
 * also". The phone field was fine; the tests above prove it saves. What was
 * broken is that Publish was DISABLED whenever any profile requirement was
 * outstanding, with nothing on screen naming which one — and for most people
 * the outstanding one is a VERIFIED EMAIL, satisfied in an inbox rather than in
 * this form. So an owner fills in the phone the box asked for, the button stays
 * grey, pressing it does nothing and says nothing, and the only interactive
 * thing in sight is the phone field. Of course it reads as a broken phone field.
 *
 * `.claude/ui-ux.md` says to disable AND show why. Showing nothing was the
 * missing half.
 */
describe('publish gate — email verification', () => {
  const MISSING_EMAIL = [{ field: 'email', label: 'Verified email' }]
  const COMPLETE = { name: 'Priya', city: 'Chennai', phone: '9845012345' }

  it('offers a way to re-check after verifying somewhere else', async () => {
    // The requirement is satisfied in an inbox, possibly on another device.
    // Without this, a fully-satisfied gate can sit there closed with a page
    // reload as the only escape.
    const { user, client } = renderWithProviders(
      <PublishGate missing={MISSING_EMAIL} profile={COMPLETE} />,
    )
    const spy = vi.spyOn(client, 'invalidateQueries')

    await user.click(screen.getByRole('button', { name: /check again/i }))

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['me'] }))
  })

  it('names the email as what is outstanding', () => {
    renderWithProviders(<PublishGate missing={MISSING_EMAIL} profile={COMPLETE} />)
    expect(screen.getByText(/verify your email/i)).toBeInTheDocument()
  })

  it('shows no phone field when the phone is not what is missing', () => {
    // The mis-attribution at the heart of the report: if the phone is fine, the
    // box must not present a phone field for the owner to blame.
    renderWithProviders(<PublishGate missing={MISSING_EMAIL} profile={COMPLETE} />)
    expect(screen.queryByLabelText(/contact number/i)).not.toBeInTheDocument()
  })
})
