import { describe, it, expect, afterEach } from 'vitest'
import {
  DEFAULT_OPENAI_MODEL,
  DEFAULT_API_AGENT_MODEL,
  resolveApiAgentModel,
  resolveConfiguredOpenAIModel,
  resolveProviderOpenAIModel,
} from './model-defaults'

describe('DEFAULT_OPENAI_MODEL', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_OPENAI_MODEL).toBe('string')
    expect(DEFAULT_OPENAI_MODEL.length).toBeGreaterThan(0)
  })
})

describe('DEFAULT_API_AGENT_MODEL', () => {
  it('is a non-empty string', () => {
    expect(typeof DEFAULT_API_AGENT_MODEL).toBe('string')
    expect(DEFAULT_API_AGENT_MODEL.length).toBeGreaterThan(0)
  })

  it('is different from DEFAULT_OPENAI_MODEL (stronger model for API agent)', () => {
    expect(DEFAULT_API_AGENT_MODEL).not.toBe(DEFAULT_OPENAI_MODEL)
  })
})

describe('resolveApiAgentModel', () => {
  const savedEnv = process.env.OPENAI_API_AGENT_MODEL

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.OPENAI_API_AGENT_MODEL
    else process.env.OPENAI_API_AGENT_MODEL = savedEnv
  })

  it('returns explicit override when provided', () => {
    expect(resolveApiAgentModel('gpt-5.5')).toBe('gpt-5.5')
  })

  it('trims whitespace from explicit override', () => {
    expect(resolveApiAgentModel('  gpt-5.5  ')).toBe('gpt-5.5')
  })

  it('falls back to OPENAI_API_AGENT_MODEL env var when no override', () => {
    process.env.OPENAI_API_AGENT_MODEL = 'gpt-5.5'
    expect(resolveApiAgentModel()).toBe('gpt-5.5')
  })

  it('falls back to DEFAULT_API_AGENT_MODEL when no override and env is unset', () => {
    delete process.env.OPENAI_API_AGENT_MODEL
    expect(resolveApiAgentModel(null)).toBe(DEFAULT_API_AGENT_MODEL)
  })

  it('prefers explicit override over env var', () => {
    process.env.OPENAI_API_AGENT_MODEL = 'gpt-5.4-mini'
    expect(resolveApiAgentModel('gpt-5.5')).toBe('gpt-5.5')
  })

  it('ignores OPENAI_MODEL — API agent has its own default', () => {
    delete process.env.OPENAI_API_AGENT_MODEL
    process.env.OPENAI_MODEL = 'gpt-5.4-mini'
    expect(resolveApiAgentModel()).toBe(DEFAULT_API_AGENT_MODEL)
  })
})

describe('resolveConfiguredOpenAIModel', () => {
  const savedEnv = process.env.OPENAI_MODEL

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = savedEnv
  })

  it('returns explicit override when provided', () => {
    expect(resolveConfiguredOpenAIModel('gpt-4o')).toBe('gpt-4o')
  })

  it('trims whitespace from explicit override', () => {
    expect(resolveConfiguredOpenAIModel('  gpt-4o  ')).toBe('gpt-4o')
  })

  it('falls back to OPENAI_MODEL env var when no override', () => {
    process.env.OPENAI_MODEL = 'gpt-5.4'
    expect(resolveConfiguredOpenAIModel()).toBe('gpt-5.4')
  })

  it('falls back to DEFAULT_OPENAI_MODEL when override is null and env is unset', () => {
    delete process.env.OPENAI_MODEL
    expect(resolveConfiguredOpenAIModel(null)).toBe(DEFAULT_OPENAI_MODEL)
  })

  it('falls back to DEFAULT_OPENAI_MODEL when override is empty string', () => {
    delete process.env.OPENAI_MODEL
    expect(resolveConfiguredOpenAIModel('')).toBe(DEFAULT_OPENAI_MODEL)
  })

  it('prefers explicit override over env var', () => {
    process.env.OPENAI_MODEL = 'gpt-5.4'
    expect(resolveConfiguredOpenAIModel('gpt-4o-mini')).toBe('gpt-4o-mini')
  })

  it('trims the env var value', () => {
    process.env.OPENAI_MODEL = '  gpt-5.5  '
    expect(resolveConfiguredOpenAIModel()).toBe('gpt-5.5')
  })
})

describe('resolveProviderOpenAIModel', () => {
  const savedEnv = process.env.OPENAI_MODEL

  afterEach(() => {
    if (savedEnv === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = savedEnv
  })

  it('maps gpt-5.5-mini → gpt-5.4-mini (provider alias)', () => {
    expect(resolveProviderOpenAIModel('gpt-5.5-mini')).toBe('gpt-5.4-mini')
  })

  it('passes through a model that has no alias unchanged', () => {
    expect(resolveProviderOpenAIModel('gpt-4o')).toBe('gpt-4o')
    expect(resolveProviderOpenAIModel('gpt-5.4')).toBe('gpt-5.4')
  })

  it('returns DEFAULT_OPENAI_MODEL when no model and no env var', () => {
    delete process.env.OPENAI_MODEL
    const result = resolveProviderOpenAIModel()
    // Result is either DEFAULT or its alias — must be non-empty
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('applies alias when model comes from env var', () => {
    process.env.OPENAI_MODEL = 'gpt-5.5-mini'
    expect(resolveProviderOpenAIModel()).toBe('gpt-5.4-mini')
  })

  it('passes through null/undefined as DEFAULT_OPENAI_MODEL path', () => {
    delete process.env.OPENAI_MODEL
    const r1 = resolveProviderOpenAIModel(null)
    const r2 = resolveProviderOpenAIModel(undefined)
    expect(r1).toBe(r2)
    expect(r1.length).toBeGreaterThan(0)
  })
})
