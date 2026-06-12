import { describe, it, expect } from 'vitest'
import {
  deriveExecutionTier,
  deriveNatureTag,
  tagTestContent,
} from './tag-utils'

describe('deriveExecutionTier', () => {
  it('ui + positive → smoke, sanity, regression', () => {
    expect(deriveExecutionTier('ui', 'positive')).toEqual(['@smoke', '@sanity', '@regression'])
  })

  it('auth + positive → smoke, sanity, regression', () => {
    expect(deriveExecutionTier('auth', 'positive')).toEqual(['@smoke', '@sanity', '@regression'])
  })

  it('ui + negative → regression only', () => {
    expect(deriveExecutionTier('ui', 'negative')).toEqual(['@regression'])
  })

  it('api + positive → sanity, regression', () => {
    expect(deriveExecutionTier('api', 'positive')).toEqual(['@sanity', '@regression'])
  })

  it('api + negative → regression only', () => {
    expect(deriveExecutionTier('api', 'negative')).toEqual(['@regression'])
  })

  it('e2e + any → regression only', () => {
    expect(deriveExecutionTier('e2e', 'positive')).toEqual(['@regression'])
  })

  it('no acKind → regression only', () => {
    expect(deriveExecutionTier('ui', '')).toEqual(['@regression'])
  })
})

describe('deriveNatureTag', () => {
  it('positive → @happy-path', () => expect(deriveNatureTag('positive')).toBe('@happy-path'))
  it('negative → @negative',   () => expect(deriveNatureTag('negative')).toBe('@negative'))
  it('boundary → @boundary',   () => expect(deriveNatureTag('boundary')).toBe('@boundary'))
  it('empty → null',            () => expect(deriveNatureTag('')).toBeNull())
  it('unknown → null',          () => expect(deriveNatureTag('other')).toBeNull())
})

describe('tagTestContent', () => {
  it('ui agent positive → @smoke @sanity @regression @happy-path @ui', () => {
    const content = `test('[REQ:F1.S1.AC1][positive] user sees dashboard', async () => {})`
    const result = tagTestContent(content, 'ui')
    expect(result).toContain('@smoke @sanity @regression @happy-path @ui')
  })

  it('ui agent negative → @regression @negative @ui', () => {
    const content = `test('[REQ:F1.S1.AC1][negative] unauthenticated user is rejected', async () => {})`
    const result = tagTestContent(content, 'ui')
    expect(result).toContain('@regression @negative @ui')
    expect(result).not.toContain('@smoke')
  })

  it('api agent positive → @sanity @regression @happy-path @api', () => {
    const content = `test('[REQ:F2.S1.AC1][positive] GET /users returns 200', async () => {})`
    const result = tagTestContent(content, 'api')
    expect(result).toContain('@sanity @regression @happy-path @api')
    expect(result).not.toContain('@ui')
  })

  it('api agent negative → @regression @negative @api', () => {
    const content = `test('[REQ:F2.S1.AC1][negative] GET /users returns 401 without token', async () => {})`
    const result = tagTestContent(content, 'api')
    expect(result).toContain('@regression @negative @api')
  })

  it('auth agent positive → @smoke @sanity @regression @happy-path @ui @auth', () => {
    const content = `test('[REQ:F0.S1.AC1][positive] user logs in successfully', async () => {})`
    const result = tagTestContent(content, 'auth')
    expect(result).toContain('@smoke @sanity @regression @happy-path @ui @auth')
  })

  it('e2e agent → @regression only, no @ui or @api', () => {
    const content = `test('user registers, shops, and checks out', async () => {})`
    const result = tagTestContent(content, 'e2e')
    expect(result).toContain('@regression')
    expect(result).not.toContain('@ui')
    expect(result).not.toContain('@api')
    expect(result).not.toContain('@e2e')
  })

  it('no scope/module tag added (file carries feature identity)', () => {
    const content = `test('[REQ:F1.S1.AC1][positive] user pays invoice', async () => {})`
    const result = tagTestContent(content, 'ui')
    // Must not add feature-slug tags like @billing or @checkout
    expect(result).not.toContain('@billing')
    expect(result).not.toContain('@checkout')
  })

  it('does not retag a title that already has @regression', () => {
    const content = `test('already tagged @smoke @sanity @regression @happy-path @ui', async () => {})`
    const result = tagTestContent(content, 'ui')
    expect(result).toBe(content)
  })

  it('handles double-quoted titles', () => {
    const content = `test("[REQ:F1.S1.AC1][positive] user logs in", async () => {})`
    const result = tagTestContent(content, 'ui')
    expect(result).toContain('@smoke @sanity @regression @happy-path @ui')
  })

  it('handles template-literal titles', () => {
    const content = 'test(`route ${route} renders stable layout`, async () => {})'
    const result = tagTestContent(content, 'ui')
    expect(result).toContain('@regression')
    expect(result).toContain('@ui')
  })

  it('handles test.only and test.skip modifiers', () => {
    const content = `test.only('[REQ:F1.S1.AC1][positive] critical path', async () => {})`
    const result = tagTestContent(content, 'ui')
    expect(result).toContain('@smoke @sanity @regression @happy-path @ui')
  })

  it('does not tag test.describe block titles', () => {
    const content = `test.describe('Feature suite', () => { test('[REQ:F1.S1.AC1][positive] sub test', async () => {}) })`
    const result = tagTestContent(content, 'ui')
    expect(result).toContain("test.describe('Feature suite'")
    expect(result).toContain('@smoke @sanity @regression @happy-path @ui')
    expect(result.indexOf('Feature suite @')).toBe(-1)
  })

  it('fallback test with no AC kind → @regression @ui only', () => {
    const content = `test('root route responds', async () => {})`
    const result = tagTestContent(content, 'ui')
    expect(result).toContain('@regression @ui')
    expect(result).not.toContain('@smoke')
    expect(result).not.toContain('@happy-path')
  })
})
