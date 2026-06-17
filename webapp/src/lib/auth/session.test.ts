import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('../cognito/jwt', () => ({
  verifyCognitoToken: vi.fn(),
}))

vi.mock('../db', () => ({
  db: { select: vi.fn() },
}))

vi.mock('../db/schema', () => ({
  profiles: {},
}))

import { getCurrentUser, getCurrentProfile } from './session'
import { cookies } from 'next/headers'
import { verifyCognitoToken } from '../cognito/jwt'
import { db } from '../db'

const mockCookies = vi.mocked(cookies)
const mockVerify = vi.mocked(verifyCognitoToken)
const mockDb = vi.mocked(db)

const CLAIMS = {
  sub: 'user-sub-uuid',
  email: 'user@example.com',
  'cognito:username': 'user@example.com',
  token_use: 'access' as const,
  iss: '',
  exp: 9999999999,
  iat: 0,
  jti: '',
  nbf: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCurrentUser', () => {
  it('returns user when access_token cookie is valid', async () => {
    mockCookies.mockResolvedValueOnce({ get: () => ({ value: 'valid.token' }) } as never)
    mockVerify.mockResolvedValueOnce(CLAIMS)
    const user = await getCurrentUser()
    expect(user).toEqual({ id: 'user-sub-uuid', email: 'user@example.com' })
  })

  it('returns null when access_token cookie is absent', async () => {
    mockCookies.mockResolvedValueOnce({ get: () => undefined } as never)
    const user = await getCurrentUser()
    expect(user).toBeNull()
    expect(mockVerify).not.toHaveBeenCalled()
  })

  it('returns null when token verification fails', async () => {
    mockCookies.mockResolvedValueOnce({ get: () => ({ value: 'bad.token' }) } as never)
    mockVerify.mockResolvedValueOnce(null)
    const user = await getCurrentUser()
    expect(user).toBeNull()
  })
})

describe('getCurrentProfile', () => {
  it('returns null when user is not authenticated', async () => {
    mockCookies.mockResolvedValueOnce({ get: () => undefined } as never)
    const result = await getCurrentProfile()
    expect(result).toBeNull()
  })

  it('returns user and profile when both exist', async () => {
    mockCookies.mockResolvedValueOnce({ get: () => ({ value: 'valid.token' }) } as never)
    mockVerify.mockResolvedValueOnce(CLAIMS)
    const fakeProfile = { id: 'user-sub-uuid', email: 'user@example.com', plan: 'pro' }
    mockDb.select.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([fakeProfile]) }) }),
    } as never)
    const result = await getCurrentProfile()
    expect(result?.user).toEqual({ id: 'user-sub-uuid', email: 'user@example.com' })
    expect(result?.profile).toEqual(fakeProfile)
  })

  it('returns null profile when profile row does not exist', async () => {
    mockCookies.mockResolvedValueOnce({ get: () => ({ value: 'valid.token' }) } as never)
    mockVerify.mockResolvedValueOnce(CLAIMS)
    mockDb.select.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    } as never)
    const result = await getCurrentProfile()
    expect(result?.profile).toBeNull()
  })
})
