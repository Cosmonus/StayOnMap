import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'

// One place that knows which providers the app needs, so a test can be about
// the behaviour it names instead of about wiring. `main.jsx` mounts
// BrowserRouter → QueryClientProvider → AuthProvider; tests swap in
// MemoryRouter (no real URL) and, where the component reads auth, a stub
// context supplied by the test itself.

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // No retries: a test that asserts an error state should reach it on the
      // first rejection, not three seconds later. Retry behaviour in production
      // is React Query's, not ours, and is not what these tests are about.
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
    // React Query logs expected rejections at error level, which fills the
    // output of every test that deliberately exercises a failure.
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  })
}

export function renderWithProviders(ui, { route = '/', client = makeQueryClient() } = {}) {
  const user = userEvent.setup()
  // The v7 future flags are opted into here only to silence two warnings React
  // Router prints on every render. They change nothing these tests assert, and
  // a suite that shouts on success trains people to ignore it.
  const result = render(
    <MemoryRouter
      initialEntries={[route]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
  return { ...result, user, client }
}
