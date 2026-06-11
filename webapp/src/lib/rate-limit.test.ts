import { describe, it, expect, vi, beforeAll } from 'vitest'

// Suppress security-logger console output
vi.mock('./security-logger', () => ({
  logBlockedRequest: vi.fn(),
  logAiCostSpike: vi.fn(),
  logAbuseFlag: vi.fn(),
  logInfo: vi.fn(),
}))

// Ensure no Redis URL is set — we always want the in-memory path
delete process.env.REDIS_URL

import { checkRateLimit } from './rate-limit'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Each test uses a unique key to prevent shared-store cross-contamination.
let keySeq = 0
function uniqueKey(prefix: string): string {
  return `test:${prefix}:${++keySeq}:${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// checkRateLimit — in-memory sliding window
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  it('allows the first request', async () => {
    const result = await checkRateLimit({
      keyHash: uniqueKey('first'),
      limitPerSecond: 10,
      limitPerMinute: 100,
    })
    expect(result.allowed).toBe(true)
    expect(result.retryAfter).toBeUndefined()
  })

  it('allows requests up to limitPerSecond within one second', async () => {
    const key = uniqueKey('per-sec-ok')
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit({ keyHash: key, limitPerSecond: 5, limitPerMinute: 100 })
      expect(result.allowed).toBe(true)
    }
  })

  it('blocks the request that would exceed limitPerSecond', async () => {
    const key = uniqueKey('per-sec-block')
    // Consume all 2 per-second slots
    await checkRateLimit({ keyHash: key, limitPerSecond: 2, limitPerMinute: 100 })
    await checkRateLimit({ keyHash: key, limitPerSecond: 2, limitPerMinute: 100 })
    // 3rd call should be blocked
    const result = await checkRateLimit({ keyHash: key, limitPerSecond: 2, limitPerMinute: 100 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThanOrEqual(1)
  })

  it('blocks the request that would exceed limitPerMinute', async () => {
    const key = uniqueKey('per-min-block')
    // Consume all 3 per-minute slots
    for (let i = 0; i < 3; i++) {
      await checkRateLimit({ keyHash: key, limitPerSecond: 100, limitPerMinute: 3 })
    }
    // 4th call within the minute should be blocked
    const result = await checkRateLimit({ keyHash: key, limitPerSecond: 100, limitPerMinute: 3 })
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThanOrEqual(1)
  })

  it('retryAfter is at least 1 second when rate limited per-second', async () => {
    const key = uniqueKey('retry-after')
    await checkRateLimit({ keyHash: key, limitPerSecond: 1, limitPerMinute: 100 })
    const result = await checkRateLimit({ keyHash: key, limitPerSecond: 1, limitPerMinute: 100 })
    if (!result.allowed) {
      expect(result.retryAfter).toBeGreaterThanOrEqual(1)
    }
  })

  it('different keys do not interfere with each other', async () => {
    const key1 = uniqueKey('isolate-a')
    const key2 = uniqueKey('isolate-b')
    // Exhaust key1
    await checkRateLimit({ keyHash: key1, limitPerSecond: 1, limitPerMinute: 100 })
    await checkRateLimit({ keyHash: key1, limitPerSecond: 1, limitPerMinute: 100 }) // blocked

    // key2 should still be allowed
    const result = await checkRateLimit({ keyHash: key2, limitPerSecond: 1, limitPerMinute: 100 })
    expect(result.allowed).toBe(true)
  })

  it('calls logBlockedRequest when rate limited', async () => {
    const securityLogger = await import('./security-logger')
    const logBlockedRequest = vi.mocked(securityLogger.logBlockedRequest)
    const key = uniqueKey('log-blocked')
    await checkRateLimit({ keyHash: key, limitPerSecond: 1, limitPerMinute: 100, userId: 'user-1', endpoint: '/api/test' })
    await checkRateLimit({ keyHash: key, limitPerSecond: 1, limitPerMinute: 100, userId: 'user-1', endpoint: '/api/test' })
    expect(logBlockedRequest).toHaveBeenCalled()
  })

  it('does not call logBlockedRequest for allowed requests', async () => {
    const securityLogger = await import('./security-logger')
    const logBlockedRequest = vi.mocked(securityLogger.logBlockedRequest)
    vi.clearAllMocks()
    const key = uniqueKey('no-log-allowed')
    await checkRateLimit({ keyHash: key, limitPerSecond: 10, limitPerMinute: 100 })
    expect(logBlockedRequest).not.toHaveBeenCalled()
  })

  it('uses env-var defaults when limitPerSecond/limitPerMinute not specified', async () => {
    // With no custom limits, the call uses RATE_LIMIT_PER_SECOND=10 and RATE_LIMIT_PER_MINUTE=200 defaults.
    // A single call should always be allowed.
    const result = await checkRateLimit({ keyHash: uniqueKey('env-defaults') })
    expect(result.allowed).toBe(true)
  })

  it('respects limitPerMinute lower bound independently of per-second', async () => {
    const key = uniqueKey('min-lower')
    // Very high per-second, low per-minute
    const opts = { keyHash: key, limitPerSecond: 1000, limitPerMinute: 2 }
    await checkRateLimit(opts) // 1st
    await checkRateLimit(opts) // 2nd
    const result = await checkRateLimit(opts) // 3rd — exceeds per-minute limit of 2
    expect(result.allowed).toBe(false)
  })

  it('returned result has allowed:boolean and optionally retryAfter:number', async () => {
    const result = await checkRateLimit({ keyHash: uniqueKey('shape') })
    expect(typeof result.allowed).toBe('boolean')
    if ('retryAfter' in result) {
      expect(typeof result.retryAfter).toBe('number')
    }
  })
})
