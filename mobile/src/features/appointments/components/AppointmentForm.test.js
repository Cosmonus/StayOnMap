/**
 * Which visit slots the form is willing to offer.
 *
 * Three rules live in this component, and every one of them was a bug reported
 * from use rather than a feature request:
 *
 *   1. "Today" must mean today WHERE THE USER IS. The file used
 *      `toISOString().split('T')[0]` until 2026-08-07, so between midnight and
 *      05:30 IST the chip labelled Today carried YESTERDAY's date and the
 *      server refused it as a past slot.
 *   2. A slot needs LEAD_MINUTES of lead time. Nobody can act on a request for
 *      20 minutes' time, and the owner opens the notification to a slot that
 *      has already gone.
 *   3. Past 23:30 the cutoff lands on tomorrow and its clock time wraps to
 *      "00:00" — against which every slot compares as still available, so late
 *      at night today silently re-opened in full.
 *
 * All three are time-dependent, which is why they went unnoticed: they are
 * invisible in a test run at 3pm and in every manual pass done during the day.
 * Fake timers are the whole point of this file.
 */
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), getParent: () => ({ navigate: jest.fn() }) }),
}))

// Jest hoists jest.mock() above every const, so a factory may only reference
// variables whose names start with `mock` — the guard against a mock reading an
// uninitialised binding.
const mockAvailability = jest.fn().mockResolvedValue({ data: { unavailableDates: [] } })
jest.mock('@services/appointment.service', () => ({
  appointmentService: {
    request: jest.fn(),
    availability: (...a) => mockAvailability(...a),
  },
}))
jest.mock('@services/chat.service', () => ({ chatService: { startConversation: jest.fn() } }))
jest.mock('@lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', phone: '9845012345' } }),
}))

const AppointmentForm = require('./AppointmentForm').default

// IST, because the local-vs-UTC bug only exists for a positive offset and the
// product is India-only. The suite runs in whatever zone CI has, so the offset
// is applied to the instant rather than assumed from the environment.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const istInstant = (iso) => new Date(new Date(`${iso}Z`).getTime() - IST_OFFSET_MS)

// RNTL 14 renders through React 19's concurrent root, so `render` is ASYNC and
// returns a promise of the queries. Forgetting the await gives you a promise
// whose `getByLabelText` is undefined, or the screen-level "render function has
// not been called" — neither of which points at the missing keyword.
async function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AppointmentForm propertyId="p1" windowStart="09:00" windowEnd="20:00" />
    </QueryClientProvider>
  )
}

// The reason is part of the accessible name on purpose — a disabled chip with
// no stated reason sends the blame to whatever is interactive beside it.
const todayChip = (view) => view.getByLabelText(/^(Select date Today|Today — unavailable)/)

afterEach(() => { jest.useRealTimers(); mockAvailability.mockClear() })

describe('today', () => {
  it('is offered in the morning', async () => {
    jest.useFakeTimers().setSystemTime(istInstant('2026-08-07T10:00:00'))
    const view = await renderForm()
    expect(todayChip(view)).toBeEnabled()
  })

  it('is closed once the last slot is inside the lead window', async () => {
    // 19:45 + 30min lead = 20:15, past the 20:00 window end.
    jest.useFakeTimers().setSystemTime(istInstant('2026-08-07T19:45:00'))
    const view = await renderForm()
    expect(view.getByLabelText(/Today — unavailable, no visiting hours left today/)).toBeTruthy()
  })

  it('stays closed at 23:45, when the cutoff has rolled into tomorrow', async () => {
    // The wrap bug: cutoff is 00:15 tomorrow, and every slot is "after 00:15".
    jest.useFakeTimers().setSystemTime(istInstant('2026-08-07T23:45:00'))
    const view = await renderForm()
    expect(view.getByLabelText(/Today — unavailable, no visiting hours left today/)).toBeTruthy()
  })

  it('is the LOCAL day just after midnight, not yesterday', async () => {
    // 00:30 IST on the 8th is 19:00 UTC on the 7th, so toISOString() named the
    // 7th and the chip labelled Today carried a date that had already passed.
    //
    // Asserted through the owner's calendar rather than by reading a date off a
    // label: mark the 8th unavailable and ask WHICH chip carries the reason.
    // If today is the 8th it is Today's; under the bug it would be Tomorrow's.
    // That is a fact about the mapping, not about how en-IN happens to format
    // a date — the earlier version of this test matched /7 Aug/, which also
    // matches 17 and 27 Aug.
    jest.useFakeTimers().setSystemTime(istInstant('2026-08-08T00:30:00'))
    mockAvailability.mockResolvedValueOnce({ data: { unavailableDates: ['2026-08-08'] } })
    const view = await renderForm()
    await view.findByLabelText(/^Today — unavailable, the owner already has a visit booked/)
  })
})

describe('days the owner cannot take', () => {
  it('says the owner is busy, not that the day is over', async () => {
    jest.useFakeTimers().setSystemTime(istInstant('2026-08-07T10:00:00'))
    mockAvailability.mockResolvedValueOnce({ data: { unavailableDates: ['2026-08-08'] } })
    const view = await renderForm()
    // The two reasons must not read as one — "already booked" is the owner's
    // calendar, "no hours left" is the clock, and only one of them means
    // "come back tomorrow".
    await view.findByLabelText(/Tomorrow — unavailable, the owner already has a visit booked/)
  })

  it('offers every day when the availability fetch fails', async () => {
    // Degrades to "nothing known to be taken": the server still refuses a taken
    // day, so the worst case is the behaviour this screen had before it could
    // ask. Failing CLOSED here would hide the owner's whole calendar on a
    // flaky connection.
    jest.useFakeTimers().setSystemTime(istInstant('2026-08-07T10:00:00'))
    mockAvailability.mockRejectedValueOnce(new Error('offline'))
    const view = await renderForm()
    expect(todayChip(view)).toBeEnabled()
  })
})
