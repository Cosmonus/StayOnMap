/**
 * The WhatsApp admin readout — the states that fail quietly.
 *
 * A funnel that renders zeros over an empty table looks like a platform where
 * nobody has tried, and a list that renders nothing over a failed request
 * looks the same. Both are asserted here as words on the screen, not as the
 * absence of an error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'

const whatsappFunnel = vi.fn()
const whatsappConversations = vi.fn()
const whatsappConversation = vi.fn()
const whatsappIntervene = vi.fn()
vi.mock('@services/admin.service', () => ({
  adminService: {
    whatsappFunnel: (...a) => whatsappFunnel(...a),
    whatsappConversations: (...a) => whatsappConversations(...a),
    whatsappConversation: (...a) => whatsappConversation(...a),
    whatsappIntervene: (...a) => whatsappIntervene(...a),
  },
}))

const { default: WhatsAppSection } = await import('./WhatsAppSection')

const FUNNEL = {
  days: 30, started: 12, listingsCreated: 3, listingsPublished: 2, openNow: 4, completionRate: 25, medianMinutesToSubmit: 18, sampleSize: 3,
  steps: [
    { name: 'wa_conversation_started', count: 12, rate: 100 },
    { name: 'wa_type_selected', count: 10, rate: 83.3 },
    { name: 'wa_location_submitted', count: 6, rate: 50 },
    { name: 'wa_publish_confirmed', count: 3, rate: 25 },
  ],
  failures: [{ name: 'wa_location_failed', count: 4 }],
  byType: [{ propertyType: 'apartment', label: 'Apartment / Flat', count: 7 }],
  dropOff: [{ question: 'location', count: 3 }],
}

const ROW = {
  id: 'c1', phone: '919876543210', phoneMasked: '+91 •••••43210', status: 'LOCATION', propertyType: 'apartment', propertyTypeLabel: 'Apartment / Flat',
  currentQuestion: 'location', completionPct: 40, propertyId: null, lastError: null, errorCount: 0, lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(), user: { id: 'u1', name: 'Asha Rao' }, location: null, photoCount: 2, property: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  whatsappFunnel.mockResolvedValue({ data: FUNNEL })
})

describe('WhatsAppSection', () => {
  it('renders the funnel with its rates and where people are stuck', async () => {
    whatsappConversations.mockResolvedValue({ data: { conversations: [], total: 0 } })
    renderWithProviders(<WhatsAppSection />)
    expect(await screen.findByText('Location confirmed')).toBeInTheDocument()
    expect(screen.getByText('25% of started')).toBeInTheDocument()
    expect(screen.getByText('18 min')).toBeInTheDocument()
    expect(screen.getByText('Apartment / Flat')).toBeInTheDocument()
    expect(screen.getByText('Location failed')).toBeInTheDocument()
  })

  it('says so when nobody has messaged, instead of an empty page', async () => {
    whatsappConversations.mockResolvedValue({ data: { conversations: [], total: 0 } })
    renderWithProviders(<WhatsAppSection />)
    expect(await screen.findByText('No conversations here')).toBeInTheDocument()
  })

  it('lists a conversation by owner, masked number, type, stage and progress — never the full number', async () => {
    whatsappConversations.mockResolvedValue({ data: { conversations: [ROW], total: 1 } })
    renderWithProviders(<WhatsAppSection />)
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.getByText('+91 •••••43210')).toBeInTheDocument()
    expect(screen.getByText(/Sharing location \(location\) · 40%/)).toBeInTheDocument()
    expect(screen.queryByText(/919876543210/)).not.toBeInTheDocument()
  })

  it('a failed list request shows a retry, not a blank', async () => {
    whatsappConversations.mockRejectedValue(new Error('boom'))
    renderWithProviders(<WhatsAppSection />)
    expect(await screen.findByText(/Couldn’t load conversations/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('opening a conversation loads its transcript and offers the interventions its state allows', async () => {
    whatsappConversations.mockResolvedValue({ data: { conversations: [ROW], total: 1 } })
    whatsappConversation.mockResolvedValue({ data: {
      ...ROW, draft: { fields: { bhk: 2, rent: 28000 }, location: null, photos: [], photosDone: false, pending: 'location' },
      messages: [
        { id: 'm1', direction: 'OUT', type: 'text', status: 'SENT', createdAt: new Date().toISOString(), text: 'Share the exact location' },
        { id: 'm2', direction: 'IN', type: 'text', status: 'PROCESSED', createdAt: new Date().toISOString(), text: 'Velachery' },
      ],
    } })
    const { user } = renderWithProviders(<WhatsAppSection />)
    await user.click(await screen.findByText('Asha Rao'))
    await waitFor(() => expect(whatsappConversation).toHaveBeenCalledWith('c1'))
    expect(await screen.findByText('Share the exact location')).toBeInTheDocument()
    expect(screen.getByText('Velachery')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-ask current question' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry publish/ })).not.toBeInTheDocument()
  })
})
