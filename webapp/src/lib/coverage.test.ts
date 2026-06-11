import { describe, it, expect } from 'vitest'
import {
  computeCoverageMetrics,
  extractMainType,
  buildCoverageMatrix,
  type TestInput,
  type CoverageTier,
} from './coverage'

// ---------------------------------------------------------------------------
// extractMainType
// ---------------------------------------------------------------------------

describe('extractMainType', () => {
  it('classifies api by suite file name keyword', () => {
    expect(extractMainType('test name', 'api.spec.ts')).toBe('api')
    expect(extractMainType('test name', 'contract.spec.ts')).toBe('api')
  })

  it('classifies smoke tests by suite file name', () => {
    expect(extractMainType('test name', 'smoke.spec.ts')).toBe('smoke')
    expect(extractMainType('test name', 'sanity.spec.ts')).toBe('smoke')
  })

  it('classifies frontend / ui by suite file name', () => {
    expect(extractMainType('test name', 'frontend.spec.ts')).toBe('frontend')
    expect(extractMainType('test name', 'ui.spec.ts')).toBe('frontend')
  })

  it('classifies e2e by suite keyword', () => {
    expect(extractMainType('test name', 'e2e.spec.ts')).toBe('e2e')
  })

  it('classifies regression by suite keyword', () => {
    expect(extractMainType('test name', 'regression.spec.ts')).toBe('regression')
  })

  it('classifies workflow / journey by suite keyword', () => {
    expect(extractMainType('test name', 'workflow.spec.ts')).toBe('workflow')
    expect(extractMainType('test name', 'journey.spec.ts')).toBe('workflow')
  })

  it('classifies performance tests by keyword', () => {
    expect(extractMainType('test name', 'performance.spec.ts')).toBe('performance')
    expect(extractMainType('test name', 'perf.spec.ts')).toBe('performance')
  })

  it('classifies stress by keyword', () => {
    expect(extractMainType('test name', 'stress-test.spec.ts')).toBe('stress')
    expect(extractMainType('test name', 'burst.spec.ts')).toBe('stress')
  })

  it('classifies accessibility by keyword', () => {
    expect(extractMainType('test name', 'accessibility.spec.ts')).toBe('accessibility')
    expect(extractMainType('test name', 'a11y.spec.ts')).toBe('accessibility')
  })

  it('classifies api from [CAT:api_contract] in test name', () => {
    const result = extractMainType('login flow [CAT:api_contract]', 'unknown.spec.ts')
    expect(result).toBe('api')
  })

  it('classifies frontend from [CAT:ui_flow] in test name', () => {
    const result = extractMainType('click button [CAT:ui_flow]', 'unknown.spec.ts')
    expect(result).toBe('frontend')
  })

  it('strips healix- prefix before keyword matching', () => {
    expect(extractMainType('test', 'healix-smoke.spec.ts')).toBe('smoke')
    expect(extractMainType('test', 'healix-api.spec.ts')).toBe('api')
  })

  it('returns "other" for unclassifiable suites', () => {
    const result = extractMainType('some test', 'index.spec.ts')
    expect(result).toBe('other')
  })
})

// ---------------------------------------------------------------------------
// computeCoverageMetrics
// ---------------------------------------------------------------------------

describe('computeCoverageMetrics', () => {
  it('returns all-zero metrics for an empty tests array', () => {
    const metrics = computeCoverageMetrics([], 0)
    expect(metrics.coverageScore).toBe(0)
    expect(metrics.functionalCoverage).toBe(0)
    expect(metrics.totalSuites).toBe(0)
    expect(metrics.apiTests).toBe(0)
    expect(metrics.uiTests).toBe(0)
    expect(metrics.apiCoverage).toBeNull()
    expect(metrics.uiCoverage).toBeNull()
  })

  it('computes functionalCoverage as % of suites with ≥1 passing test', () => {
    const tests: TestInput[] = [
      { name: 'passes', suite: 'smoke.spec.ts', status: 'passed' },
      { name: 'fails', suite: 'api.spec.ts', status: 'failed' },
    ]
    const metrics = computeCoverageMetrics(tests, 50)
    expect(metrics.totalSuites).toBe(2)
    expect(metrics.suitesWithPass).toBe(1)
    expect(metrics.functionalCoverage).toBe(50)
  })

  it('functionalCoverage is 100 when all suites have at least one pass', () => {
    const tests: TestInput[] = [
      { name: 'a', suite: 'smoke.spec.ts', status: 'passed' },
      { name: 'b', suite: 'api.spec.ts', status: 'passed' },
    ]
    const metrics = computeCoverageMetrics(tests, 100)
    expect(metrics.functionalCoverage).toBe(100)
  })

  it('counts API tests correctly', () => {
    const tests: TestInput[] = [
      { name: 'API test 1', suite: 'api.spec.ts', status: 'passed' },
      { name: 'API test 2', suite: 'api.spec.ts', status: 'failed' },
      { name: 'UI test', suite: 'frontend.spec.ts', status: 'passed' },
    ]
    const metrics = computeCoverageMetrics(tests, 67)
    expect(metrics.apiTests).toBe(2)
    expect(metrics.apiPassed).toBe(1)
    expect(metrics.apiCoverage).toBe(50)
  })

  it('apiCoverage is null when no API tests', () => {
    const tests: TestInput[] = [
      { name: 'UI test', suite: 'frontend.spec.ts', status: 'passed' },
    ]
    expect(computeCoverageMetrics(tests, 100).apiCoverage).toBeNull()
  })

  it('counts UI tests (frontend, smoke, e2e)', () => {
    const tests: TestInput[] = [
      { name: 'nav smoke', suite: 'smoke.spec.ts', status: 'passed' },
      { name: 'form e2e', suite: 'e2e.spec.ts', status: 'failed' },
      { name: 'dashboard ui', suite: 'frontend.spec.ts', status: 'passed' },
    ]
    const metrics = computeCoverageMetrics(tests, 67)
    expect(metrics.uiTests).toBe(3)
    expect(metrics.uiPassed).toBe(2)
    expect(metrics.uiCoverage).toBe(67)
  })

  it('uiCoverage is null when no UI tests', () => {
    const tests: TestInput[] = [
      { name: 'api test', suite: 'api.spec.ts', status: 'passed' },
    ]
    expect(computeCoverageMetrics(tests, 100).uiCoverage).toBeNull()
  })

  it('classifies happy-path tests by name regex', () => {
    const tests: TestInput[] = [
      { name: 'should display the dashboard', suite: 'suite.spec.ts', status: 'passed' },
      { name: 'loads correctly after login', suite: 'suite.spec.ts', status: 'passed' },
      { name: 'random test', suite: 'suite.spec.ts', status: 'failed' },
    ]
    const metrics = computeCoverageMetrics(tests, 67)
    expect(metrics.happyTotal).toBe(2)
    expect(metrics.happyPassed).toBe(2)
  })

  it('classifies edge-case tests by name regex', () => {
    const tests: TestInput[] = [
      { name: 'handles empty input', suite: 'suite.spec.ts', status: 'passed' },
      { name: 'rejects invalid email', suite: 'suite.spec.ts', status: 'passed' },
      { name: 'normal test', suite: 'suite.spec.ts', status: 'passed' },
    ]
    const metrics = computeCoverageMetrics(tests, 100)
    expect(metrics.edgeTotal).toBe(2)
    expect(metrics.edgePassed).toBe(2)
  })

  it('classifies failure tests by name regex', () => {
    const tests: TestInput[] = [
      { name: 'shows error on bad password', suite: 'suite.spec.ts', status: 'passed' },
      { name: 'returns unauthorized for missing token', suite: 'suite.spec.ts', status: 'failed' },
      { name: 'normal happy test', suite: 'suite.spec.ts', status: 'passed' },
    ]
    const metrics = computeCoverageMetrics(tests, 67)
    expect(metrics.failureTotal).toBe(2)
    expect(metrics.failurePassed).toBe(1)
  })

  it('coverageScore is computed as a weighted formula', () => {
    // All 100%: score = 100*0.35 + 100*0.30 + 100*0.20 + 100*0.15 = 100
    const tests: TestInput[] = [
      { name: 'api test', suite: 'api.spec.ts', status: 'passed' },
      { name: 'ui test', suite: 'smoke.spec.ts', status: 'passed' },
    ]
    const metrics = computeCoverageMetrics(tests, 100)
    expect(metrics.coverageScore).toBe(100)
  })

  it('coverageScore is 0 when passRate is 0 and no tests pass', () => {
    const tests: TestInput[] = [
      { name: 'test', suite: 'smoke.spec.ts', status: 'failed' },
    ]
    const metrics = computeCoverageMetrics(tests, 0)
    expect(metrics.coverageScore).toBe(0)
  })

  it('accepts "pass" (short form) as a passing status', () => {
    const tests: TestInput[] = [
      { name: 'test', suite: 'smoke.spec.ts', status: 'pass' },
    ]
    const metrics = computeCoverageMetrics(tests, 100)
    expect(metrics.suitesWithPass).toBe(1)
  })

  it('is case-insensitive for passed status', () => {
    const tests: TestInput[] = [
      { name: 't', suite: 's', status: 'PASSED' },
    ]
    const metrics = computeCoverageMetrics(tests, 100)
    expect(metrics.suitesWithPass).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// buildCoverageMatrix
// ---------------------------------------------------------------------------

describe('buildCoverageMatrix', () => {
  it('returns empty matrix for no ACs', () => {
    const result = buildCoverageMatrix([], [], new Map())
    expect(result.rows).toHaveLength(0)
    expect(result.totals.acsTotal).toBe(0)
    expect(result.totals.acsCovered).toBe(0)
    expect(result.totals.byTier).toEqual({ L0: 0, L1: 0, L2: 0, L3: 0 })
  })

  it('creates a row per AC with all-red cells when no tests registered', () => {
    const acs = [{ id: 'AC-1.1', description: 'User can log in' }]
    const result = buildCoverageMatrix(acs, [], new Map())
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.acId).toBe('AC-1.1')
    expect(row.totalCovered).toBe(0)
    for (const tier of ['L0', 'L1', 'L2', 'L3'] as CoverageTier[]) {
      expect(row.cells[tier].status).toBe('red')
      expect(row.cells[tier].count).toBe(0)
    }
  })

  it('marks an AC cell green when it has at least one active test', () => {
    const acs = [{ id: 'AC-1', description: 'Login' }]
    const registry = [{ acId: 'AC-1', fileName: 'auth.spec.ts' }]
    const testsByFile = new Map([
      ['auth.spec.ts', [{ tier: 'L1' as CoverageTier, status: 'active' }]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows[0].cells['L1'].status).toBe('green')
    expect(result.rows[0].cells['L1'].count).toBe(1)
    expect(result.rows[0].totalCovered).toBe(1)
    expect(result.totals.acsCovered).toBe(1)
  })

  it('marks an AC cell yellow when the only test is quarantined', () => {
    const acs = [{ id: 'AC-2', description: 'Checkout' }]
    const registry = [{ acId: 'AC-2', fileName: 'checkout.spec.ts' }]
    const testsByFile = new Map([
      ['checkout.spec.ts', [{ tier: 'L1' as CoverageTier, status: 'flake-quarantine' }]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows[0].cells['L1'].status).toBe('yellow')
    expect(result.rows[0].cells['L1'].count).toBe(0)
    expect(result.rows[0].cells['L1'].quarantined).toBe(1)
    expect(result.rows[0].totalCovered).toBe(0)
    expect(result.totals.acsCovered).toBe(0)
  })

  it('skips soft-deleted tests', () => {
    const acs = [{ id: 'AC-3', description: 'Search' }]
    const registry = [{ acId: 'AC-3', fileName: 'search.spec.ts' }]
    const testsByFile = new Map([
      ['search.spec.ts', [{ tier: 'L0' as CoverageTier, status: 'soft-deleted' }]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows[0].cells['L0'].count).toBe(0)
    expect(result.rows[0].cells['L0'].status).toBe('red')
  })

  it('handles null tier by defaulting to L1', () => {
    const acs = [{ id: 'AC-4', description: 'Profile' }]
    const registry = [{ acId: 'AC-4', fileName: 'profile.spec.ts' }]
    const testsByFile = new Map([
      ['profile.spec.ts', [{ tier: null, status: 'active' }]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows[0].cells['L1'].count).toBe(1)
    expect(result.rows[0].cells['L1'].status).toBe('green')
  })

  it('aggregates totals.byTier correctly across multiple ACs', () => {
    const acs = [
      { id: 'AC-1', description: 'Login' },
      { id: 'AC-2', description: 'Signup' },
    ]
    const registry = [
      { acId: 'AC-1', fileName: 'auth.spec.ts' },
      { acId: 'AC-2', fileName: 'signup.spec.ts' },
    ]
    const testsByFile = new Map([
      ['auth.spec.ts', [
        { tier: 'L0' as CoverageTier, status: 'active' },
        { tier: 'L1' as CoverageTier, status: 'active' },
      ]],
      ['signup.spec.ts', [
        { tier: 'L1' as CoverageTier, status: 'active' },
      ]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.totals.byTier.L0).toBe(1)
    expect(result.totals.byTier.L1).toBe(2)
    expect(result.totals.acsCovered).toBe(2)
  })

  it('ignores registry entries for unknown ACs', () => {
    const acs = [{ id: 'AC-1', description: 'Login' }]
    const registry = [
      { acId: 'AC-1', fileName: 'auth.spec.ts' },
      { acId: 'AC-NONEXISTENT', fileName: 'ghost.spec.ts' },
    ]
    const testsByFile = new Map([
      ['auth.spec.ts', [{ tier: 'L1' as CoverageTier, status: 'active' }]],
    ])
    // Should not throw; AC-NONEXISTENT is skipped
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows).toHaveLength(1)
    expect(result.totals.acsCovered).toBe(1)
  })

  it('an AC with multiple files aggregates counts across all files', () => {
    const acs = [{ id: 'AC-1', description: 'Auth' }]
    const registry = [
      { acId: 'AC-1', fileName: 'login.spec.ts' },
      { acId: 'AC-1', fileName: 'oauth.spec.ts' },
    ]
    const testsByFile = new Map([
      ['login.spec.ts', [{ tier: 'L1' as CoverageTier, status: 'active' }]],
      ['oauth.spec.ts', [{ tier: 'L1' as CoverageTier, status: 'active' }]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows[0].cells['L1'].count).toBe(2)
    expect(result.totals.byTier.L1).toBe(2)
  })

  it('ignores tests with invalid (unknown) tier values', () => {
    const acs = [{ id: 'AC-1', description: 'Login' }]
    const registry = [{ acId: 'AC-1', fileName: 'auth.spec.ts' }]
    const testsByFile = new Map([
      ['auth.spec.ts', [{ tier: 'INVALID' as CoverageTier, status: 'active' }]],
    ])
    const result = buildCoverageMatrix(acs, registry, testsByFile)
    expect(result.rows[0].totalCovered).toBe(0)
  })
})
