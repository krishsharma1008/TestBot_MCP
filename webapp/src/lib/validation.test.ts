import { describe, it, expect, vi, beforeEach } from 'vitest'

// Suppress console output from logBlockedRequest during tests
vi.mock('./security-logger', () => ({
  logBlockedRequest: vi.fn(),
  logAiCostSpike: vi.fn(),
  logAbuseFlag: vi.fn(),
  logInfo: vi.fn(),
}))

import {
  validateGenerateTests,
  validateAnalyzeFailures,
  validateArtifacts,
  validateTestRunIngest,
} from './validation'

// ---------------------------------------------------------------------------
// validateGenerateTests
// ---------------------------------------------------------------------------

describe('validateGenerateTests', () => {
  it('returns null for a minimal valid body', () => {
    expect(validateGenerateTests({ api_key: 'tb_test' })).toBeNull()
  })

  it('returns an error when api_key is missing', () => {
    const err = validateGenerateTests({})
    expect(err).not.toBeNull()
    expect(err?.error).toBe('INVALID_INPUT_LIMIT')
  })

  it('returns an error when api_key is empty string', () => {
    const err = validateGenerateTests({ api_key: '' })
    expect(err).not.toBeNull()
  })

  it('returns null when all optional fields are present and valid', () => {
    const body = {
      api_key: 'tb_test',
      testType: 'both',
      prd: 'Feature: Login\nAC-1: ...'.repeat(100),
      agents: ['smoke', 'frontend'],
      options: { minGeneratedTests: 10 },
    }
    expect(validateGenerateTests(body)).toBeNull()
  })

  it('returns an error when prd exceeds MAX_PROMPT_CHARS (40000)', () => {
    const body = { api_key: 'tb_test', prd: 'x'.repeat(40001) }
    const err = validateGenerateTests(body)
    expect(err).not.toBeNull()
    expect(err?.field).toMatch(/prd/i)
  })

  it('returns null when prd is exactly at the limit (40000)', () => {
    const body = { api_key: 'tb_test', prd: 'x'.repeat(40000) }
    expect(validateGenerateTests(body)).toBeNull()
  })

  it('returns an error when minGeneratedTests exceeds MAX_TESTS_PER_RUN (50)', () => {
    const body = { api_key: 'tb_test', options: { minGeneratedTests: 51 } }
    const err = validateGenerateTests(body)
    expect(err).not.toBeNull()
    expect(err?.field).toMatch(/minGeneratedTests/)
  })

  it('returns null when minGeneratedTests is exactly at the limit (50)', () => {
    const body = { api_key: 'tb_test', options: { minGeneratedTests: 50 } }
    expect(validateGenerateTests(body)).toBeNull()
  })

  it('returns an error when testType is an invalid enum value', () => {
    const body = { api_key: 'tb_test', testType: 'fullstack' }
    const err = validateGenerateTests(body)
    expect(err).not.toBeNull()
  })

  it('accepts all valid testType enum values', () => {
    for (const testType of ['frontend', 'backend', 'both']) {
      expect(validateGenerateTests({ api_key: 'tb_test', testType })).toBeNull()
    }
  })

  it('returns null for body with extra unknown fields (passthrough)', () => {
    const body = { api_key: 'tb_test', options: { minGeneratedTests: 5, unknownOption: true } }
    expect(validateGenerateTests(body)).toBeNull()
  })

  it('returns an error for completely non-object body', () => {
    expect(validateGenerateTests(null)).not.toBeNull()
    expect(validateGenerateTests('string')).not.toBeNull()
    expect(validateGenerateTests(42)).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateAnalyzeFailures
// ---------------------------------------------------------------------------

describe('validateAnalyzeFailures', () => {
  it('returns null when failures is absent', () => {
    expect(validateAnalyzeFailures({})).toBeNull()
  })

  it('returns null when failures is not an array', () => {
    expect(validateAnalyzeFailures({ failures: 'not-array' })).toBeNull()
  })

  it('returns null for an empty failures array', () => {
    expect(validateAnalyzeFailures({ failures: [] })).toBeNull()
  })

  it('returns null when failures count is within the limit (8)', () => {
    const body = { failures: Array.from({ length: 8 }, (_, i) => ({ id: i })) }
    expect(validateAnalyzeFailures(body)).toBeNull()
  })

  it('returns an error when failures exceeds the limit', () => {
    const body = { failures: Array.from({ length: 9 }, (_, i) => ({ id: i })) }
    const err = validateAnalyzeFailures(body)
    expect(err).not.toBeNull()
    expect(err?.error).toBe('INVALID_INPUT_LIMIT')
    expect(err?.field).toBe('failures')
    expect(err?.received).toBe(9)
    expect(err?.limit).toBe(8)
  })

  it('passes userId and endpoint to logBlockedRequest on violation', async () => {
    const { logBlockedRequest } = vi.mocked(await import('./security-logger'))
    const body = { failures: Array.from({ length: 9 }, () => ({})) }
    validateAnalyzeFailures(body, 'user-abc', '/api/analyze-failures')
    expect(logBlockedRequest).toHaveBeenCalled()
  })

  it('returns null for null body', () => {
    expect(validateAnalyzeFailures(null)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateArtifacts
// ---------------------------------------------------------------------------

describe('validateArtifacts', () => {
  it('returns null for a non-array input', () => {
    expect(validateArtifacts('not-array')).toBeNull()
    expect(validateArtifacts(null)).toBeNull()
    expect(validateArtifacts({})).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(validateArtifacts([])).toBeNull()
  })

  it('returns null for artifacts with no content field', () => {
    expect(validateArtifacts([{ file_name: 'test.png' }])).toBeNull()
  })

  it('returns null when artifact content is within the size limit', () => {
    // Base64-encode a small buffer (well under 50MB)
    const smallContent = Buffer.alloc(100).toString('base64')
    expect(validateArtifacts([{ content: smallContent, file_name: 'small.png' }])).toBeNull()
  })

  it('returns an error when artifact content exceeds 50MB', () => {
    // A base64 string of 70MB decoded → over the 52428800 byte limit
    // Base64 encoding adds ~33% overhead, so 70MB decoded = ~94MB base64
    // Instead: create a buffer that decodes to >50MB
    // 52428801 bytes → base64 encode it. But that would be a huge string in memory.
    // Better: create a string that Base64.byteLength interprets as >50MB.
    // Buffer.byteLength(base64, 'base64') = floor(len * 3/4)
    // Need floor(len * 3/4) > 52428800 → len > 69905067 chars
    // That's too large for a test. Let's instead set a small env override.
    // The env var is read at module load time; we can't easily override it post-load.
    // Instead, use a moderately large buffer that we KNOW will fail at default limits.
    // We'll create a base64 string whose decoded byte length is exactly MAX+1.
    const MAX = 52_428_800
    // length in base64 chars needed for MAX+1 decoded bytes:
    // decoded = floor(b64len * 3/4), so b64len = ceil((MAX+1) * 4/3)
    const neededChars = Math.ceil((MAX + 1) * 4 / 3)
    // Build minimal base64 of that length (all 'A' → all zero bytes when decoded)
    const bigContent = 'A'.repeat(neededChars)
    const err = validateArtifacts([{ content: bigContent, file_name: 'huge.png' }])
    expect(err).not.toBeNull()
    expect(err?.error).toBe('INVALID_INPUT_LIMIT')
    expect(err?.field).toBe('artifacts[0].content')
  })

  it('returns an error on the first oversized artifact (index-tagged field)', () => {
    const MAX = 52_428_800
    const neededChars = Math.ceil((MAX + 1) * 4 / 3)
    const bigContent = 'A'.repeat(neededChars)
    const artifacts = [
      { content: Buffer.alloc(10).toString('base64'), file_name: 'small.png' },
      { content: bigContent, file_name: 'huge.png' },
    ]
    const err = validateArtifacts(artifacts)
    expect(err?.field).toBe('artifacts[1].content')
  })

  it('skips artifacts with no content even if other fields are present', () => {
    expect(validateArtifacts([{ file_name: 'no-content.png' }, { file_name: 'also-no-content.jpg' }])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateTestRunIngest
// ---------------------------------------------------------------------------

describe('validateTestRunIngest', () => {
  it('returns null when body is null', () => {
    expect(validateTestRunIngest(null)).toBeNull()
  })

  it('returns null when report is absent', () => {
    expect(validateTestRunIngest({})).toBeNull()
  })

  it('returns null when report.tests is absent', () => {
    expect(validateTestRunIngest({ report: {} })).toBeNull()
  })

  it('returns null when report.tests is not an array', () => {
    expect(validateTestRunIngest({ report: { tests: 'not-array' } })).toBeNull()
  })

  it('returns null when tests count is within 10× limit (500)', () => {
    const body = { report: { tests: Array.from({ length: 500 }, (_, i) => ({ id: i })) } }
    expect(validateTestRunIngest(body)).toBeNull()
  })

  it('returns an error when tests array exceeds 10× MAX_TESTS_PER_RUN (500)', () => {
    const body = { report: { tests: Array.from({ length: 501 }, (_, i) => ({ id: i })) } }
    const err = validateTestRunIngest(body)
    expect(err).not.toBeNull()
    expect(err?.error).toBe('INVALID_INPUT_LIMIT')
    expect(err?.field).toBe('report.tests')
    expect(err?.received).toBe(501)
  })

  it('empty tests array passes', () => {
    expect(validateTestRunIngest({ report: { tests: [] } })).toBeNull()
  })

  it('calls logBlockedRequest on violation', async () => {
    const { logBlockedRequest } = vi.mocked(await import('./security-logger'))
    const body = { report: { tests: Array.from({ length: 501 }, () => ({})) } }
    validateTestRunIngest(body, 'uid-123', '/api/test-runs/ingest')
    expect(logBlockedRequest).toHaveBeenCalled()
  })
})
