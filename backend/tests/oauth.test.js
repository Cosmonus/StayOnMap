// Social login: the linking rules that keep accounts singular and unstolen.
//
// The three rules under test (see oauth.service.js's header):
//   1. Identity is (provider, providerUserId). Email attaches a first-time
//      social login onto an existing account ONLY when provider-verified.
//   2. No email from the provider → can sign in where linked, can never
//      START an account.
//   3. New users don't get an account from the callback — they get a pending
//      token and go through the same city/waitlist gate as password signup.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock } from './mocks/prisma.js'
import { beginOAuth, handleCallback, completeOAuthSignup, unlinkProvider } from '../src/features/auth/oauth.service.js'
import { enabledProviders } from '../src/features/auth/oauth.providers.js'
import jwt from 'jsonwebtoken'

const USER = { id: 'u1', email: 'john@example.com', name: 'John', role: 'TENANT', isBlocked: false, passwordHash: 'hash' }

// One fetch mock for the whole provider round-trip: token exchange then userinfo.
function mockProviderRoundTrip(profile) {
  global.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'provider-access-token' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => profile })
}

async function callbackFor(profileData, { purpose = 'login', userId = null, provider = 'google', platform } = {}) {
  const { redirectUrl } = await beginOAuth(provider, { purpose, userId, platform })
  const state = new URL(redirectUrl).searchParams.get('state')
  mockProviderRoundTrip(profileData)
  return handleCallback(provider, { code: 'auth-code', state })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.socialAccount.findUnique.mockResolvedValue(null)
  prismaMock.socialAccount.count.mockResolvedValue(0)
  prismaMock.user.findUnique.mockResolvedValue(null)
})

describe('provider configuration', () => {
  it('only providers with credentials are enabled (no dead buttons)', () => {
    const keys = enabledProviders().map((p) => p.key)
    expect(keys).toContain('google')
    expect(keys).not.toContain('facebook') // no creds in test env
  })

  it('an unconfigured provider cannot even begin', async () => {
    await expect(beginOAuth('facebook')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('google auth URL carries PKCE S256 and a state nonce', async () => {
    const { redirectUrl } = await beginOAuth('google')
    const url = new URL(redirectUrl)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('client_id')).toBe('test-google-id')
  })
})

describe('handleCallback', () => {
  it('rejects an unknown or replayed state', async () => {
    await expect(handleCallback('google', { code: 'c', state: 'never-issued' }))
      .rejects.toMatchObject({ statusCode: 400 })
  })

  it('a state nonce is single-use', async () => {
    const { redirectUrl } = await beginOAuth('google')
    const state = new URL(redirectUrl).searchParams.get('state')
    mockProviderRoundTrip({ sub: 'g-1', email: 'john@example.com', email_verified: true, name: 'John' })
    prismaMock.socialAccount.findUnique.mockResolvedValue({ userId: 'u1', user: USER })
    await handleCallback('google', { code: 'c', state })
    await expect(handleCallback('google', { code: 'c', state })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('already-linked identity → plain login, no writes to SocialAccount', async () => {
    prismaMock.socialAccount.findUnique.mockResolvedValue({ userId: 'u1', user: USER })
    const result = await callbackFor({ sub: 'g-1', email: 'x@y.z', email_verified: true, name: 'John' })
    expect(result.login.token).toBeTruthy()
    expect(result.login.refreshToken).toBeTruthy()
    expect(prismaMock.socialAccount.create).not.toHaveBeenCalled()
  })

  it('the platform flag rides the SIGNED state — mobile in, mobile out, even on failure', async () => {
    prismaMock.socialAccount.findUnique.mockResolvedValue({ userId: 'u1', user: USER })
    const result = await callbackFor(
      { sub: 'g-1', email: 'x@y.z', email_verified: true, name: 'John' },
      { platform: 'mobile' }
    )
    expect(result.platform).toBe('mobile')

    // Failure after state resolution still knows where to land the error.
    prismaMock.socialAccount.findUnique.mockResolvedValue(null)
    const err = await callbackFor({ data: { id: 'x-1', name: 'J' } }, { provider: 'twitter', platform: 'mobile' })
      .catch((e) => e)
    expect(err.oauthPlatform).toBe('mobile')

    // Anything that isn't exactly 'mobile' normalises to web.
    const web = await (async () => {
      prismaMock.socialAccount.findUnique.mockResolvedValue({ userId: 'u1', user: USER })
      return callbackFor({ sub: 'g-1', email: 'x@y.z', email_verified: true, name: 'John' }, { platform: 'evil://phish' })
    })()
    expect(web.platform).toBe('web')
  })

  it('provider-VERIFIED email attaches to the existing account — one John, not two', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    const result = await callbackFor({ sub: 'g-new', email: 'john@example.com', email_verified: true, name: 'John' })
    expect(result.login.user.id).toBe('u1')
    expect(prismaMock.socialAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', provider: 'GOOGLE', providerUserId: 'g-new' }) })
    )
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('an UNVERIFIED provider email never auto-links — that would be account takeover', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USER)
    await expect(callbackFor({ sub: 'g-evil', email: 'john@example.com', email_verified: false, name: 'Mallory' }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.socialAccount.create).not.toHaveBeenCalled()
  })

  it('a provider that shares no email can never START an account (X)', async () => {
    await expect(callbackFor({ data: { id: 'x-1', name: 'John' } }, { provider: 'twitter' }))
      .rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('a genuinely new user gets a pending token, not an account', async () => {
    const result = await callbackFor({ sub: 'g-9', email: 'new@example.com', email_verified: true, name: 'Nia' })
    expect(result.pending).toBeTruthy()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    const payload = jwt.decode(result.pending)
    expect(payload.purpose).toBe('oauth_signup')
    expect(payload.providerUserId).toBe('g-9')
  })

  it('link purpose: attaches to the logged-in user, 409 if claimed elsewhere', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: 'john@example.com', name: 'John' })
    const linked = await callbackFor(
      { sub: 'g-link', email: 'other@gmail.com', email_verified: true, name: 'John' },
      { purpose: 'link', userId: 'u1' }
    )
    expect(linked.linked).toBe('Google')

    prismaMock.socialAccount.findUnique.mockResolvedValue({ userId: 'someone-else', user: {} })
    await expect(callbackFor(
      { sub: 'g-link', email: 'other@gmail.com', email_verified: true, name: 'John' },
      { purpose: 'link', userId: 'u1' }
    )).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('completeOAuthSignup (the city gate)', () => {
  async function pendingTokenFor(email = 'new@example.com') {
    const result = await callbackFor({ sub: 'g-9', email, email_verified: true, name: 'Nia' })
    return result.pending
  }

  it('unsupported city → waitlist, NO account — same gate as password signup', async () => {
    const pending = await pendingTokenFor()
    const result = await completeOAuthSignup(pending, 'Coimbatore')
    expect(result.waitlisted).toBe(true)
    expect(prismaMock.waitlistEntry.create).toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('supported city → account created social-only (passwordHash null), pre-verified', async () => {
    const pending = await pendingTokenFor()
    prismaMock.user.create.mockResolvedValue({ ...USER, id: 'u-new', passwordHash: null })
    const result = await completeOAuthSignup(pending, 'Chennai')
    expect(result.login.token).toBeTruthy()
    const data = prismaMock.user.create.mock.calls[0][0].data
    expect(data.passwordHash).toBeNull()
    expect(data.isVerified).toBe(true)
    expect(data.socialAccounts.create.providerUserId).toBe('g-9')
  })

  it('a garbage or expired pending token is rejected', async () => {
    await expect(completeOAuthSignup('not-a-jwt', 'Chennai')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('unlinkProvider — never remove the last way in', () => {
  it('blocks unlinking the only method (social-only account, one provider)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: null })
    prismaMock.socialAccount.count.mockResolvedValue(1)
    await expect(unlinkProvider('u1', 'google')).rejects.toMatchObject({ statusCode: 400 })
    expect(prismaMock.socialAccount.deleteMany).not.toHaveBeenCalled()
  })

  it('allows unlinking when a password remains', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: 'hash' })
    prismaMock.socialAccount.count.mockResolvedValue(1)
    prismaMock.socialAccount.deleteMany.mockResolvedValue({ count: 1 })
    await expect(unlinkProvider('u1', 'google')).resolves.toBeUndefined()
  })

  it('allows unlinking one of two providers on a passwordless account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ passwordHash: null })
    prismaMock.socialAccount.count.mockResolvedValue(2)
    prismaMock.socialAccount.deleteMany.mockResolvedValue({ count: 1 })
    await expect(unlinkProvider('u1', 'twitter')).resolves.toBeUndefined()
  })
})
