import { describe, it, expect, afterEach } from 'vitest'
import {
  getModelRate,
  computeCost,
  resolveModel,
  MODEL_RATES,
  LONG_CONTEXT_THRESHOLD_TOKENS,
} from './pricing'

// ---------------------------------------------------------------------------
// MODEL_RATES table integrity
// ---------------------------------------------------------------------------

describe('MODEL_RATES', () => {
  it('contains at least 20 models', () => {
    expect(Object.keys(MODEL_RATES).length).toBeGreaterThanOrEqual(20)
  })

  it('every model has a short tier with positive input/output rates', () => {
    for (const [model, entry] of Object.entries(MODEL_RATES)) {
      expect(entry.short.inputUsdPerToken, `${model}.short.input`).toBeGreaterThan(0)
      expect(entry.short.outputUsdPerToken, `${model}.short.output`).toBeGreaterThan(0)
    }
  })

  it('every long tier (when present) has higher rates than the short tier', () => {
    for (const [model, entry] of Object.entries(MODEL_RATES)) {
      if (!entry.long) continue
      expect(entry.long.inputUsdPerToken, `${model}.long.input > short`).toBeGreaterThan(
        entry.short.inputUsdPerToken,
      )
      expect(entry.long.outputUsdPerToken, `${model}.long.output > short`).toBeGreaterThan(
        entry.short.outputUsdPerToken,
      )
    }
  })

  it('cachedInputUsdPerToken is null or less than inputUsdPerToken', () => {
    for (const [model, entry] of Object.entries(MODEL_RATES)) {
      if (entry.short.cachedInputUsdPerToken !== null) {
        expect(
          entry.short.cachedInputUsdPerToken,
          `${model}.short.cachedInput < fresh input`,
        ).toBeLessThan(entry.short.inputUsdPerToken)
      }
    }
  })

  it('includes key gpt-4o and gpt-4o-mini', () => {
    expect(MODEL_RATES).toHaveProperty('gpt-4o')
    expect(MODEL_RATES).toHaveProperty('gpt-4o-mini')
  })

  it('includes o-series reasoning models', () => {
    expect(MODEL_RATES).toHaveProperty('o3')
    expect(MODEL_RATES).toHaveProperty('o4-mini')
  })
})

// ---------------------------------------------------------------------------
// getModelRate
// ---------------------------------------------------------------------------

describe('getModelRate', () => {
  it('returns the short tier for a model below LONG_CONTEXT_THRESHOLD_TOKENS', () => {
    const rate = getModelRate('gpt-5.4', { tokensInput: 10_000 })
    expect(rate).toEqual(MODEL_RATES['gpt-5.4'].short)
  })

  it('returns the long tier when tokensInput >= LONG_CONTEXT_THRESHOLD_TOKENS and model has one', () => {
    const rate = getModelRate('gpt-5.4', { tokensInput: LONG_CONTEXT_THRESHOLD_TOKENS })
    expect(rate).toEqual(MODEL_RATES['gpt-5.4'].long)
  })

  it('returns short tier when model has no long context tier even at high token count', () => {
    const rate = getModelRate('gpt-4o', { tokensInput: LONG_CONTEXT_THRESHOLD_TOKENS })
    expect(rate).toEqual(MODEL_RATES['gpt-4o'].short)
    expect(MODEL_RATES['gpt-4o'].long).toBeNull()
  })

  it('respects useLongContext=true regardless of token count', () => {
    const rate = getModelRate('gpt-5.4', { tokensInput: 1_000, useLongContext: true })
    expect(rate).toEqual(MODEL_RATES['gpt-5.4'].long)
  })

  it('returns short tier when useLongContext is omitted and token count is below threshold', () => {
    const rate = getModelRate('gpt-5.4', { tokensInput: LONG_CONTEXT_THRESHOLD_TOKENS - 1 })
    expect(rate).toEqual(MODEL_RATES['gpt-5.4'].short)
  })

  it('throws for an unknown model', () => {
    expect(() => getModelRate('gpt-nonexistent-model')).toThrow(/Unknown model/)
  })

  it('throws for null model', () => {
    expect(() => getModelRate(null)).toThrow()
  })

  it('throws for undefined model', () => {
    expect(() => getModelRate(undefined)).toThrow()
  })

  it('throws with a message that includes the model name', () => {
    expect(() => getModelRate('gpt-fake-model')).toThrow('gpt-fake-model')
  })

  it('returns exact rate tier object reference (not a copy)', () => {
    const rate = getModelRate('gpt-4o-mini')
    expect(rate).toBe(MODEL_RATES['gpt-4o-mini'].short)
  })
})

// ---------------------------------------------------------------------------
// computeCost — deterministic cost arithmetic
// ---------------------------------------------------------------------------

describe('computeCost', () => {
  it('computes correct cost for gpt-4o-mini with zero cached tokens', () => {
    // gpt-4o-mini: input 0.15/M, output 0.60/M
    const result = computeCost({
      model: 'gpt-4o-mini',
      tokensInput: 1_000_000,
      tokensOutput: 1_000_000,
    })
    expect(result.costInputUsd).toBeCloseTo(0.15, 6)
    expect(result.costOutputUsd).toBeCloseTo(0.60, 6)
    expect(result.costUsd).toBeCloseTo(0.75, 6)
  })

  it('bills cached tokens at the cached rate', () => {
    // gpt-4o-mini: cached input 0.075/M (half of fresh)
    const full = computeCost({ model: 'gpt-4o-mini', tokensInput: 1_000_000, tokensOutput: 0 })
    const withCache = computeCost({
      model: 'gpt-4o-mini',
      tokensInput: 1_000_000,
      tokensCachedInput: 1_000_000,
      tokensOutput: 0,
    })
    // All tokens are cached, so cost is half of full fresh cost
    expect(withCache.costCachedInputUsd).toBeCloseTo(full.costInputUsd / 2, 6)
    expect(withCache.costInputUsd).toBeCloseTo(0, 8) // no fresh tokens
  })

  it('splits input into fresh + cached correctly', () => {
    // 1M input, 400K cached → 600K fresh + 400K cached
    const result = computeCost({
      model: 'gpt-4o-mini',
      tokensInput: 1_000_000,
      tokensCachedInput: 400_000,
      tokensOutput: 0,
    })
    // 600K fresh @ 0.15/M = 0.09, 400K cached @ 0.075/M = 0.03
    expect(result.costInputUsd).toBeCloseTo(0.09, 6)
    expect(result.costCachedInputUsd).toBeCloseTo(0.03, 6)
    expect(result.costUsd).toBeCloseTo(0.12, 6)
  })

  it('clamps tokensCachedInput to tokensInput maximum', () => {
    // If cached > input, treat cached = input (all cached)
    const result = computeCost({
      model: 'gpt-4o-mini',
      tokensInput: 500_000,
      tokensCachedInput: 1_000_000, // exceeds input
      tokensOutput: 0,
    })
    expect(result.costInputUsd).toBeCloseTo(0, 8) // no fresh tokens
    expect(result.costCachedInputUsd).toBeCloseTo(500_000 * 0.075 / 1_000_000, 8)
  })

  it('returns zero costs for zero tokens', () => {
    const result = computeCost({ model: 'gpt-4o', tokensInput: 0, tokensOutput: 0 })
    expect(result.costUsd).toBe(0)
    expect(result.costInputUsd).toBe(0)
    expect(result.costOutputUsd).toBe(0)
  })

  it('uses the long-context rate when input hits threshold for gpt-5.4', () => {
    const shortResult = computeCost({ model: 'gpt-5.4', tokensInput: 100_000, tokensOutput: 0 })
    const longResult = computeCost({ model: 'gpt-5.4', tokensInput: LONG_CONTEXT_THRESHOLD_TOKENS, tokensOutput: 0 })
    // Long context rates are higher — same token count costs more
    expect(longResult.costInputUsd).toBeGreaterThan(shortResult.costInputUsd)
  })

  it('returns the rate tier on the result', () => {
    const result = computeCost({ model: 'gpt-4o', tokensInput: 100, tokensOutput: 50 })
    expect(result.rate).toBeDefined()
    expect(result.rate.inputUsdPerToken).toBeGreaterThan(0)
    expect(result.rate.outputUsdPerToken).toBeGreaterThan(0)
  })

  it('rounds costs to 8 decimal places', () => {
    const result = computeCost({ model: 'gpt-4o-mini', tokensInput: 1, tokensOutput: 1 })
    const decimalPlaces = (n: number) => (n.toString().split('.')[1] ?? '').length
    expect(decimalPlaces(result.costUsd)).toBeLessThanOrEqual(8)
    expect(decimalPlaces(result.costInputUsd)).toBeLessThanOrEqual(8)
    expect(decimalPlaces(result.costOutputUsd)).toBeLessThanOrEqual(8)
  })

  it('throws for unknown model', () => {
    expect(() => computeCost({ model: 'unknown-xyz', tokensInput: 100, tokensOutput: 50 })).toThrow()
  })

  it('bills model with null cachedInputRate at fresh input rate for cached tokens', () => {
    // gpt-5.5-pro: cachedInputUsdPerToken = null → cached tokens billed at input rate
    const fullFresh = computeCost({ model: 'gpt-5.5-pro', tokensInput: 1_000_000, tokensOutput: 0 })
    const allCached = computeCost({
      model: 'gpt-5.5-pro',
      tokensInput: 1_000_000,
      tokensCachedInput: 1_000_000,
      tokensOutput: 0,
    })
    // With null cached rate, cached tokens still use the fresh input rate
    expect(allCached.costCachedInputUsd).toBeCloseTo(fullFresh.costInputUsd, 6)
  })
})

// ---------------------------------------------------------------------------
// resolveModel
// ---------------------------------------------------------------------------

describe('resolveModel', () => {
  const savedEnv = process.env.OPENAI_MODEL

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = savedEnv
  })

  it('returns the claimed model when provided and non-empty', () => {
    expect(resolveModel('gpt-5.4')).toBe('gpt-5.4')
  })

  it('trims whitespace from claimed model', () => {
    expect(resolveModel('  gpt-4o  ')).toBe('gpt-4o')
  })

  it('falls back to OPENAI_MODEL env var when claimedModel is null', () => {
    process.env.OPENAI_MODEL = 'gpt-5.4-mini'
    expect(resolveModel(null)).toBe('gpt-5.4-mini')
  })

  it('falls back to OPENAI_MODEL env var when claimedModel is empty', () => {
    process.env.OPENAI_MODEL = 'gpt-5.4-mini'
    expect(resolveModel('')).toBe('gpt-5.4-mini')
  })

  it('falls back to DEFAULT_OPENAI_MODEL when neither claimedModel nor env is set', async () => {
    delete process.env.OPENAI_MODEL
    const { DEFAULT_OPENAI_MODEL: def } = await import('./model-defaults')
    expect(resolveModel(null)).toBe(def)
  })
})
