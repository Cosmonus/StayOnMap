/**
 * Signing in and signing up — and the two things about signing up that are
 * easy to break silently.
 *
 * 1. The CITY GATE. Registering from a city StayOnMap is not live in does NOT
 *    create an account: the backend writes a WaitlistEntry and returns
 *    `{ waitlisted: true }` with a 200. There is no User row, so there is
 *    nothing to log in to, and a client that treated that response as a normal
 *    success would call loginSuccess with no token and leave someone in a
 *    signed-in-looking state they can never return to.
 *
 * 2. A FAILED LOGIN IS INLINE. It must not close the modal or navigate — a
 *    wrong password on a page that then throws you back to the map, with no
 *    message, is indistinguishable from the app being broken.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const login = vi.fn()
const register = vi.fn()
const loginSuccess = vi.fn()
const navigate = vi.fn()

vi.mock('@services/auth.service', () => ({
  authService: {
    login: (...a) => login(...a),
    register: (...a) => register(...a),
    requestPasswordReset: vi.fn(),
    oauthProviders: vi.fn().mockResolvedValue({ data: [] }),
  },
}))
vi.mock('@features/auth/hooks/useAuth', () => ({ useAuth: () => ({ loginSuccess }) }))
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigate,
}))

const openLoginModal = vi.fn()
const closeLoginModal = vi.fn()
let modalOpen = true
vi.mock('@store/uiStore', () => ({
  useUiStore: (sel) => sel({
    loginModalOpen: modalOpen,
    openLoginModal,
    closeLoginModal,
    hostMode: false,
    setHostMode: vi.fn(),
  }),
}))

const { default: LoginModal } = await import('./LoginModal')

const SESSION = { token: 'jwt', user: { id: 'u1', name: 'A', role: 'TENANT' } }

beforeEach(() => {
  vi.clearAllMocks()
  modalOpen = true
})

describe('login', () => {
  it('hands the session to AuthContext, once', async () => {
    login.mockResolvedValue({ data: SESSION })
    const { user } = renderWithProviders(<LoginModal />)

    await user.type(screen.getByPlaceholderText(/you@example/i), 'a@b.com')
    await user.type(screen.getByPlaceholderText(/••/), 'Correct-horse-1')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() => expect(loginSuccess).toHaveBeenCalledWith(SESSION))
    expect(loginSuccess).toHaveBeenCalledTimes(1)
  })

  it('a wrong password stays on the form and says so', async () => {
    login.mockRejectedValue({ message: 'Invalid email or password' })
    const { user } = renderWithProviders(<LoginModal />)

    await user.type(screen.getByPlaceholderText(/you@example/i), 'a@b.com')
    await user.type(screen.getByPlaceholderText(/••/), 'wrong')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
    // The modal is still here, the session was not created, and nothing moved.
    expect(loginSuccess).not.toHaveBeenCalled()
    expect(closeLoginModal).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('signup — the city gate', () => {
  async function fillSignup(user, { city = 'Chennai' } = {}) {
    // The tab, not the marketing panel's "Sign up free" CTA beside it.
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByLabelText(/full name/i), 'Asha')
    await user.type(screen.getByLabelText(/email address/i), 'asha@b.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Correct-horse-1')
    // The Select primitive, not a native <select>: a portal-rendered
    // combobox. Open it, then pick from the listbox.
    await user.click(screen.getByRole('combobox', { name: /city/i }))
    // Options read "Chennai, Tamil Nadu" since cities grew to 47 (2026-08-24).
    await user.click(await screen.findByRole('option', { name: new RegExp(`^${city}`) }))
  }

  it('the name field is a NAME field', async () => {
    // Reported 2026-08-07: it carried type="email", so the browser offered
    // email addresses as autofill suggestions for someone's full name.
    const { user } = renderWithProviders(<LoginModal />)
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))

    const nameField = screen.getByLabelText(/full name/i)
    expect(nameField).not.toHaveAttribute('type', 'email')
    expect(nameField).toHaveAttribute('autocomplete', 'name')
  })

  it('a waitlisted signup is NOT a session', async () => {
    // 200, no token, no user — an account was deliberately not created.
    register.mockResolvedValue({ data: { waitlisted: true } })
    const { user } = renderWithProviders(<LoginModal />)

    await fillSignup(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(register).toHaveBeenCalled())
    // The whole point: there is no User row, so signing this person in would
    // leave them holding a state they can never get back to.
    expect(loginSuccess).not.toHaveBeenCalled()
    expect(await screen.findByText(/almost there/i)).toBeInTheDocument()
  })

  it('a supported city IS a session', async () => {
    register.mockResolvedValue({ data: SESSION })
    const { user } = renderWithProviders(<LoginModal />)

    await fillSignup(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(loginSuccess).toHaveBeenCalledWith(SESSION))
  })

  it('sends a city with every registration', async () => {
    // `city` is REQUIRED by the endpoint and is what the gate reads. A signup
    // that omitted it would 400 for everyone.
    register.mockResolvedValue({ data: SESSION })
    const { user } = renderWithProviders(<LoginModal />)

    await fillSignup(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => expect(register).toHaveBeenCalled())
    expect(register.mock.calls[0][0].city).toBeTruthy()
  })
})
