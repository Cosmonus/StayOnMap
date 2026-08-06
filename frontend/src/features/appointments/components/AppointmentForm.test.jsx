/**
 * Requesting a visit — and specifically, NOT being able to request one that was
 * always going to be refused.
 *
 * Accepting a visit auto-rejects every other pending request for the same DATE
 * ("Another visit was scheduled for this date"). So a renter could pick a day
 * the owner had already committed, fill in their phone number, submit, and
 * receive an acceptance-shaped rejection minutes later — for a clash the
 * platform knew about before they started typing.
 *
 * The day is therefore the unit of availability, not the slot, because that is
 * the unit the server's auto-reject uses. These tests pin that: a taken day is
 * unpickable and SAYS WHY, a day whose hours have passed is unpickable and says
 * a different why, and the payload that goes out is the one the API validates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const request = vi.fn()
const availability = vi.fn()

vi.mock('@services/appointment.service', () => ({
  appointmentService: {
    request: (...a) => request(...a),
    availability: (...a) => availability(...a),
  },
}))
vi.mock('@services/chat.service', () => ({ chatService: { startConversation: vi.fn() } }))
vi.mock('@components/common/Toaster', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const useAuth = vi.fn()
vi.mock('@features/auth/hooks/useAuth', () => ({ useAuth: () => useAuth() }))

const { default: AppointmentForm } = await import('./AppointmentForm')

const pad = (n) => String(n).padStart(2, '0')
const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const inDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

beforeEach(() => {
  vi.clearAllMocks()
  // A profile phone, so the form is one day + one time away from valid — the
  // number is already on the account and the field prefills from it.
  useAuth.mockReturnValue({ user: { id: 'u1', phone: '9876543210' } })
  availability.mockResolvedValue({ data: { unavailableDates: [] } })
  request.mockResolvedValue({ data: { id: 'a1' } })
})

// The strip labels every day with its full date, so a day is addressable by the
// same name a screen reader would read out.
// The word boundary matters: without it /7 August/ also matches "17 August"
// and "27 August", and the query finds three cells instead of one.
const dayButton = (date) => screen.findByRole('radio', { name: new RegExp(
  '\\b' + date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }), 'i') })

describe('visit request — which days can be asked for', () => {
  it('a day the owner already has a visit on is disabled, and says why', async () => {
    const taken = inDays(3)
    availability.mockResolvedValue({ data: { unavailableDates: [localISO(taken)] } })

    renderWithProviders(<AppointmentForm propertyId="p1" />)

    // waitFor, not a bare await: the cell renders before the availability
    // query resolves, so findByRole succeeds while the day is still enabled.
    const cell = await dayButton(taken)
    await waitFor(() => expect(cell).toBeDisabled())
    // The reason is in the accessible NAME, not only in the styling. A disabled
    // control with no stated reason sends the blame to whatever is interactive
    // beside it — which is how a working phone field got reported as broken.
    expect(cell).toHaveAccessibleName(/already has a visit booked/i)
  })

  it('a free day is pickable and carries no reason', async () => {
    renderWithProviders(<AppointmentForm propertyId="p1" />)

    const cell = await dayButton(inDays(3))
    expect(cell).toBeEnabled()
    expect(cell).not.toHaveAccessibleName(/unavailable/i)
  })

  it('the two reasons a day can be unavailable are never conflated', async () => {
    // Today, with the owner's window already over: a different sentence from
    // "the owner is busy", because it is a different fact. shouldAdvanceTime
    // keeps userEvent's own internal timers running under the frozen clock.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(new Date().setHours(23, 30, 0, 0)))

    renderWithProviders(<AppointmentForm propertyId="p1" windowStart="09:00" windowEnd="20:00" />)

    const today = await dayButton(new Date())
    expect(today).toBeDisabled()
    expect(today).toHaveAccessibleName(/no visiting hours left today/i)
    vi.useRealTimers()
  })

  it('a failed availability fetch leaves the form usable rather than empty', async () => {
    // The server still refuses a taken day, so the worst case is the behaviour
    // this screen had before the endpoint existed — not a dead form.
    availability.mockRejectedValue(new Error('offline'))
    renderWithProviders(<AppointmentForm propertyId="p1" />)

    expect(await dayButton(inDays(3))).toBeEnabled()
  })
})

describe('visit request — the times offered', () => {
  it('only the hours the owner actually shows the place', async () => {
    const { user } = renderWithProviders(
      <AppointmentForm propertyId="p1" windowStart="10:00" windowEnd="12:00" />,
    )

    await user.click(await dayButton(inDays(3)))
    const grid = screen.getByRole('radiogroup', { name: /pick a time/i })

    expect(within(grid).getByRole('radio', { name: '10:00 AM' })).toBeInTheDocument()
    expect(within(grid).getByRole('radio', { name: '12:00 PM' })).toBeInTheDocument()
    expect(within(grid).queryByRole('radio', { name: '9:00 AM' })).not.toBeInTheDocument()
    expect(within(grid).queryByRole('radio', { name: '1:00 PM' })).not.toBeInTheDocument()
  })

  it('asks for a day before it will show any times', async () => {
    renderWithProviders(<AppointmentForm propertyId="p1" />)
    expect(await screen.findByText(/choose a day first/i)).toBeInTheDocument()
  })
})

describe('visit request — what goes on the wire', () => {
  it('sends the chosen slot and the profile number, normalised', async () => {
    const day = inDays(4)
    const { user } = renderWithProviders(
      <AppointmentForm propertyId="p1" windowStart="10:00" windowEnd="11:00" />,
    )

    await user.click(await dayButton(day))
    await user.click(screen.getByRole('radio', { name: '10:30 AM' }))
    await user.click(screen.getByRole('button', { name: /request a visit/i }))

    expect(request).toHaveBeenCalledWith('p1', expect.objectContaining({
      requestedDate: new Date(localISO(day)).toISOString(),
      requestedTime: '10:30',
      contactNumber: '9876543210',
    }))
  })

  it('will not submit without both a day and a time', async () => {
    const { user } = renderWithProviders(
      <AppointmentForm propertyId="p1" windowStart="10:00" windowEnd="11:00" />,
    )

    const submit = screen.getByRole('button', { name: /request a visit/i })
    expect(submit).toBeDisabled()

    await user.click(await dayButton(inDays(4)))
    expect(submit).toBeDisabled()   // day alone is not a request

    await user.click(screen.getByRole('radio', { name: '10:00 AM' }))
    expect(submit).toBeEnabled()
  })

  it('drops a time that the newly-chosen day does not offer', async () => {
    // 9:00 AM is real on a future day and long past on today. Switching to
    // today must CLEAR it rather than carry it over into a request the server
    // refuses as a past slot.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(new Date().setHours(18, 0, 0, 0)))

    const { user } = renderWithProviders(
      <AppointmentForm propertyId="p1" windowStart="09:00" windowEnd="20:00" />,
    )

    await user.click(await dayButton(inDays(4)))
    await user.click(screen.getByRole('radio', { name: '9:00 AM' }))
    expect(screen.getByRole('button', { name: /request a visit/i })).toBeEnabled()

    await user.click(await dayButton(new Date()))
    expect(screen.getByRole('button', { name: /request a visit/i })).toBeDisabled()
    // Today still has evening slots — the day is fine, the TIME was not.
    expect(screen.getByRole('radio', { name: '7:00 PM' })).toBeInTheDocument()
    vi.useRealTimers()
  })
})
