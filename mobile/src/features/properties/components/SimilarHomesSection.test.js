/**
 * The two graph surfaces must MOUNT — 2026-08-07
 *
 * Lint, jest and `expo export` all passed on these components while nothing had
 * ever rendered them. None of those catch the failure that actually shows up on
 * a device: a throw at module scope or during render, which React Native
 * reports as "Runtime not ready" with no useful stack.
 *
 * The specific hazards here, each of which this file would catch:
 *   • a theme token that does not exist — `colors.white`, `fonts.displayBold`,
 *     `shadows.card` are all read at StyleSheet.create time, i.e. at MODULE
 *     scope, so one typo takes the whole bundle down before anything renders
 *   • a service that throws on import
 *   • a render-time crash on the empty/failed path, which is the COMMON path
 *     here: both components are designed to render nothing, and "nothing" is
 *     the state they will be in for most listings while inventory is thin
 */
import { render as rntlRender, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockPush = jest.fn()
const mockNavigate = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ push: mockPush, navigate: mockNavigate }),
}))

jest.mock('@services/property.service', () => ({
  propertyService: { getSimilar: jest.fn() },
}))

jest.mock('@services/graph.service', () => ({
  graphService: { recommendations: jest.fn() },
}))

// Both cards carry a save heart, which is signed-in-only and reads `['saved']`.
jest.mock('@features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}))
jest.mock('@services/saved.service', () => ({
  savedService: {
    getMySaved: jest.fn().mockResolvedValue({ data: [] }),
    save: jest.fn(),
    unsave: jest.fn(),
  },
}))

const { propertyService } = require('@services/property.service')
const { graphService } = require('@services/graph.service')
const SimilarHomesSection = require('./SimilarHomesSection').default
const HomesForYou = require('../../saved/components/HomesForYou').default

// A fresh client per render — a shared one would carry one test's `['saved']`
// into the next. `retry: false` so a rejection asserts on the first failure.
const render = (ui) => rntlRender(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>,
)

const listing = (over = {}) => ({
  id: 'p1', title: '2BHK in Koramangala', type: 'APARTMENT',
  rent: 30000, pricingModel: 'RENT', city: 'Bengaluru', landmark: 'Koramangala',
  images: [{ url: 'https://cdn/a_full.webp' }], ...over,
})

beforeEach(() => jest.clearAllMocks())

describe('SimilarHomesSection', () => {
  it('mounts and renders neighbours', async () => {
    propertyService.getSimilar.mockResolvedValue({ data: [listing()] })

    const { getByText } = await render(<SimilarHomesSection propertyId="anchor" />)
    await waitFor(() => expect(getByText('Similar homes')).toBeTruthy())
    expect(getByText('2BHK in Koramangala')).toBeTruthy()
  })

  it('renders NOTHING — heading included — when there are no neighbours', async () => {
    propertyService.getSimilar.mockResolvedValue({ data: [] })

    const { queryByText } = await render(<SimilarHomesSection propertyId="anchor" />)
    await waitFor(() => expect(propertyService.getSimilar).toHaveBeenCalled())
    // A titled section above nothing is the bug the spatial panel shipped with.
    expect(queryByText('Similar homes')).toBeNull()
  })

  it('renders nothing and does not crash when the fetch fails', async () => {
    propertyService.getSimilar.mockRejectedValue(new Error('offline'))

    const { queryByText } = await render(<SimilarHomesSection propertyId="anchor" />)
    await waitFor(() => expect(propertyService.getSimilar).toHaveBeenCalled())
    expect(queryByText('Similar homes')).toBeNull()
  })

  it('survives a listing with no photo', async () => {
    propertyService.getSimilar.mockResolvedValue({ data: [listing({ images: [] })] })

    const { getByText } = await render(<SimilarHomesSection propertyId="anchor" />)
    await waitFor(() => expect(getByText('2BHK in Koramangala')).toBeTruthy())
  })

  it('does not fetch without a propertyId', async () => {
    await render(<SimilarHomesSection propertyId={undefined} />)
    expect(propertyService.getSimilar).not.toHaveBeenCalled()
  })
})

describe('HomesForYou', () => {
  it('mounts and labels WHY each home is there', async () => {
    graphService.recommendations.mockResolvedValue({
      data: { items: [{ ...listing(), why: { source: 'similar_to_saved' } }] },
    })

    const { getByText } = await render(<HomesForYou onOpen={jest.fn()} />)
    await waitFor(() => expect(getByText('Homes for you')).toBeTruthy())
    // "like one you saved" and "in an area you browse" are different claims;
    // merging them is how a recommendation becomes an ad.
    expect(getByText('Like one you saved')).toBeTruthy()
  })

  it('renders nothing when the server knows nothing about this person yet', async () => {
    graphService.recommendations.mockResolvedValue({ data: { items: [] } })

    const { queryByText } = await render(<HomesForYou />)
    await waitFor(() => expect(graphService.recommendations).toHaveBeenCalled())
    expect(queryByText('Homes for you')).toBeNull()
  })

  it('renders nothing and does not crash when the fetch fails', async () => {
    graphService.recommendations.mockRejectedValue(new Error('offline'))

    const { queryByText } = await render(<HomesForYou />)
    await waitFor(() => expect(graphService.recommendations).toHaveBeenCalled())
    expect(queryByText('Homes for you')).toBeNull()
  })

  it('survives an item with no `why` block rather than crashing on the label', async () => {
    graphService.recommendations.mockResolvedValue({ data: { items: [listing()] } })

    const { getByText, queryByText } = await render(<HomesForYou />)
    await waitFor(() => expect(getByText('Homes for you')).toBeTruthy())
    expect(queryByText('Like one you saved')).toBeNull()
  })
})
