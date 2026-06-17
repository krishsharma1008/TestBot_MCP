import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock jose before importing the module under test
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(),
}))

import { verifyCognitoToken } from './jwt'
import { jwtVerify } from 'jose'

const mockJwtVerify = vi.mocked(jwtVerify)

const VALID_CLAIMS = {
  sub: 'test-user-sub-uuid',
  email: 'test@example.com',
  'cognito:username': 'test@example.com',
  token_use: 'access' as const,
  iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
  exp: Math.floor(Date.now() / 1000) + 3600,
}

beforeEach(() => {
  process.env.AWS_REGION = 'us-east-1'
  process.env.COGNITO_USER_POOL_ID = 'us-east-1_test'
  vi.clearAllMocks()
})

describe('verifyCognitoToken', () => {
  it('returns claims for a valid token', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: VALID_CLAIMS, protectedHeader: {} as never })
    const result = await verifyCognitoToken('valid.token.here')
    expect(result).not.toBeNull()
    expect(result?.sub).toBe('test-user-sub-uuid')
    expect(result?.email).toBe('test@example.com')
  })

  it('returns null for an expired token', async () => {
    mockJwtVerify.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'ERR_JWT_EXPIRED' }))
    const result = await verifyCognitoToken('expired.token.here')
    expect(result).toBeNull()
  })

  it('returns null for a tampered/invalid token', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('invalid signature'))
    const result = await verifyCognitoToken('bad.token.here')
    expect(result).toBeNull()
  })

  it('returns null when env vars are missing', async () => {
    delete process.env.AWS_REGION
    const result = await verifyCognitoToken('any.token.here')
    expect(result).toBeNull()
    expect(mockJwtVerify).not.toHaveBeenCalled()
  })
})
