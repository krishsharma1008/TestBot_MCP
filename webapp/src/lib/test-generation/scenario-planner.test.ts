import { describe, it, expect } from 'vitest'
import { groundApiSpecsToEndpoints, normalizeEndpointPath } from './scenario-planner'
import type { TestCaseSpec, ApiEndpoint } from './types'

function spec(partial: Partial<TestCaseSpec>): TestCaseSpec {
  return {
    id: partial.id || 'F1-API-01',
    featureId: 'F1',
    acId: 'F1.S1.AC1',
    agentType: partial.agentType || 'api',
    kind: 'positive',
    title: partial.title || 'test',
    targetRoute: partial.targetRoute,
    targetEndpoint: partial.targetEndpoint,
    preconditions: [],
    steps: partial.steps || [],
    assertions: partial.assertions || ['something'],
  }
}

const REAL_ENDPOINTS: ApiEndpoint[] = [
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET', path: '/api/users' },
  { method: 'GET', path: '/api/users/:id' },
  { method: 'GET', path: '/api/roles' },
  { method: 'POST', path: '/api/roles' },
]

describe('normalizeEndpointPath', () => {
  it('collapses path params and strips query/trailing slash', () => {
    expect(normalizeEndpointPath('/api/users/123')).toBe('/api/users/:param')
    expect(normalizeEndpointPath('/api/users/:id')).toBe('/api/users/:param')
    expect(normalizeEndpointPath('/api/roles/?x=1')).toBe('/api/roles')
    expect(normalizeEndpointPath('/API/Roles')).toBe('/api/roles')
  })
})

describe('groundApiSpecsToEndpoints', () => {
  it('drops an api spec that targets a frontend page route (regression: /admindashboard)', () => {
    const specs = [
      spec({ id: 'F2-API-01', targetEndpoint: 'GET /admindashboard', title: 'admin shell' }),
      spec({ id: 'F2-API-02', targetEndpoint: 'POST /login', title: 'login' }),
      spec({ id: 'F2-API-03', targetEndpoint: 'GET /api/roles', title: 'list roles' }),
    ]
    const { kept, dropped } = groundApiSpecsToEndpoints(specs, REAL_ENDPOINTS)
    expect(kept.map((s) => s.id)).toEqual(['F2-API-03'])
    expect(dropped.map((s) => s.id).sort()).toEqual(['F2-API-01', 'F2-API-02'])
  })

  it('keeps a real endpoint with a concrete id (param-normalized)', () => {
    const specs = [spec({ targetEndpoint: 'GET /api/users/42' })]
    expect(groundApiSpecsToEndpoints(specs, REAL_ENDPOINTS).kept).toHaveLength(1)
  })

  it('resolves the endpoint from steps when targetEndpoint is absent', () => {
    const fromSteps = spec({ targetEndpoint: undefined, steps: ['Send GET /api/roles and expect 200'] })
    const badSteps = spec({ id: 'X', targetEndpoint: undefined, steps: ['Visit /admindashboard and expect the shell'] })
    const { kept } = groundApiSpecsToEndpoints([fromSteps, badSteps], REAL_ENDPOINTS)
    expect(kept.map((s) => s.id)).toEqual(['F1-API-01'])
  })

  it('never touches ui specs', () => {
    const specs = [spec({ agentType: 'ui', targetRoute: '/admindashboard', targetEndpoint: undefined })]
    expect(groundApiSpecsToEndpoints(specs, REAL_ENDPOINTS).kept).toHaveLength(1)
  })

  it('drops an api spec with no resolvable endpoint', () => {
    const specs = [spec({ targetEndpoint: undefined, steps: ['Do something vague'] })]
    expect(groundApiSpecsToEndpoints(specs, REAL_ENDPOINTS).dropped).toHaveLength(1)
  })

  it('leaves specs untouched when no endpoints are known (avoid false drops)', () => {
    const specs = [spec({ targetEndpoint: 'GET /whatever' })]
    expect(groundApiSpecsToEndpoints(specs, []).kept).toHaveLength(1)
  })

  it('ignores the synthetic /api/health fallback when building the real set', () => {
    const specs = [spec({ targetEndpoint: 'GET /api/health' })]
    const synthetic: ApiEndpoint[] = [{ method: 'GET', path: '/api/health', synthetic: true }]
    // /api/health is synthetic → not a real endpoint → the spec is dropped.
    expect(groundApiSpecsToEndpoints(specs, [...REAL_ENDPOINTS, ...synthetic]).dropped).toHaveLength(1)
  })
})
