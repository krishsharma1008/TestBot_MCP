import { describe, it, expect } from 'vitest'
import {
  buildFeatureMap,
  deriveExecutionTier,
  deriveNatureTag,
  tagTestContent,
  type FeatureMap,
} from './tag-utils'
import type { ParsedPRD } from './types'

const emptyMap: FeatureMap = new Map()

describe('deriveExecutionTier', () => {
  it('smoke + positive → smoke, sanity, regression', () => {
    expect(deriveExecutionTier('smoke', 'positive')).toEqual(['@smoke', '@sanity', '@regression'])
  })

  it('smoke + negative → regression only', () => {
    expect(deriveExecutionTier('smoke', 'negative')).toEqual(['@regression'])
  })

  it('frontend + positive → sanity, regression', () => {
    expect(deriveExecutionTier('frontend', 'positive')).toEqual(['@sanity', '@regression'])
  })

  it('frontend + negative → regression only', () => {
    expect(deriveExecutionTier('frontend', 'negative')).toEqual(['@regression'])
  })

  it('workflow + any → regression only', () => {
    expect(deriveExecutionTier('workflow', 'positive')).toEqual(['@regression'])
  })

  it('api + any → regression only', () => {
    expect(deriveExecutionTier('api', 'negative')).toEqual(['@regression'])
  })

  it('no acKind → regression only', () => {
    expect(deriveExecutionTier('smoke', '')).toEqual(['@regression'])
  })
})

describe('deriveNatureTag', () => {
  it('positive → @happy-path', () => expect(deriveNatureTag('positive')).toBe('@happy-path'))
  it('negative → @negative', () => expect(deriveNatureTag('negative')).toBe('@negative'))
  it('boundary → @boundary', () => expect(deriveNatureTag('boundary')).toBe('@boundary'))
  it('empty → null', () => expect(deriveNatureTag('')).toBeNull())
  it('unknown → null', () => expect(deriveNatureTag('other')).toBeNull())
})

describe('buildFeatureMap', () => {
  it('returns empty map for null PRD', () => {
    expect(buildFeatureMap(null).size).toBe(0)
  })

  it('maps feature IDs to lowercased slugs', () => {
    const prd: ParsedPRD = {
      features: [
        { id: 'F1', name: 'User Management', userStories: [] },
        { id: 'F2', name: 'Billing', userStories: [] },
      ],
      personas: [],
      nonFunctional: [],
    }
    const map = buildFeatureMap(prd)
    expect(map.get('F1')).toBe('user-management')
    expect(map.get('F2')).toBe('billing')
  })

  it('strips special characters from feature names', () => {
    const prd: ParsedPRD = {
      features: [{ id: 'F1', name: 'Check-out & Pay!', userStories: [] }],
      personas: [],
      nonFunctional: [],
    }
    expect(buildFeatureMap(prd).get('F1')).toBe('check-out--pay')
  })
})

describe('tagTestContent', () => {
  it('adds smoke+sanity+regression+happy-path to smoke agent positive test', () => {
    const content = `test('[REQ:F1.S1.AC1][positive] user sees dashboard', async () => {})`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toContain('@smoke @sanity @regression @happy-path')
  })

  it('adds regression+negative to smoke agent negative test', () => {
    const content = `test('[REQ:F1.S1.AC1][negative] unauthenticated user is rejected', async () => {})`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toContain('@regression @negative')
    expect(result).not.toContain('@smoke')
  })

  it('adds @api cross-cutting tag for api agent', () => {
    const content = `test('[REQ:F2.S1.AC1][positive] GET /users returns 200', async () => {})`
    const result = tagTestContent(content, 'api', emptyMap)
    expect(result).toContain('@api')
    expect(result).toContain('@regression')
  })

  it('adds @e2e cross-cutting tag for workflow agent', () => {
    const content = `test('checkout flow completes successfully', async () => {})`
    const result = tagTestContent(content, 'workflow', emptyMap)
    expect(result).toContain('@e2e')
    expect(result).toContain('@regression')
  })

  it('appends feature scope tag when PRD feature is present', () => {
    const map: FeatureMap = new Map([['F1', 'billing']])
    const content = `test('[REQ:F1.S1.AC1][positive] user pays invoice', async () => {})`
    const result = tagTestContent(content, 'frontend', map)
    expect(result).toContain('@billing')
  })

  it('omits scope tag when no PRD feature matches', () => {
    const map: FeatureMap = new Map([['F2', 'billing']]) // F1 not in map
    const content = `test('[REQ:F1.S1.AC1][positive] user pays invoice', async () => {})`
    const result = tagTestContent(content, 'frontend', map)
    expect(result).not.toContain('@billing')
  })

  it('does not retag a title that already has @regression', () => {
    const content = `test('already tagged title @smoke @sanity @regression @happy-path', async () => {})`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toBe(content)
  })

  it('handles double-quoted titles', () => {
    const content = `test("[REQ:F1.S1.AC1][positive] user logs in", async () => {})`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toContain('@smoke @sanity @regression @happy-path')
  })

  it('handles template-literal titles with interpolation', () => {
    const content = 'test(`route ${route} renders stable layout`, async () => {})'
    const result = tagTestContent(content, 'frontend', emptyMap)
    expect(result).toContain('@regression')
  })

  it('handles test.only and test.skip modifiers', () => {
    const content = `test.only('[REQ:F1.S1.AC1][positive] critical path', async () => {})`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toContain('@smoke @sanity @regression @happy-path')
  })

  it('does not tag test.describe titles', () => {
    const content = `test.describe('Feature suite', () => { test('[REQ:F1.S1.AC1][positive] sub test', async () => {}) })`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toContain("test.describe('Feature suite'")
    expect(result).toContain('@smoke @sanity @regression @happy-path')
    expect(result.indexOf('Feature suite @')).toBe(-1)
  })

  it('fallback test with no AC kind gets regression only', () => {
    const content = `test('root route responds', async () => {})`
    const result = tagTestContent(content, 'smoke', emptyMap)
    expect(result).toContain('@regression')
    expect(result).not.toContain('@smoke')
  })
})
