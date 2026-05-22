import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The dispatcher transitively imports `@/lib/db`, which would otherwise try
// to open a real Postgres connection at import time. Stub it before any
// dispatcher modules are loaded.
const fakeDbState = {
  rows: [] as Array<{ userId: string; findingKey: string; adapter: string; externalRef: string | null; payload: unknown }>,
  insertCalls: 0,
}

vi.mock('@/lib/db', () => {
  const selectChain = () => {
    let userId = ''
    let findingKey = ''
    let adapter = ''
    return {
      from: () => ({
        where: (clause: { _userId: string; _findingKey: string; _adapter: string }) => {
          userId = clause._userId
          findingKey = clause._findingKey
          adapter = clause._adapter
          return {
            limit: async () => fakeDbState.rows.filter(
              (row) => row.userId === userId && row.findingKey === findingKey && row.adapter === adapter
            ).map(() => ({ id: 1 })),
          }
        },
      }),
    }
  }
  const insertChain = () => ({
    values: (row: { userId: string; findingKey: string; adapter: string; externalRef: string | null; payload: unknown }) => ({
      onConflictDoNothing: async () => {
        fakeDbState.insertCalls += 1
        const dup = fakeDbState.rows.find(
          (existing) =>
            existing.userId === row.userId &&
            existing.findingKey === row.findingKey &&
            existing.adapter === row.adapter
        )
        if (!dup) fakeDbState.rows.push(row)
      },
    }),
  })
  const db = {
    select: () => selectChain(),
    insert: () => insertChain(),
  }
  return { db }
})

// drizzle-orm's `and` and `eq` build query AST nodes; tests don't need that.
// We collapse them to a plain object that the select-mock above can read back.
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm')
  return {
    ...actual,
    and: (...clauses: Array<Record<string, unknown>>) => Object.assign({}, ...clauses),
    eq: (col: { _name: string }, value: string) => ({ [`_${col._name}`]: value }),
  }
})

// Schema columns referenced by idempotency.ts — stub each to carry its name.
vi.mock('@/lib/db/schema', () => ({
  dispatchedFindings: {
    userId: { _name: 'userId' },
    findingKey: { _name: 'findingKey' },
    adapter: { _name: 'adapter' },
    externalRef: { _name: 'externalRef' },
    payload: { _name: 'payload' },
    dispatchedAt: { _name: 'dispatchedAt' },
    id: { _name: 'id' },
  },
}))

import {
  computeFindingKey,
  dispatch,
  findMatchingRoutes,
  matchesRule,
  parseDispatchConfig,
} from '../index'
import { __setOctokitForTests } from '../adapters/github'
import type { Adapter, DispatchConfig, Finding } from '../types'

const baseFinding: Finding = {
  signature: 'sig-abc-1',
  projectFingerprint: 'proj-xyz-1',
  severity: 'P0',
  category: 'authz',
  title: 'Admin endpoint accessible to guest',
  testFile: 'tests/admin-rbac.spec.ts',
  reproducer: { command: 'npx playwright test tests/admin-rbac.spec.ts' },
  evidence: { error: 'Expected 403 but received 200' },
}

beforeEach(() => {
  fakeDbState.rows = []
  fakeDbState.insertCalls = 0
  delete process.env.SLACK_WEBHOOK_URL
  delete process.env.GITHUB_TOKEN
  delete process.env.JIRA_BASE_URL
  delete process.env.JIRA_EMAIL
  delete process.env.JIRA_API_TOKEN
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('matchesRule', () => {
  it('ANDs severity and category', () => {
    expect(matchesRule(baseFinding, { severity: ['P0'], category: ['authz'] })).toBe(true)
    // severity matches but category does not
    expect(matchesRule(baseFinding, { severity: ['P0'], category: ['a11y'] })).toBe(false)
    // category matches but severity does not
    expect(matchesRule(baseFinding, { severity: ['P1'], category: ['authz'] })).toBe(false)
  })

  it('matches when only one key is set', () => {
    expect(matchesRule(baseFinding, { severity: ['P0', 'P1'] })).toBe(true)
    expect(matchesRule(baseFinding, { category: ['authz'] })).toBe(true)
  })

  it('returns true when match is empty', () => {
    expect(matchesRule(baseFinding, {})).toBe(true)
  })
})

describe('parseDispatchConfig', () => {
  it('parses the documented schema', () => {
    const config = parseDispatchConfig({
      version: 1,
      routes: [
        { match: { severity: ['P0'] }, target: 'slack', config: { channel: '#qa-alerts' } },
        { match: { severity: ['P0', 'P1'] }, target: 'github', config: { repo: 'owner/repo' } },
      ],
    })
    expect(config?.routes).toHaveLength(2)
    expect(config?.routes?.[0]?.target).toBe('slack')
  })

  it('rejects unknown targets', () => {
    const config = parseDispatchConfig({
      version: 1,
      routes: [{ match: { severity: ['P0'] }, target: 'discord', config: {} }],
    })
    expect(config).toBeNull()
  })

  it('rejects empty / unsupported version', () => {
    expect(parseDispatchConfig({ version: 2, routes: [] })).toBeNull()
    expect(parseDispatchConfig('not json')).toBeNull()
  })
})

describe('computeFindingKey', () => {
  it('is deterministic and 24 chars', () => {
    const a = computeFindingKey({ projectFingerprint: 'p', signature: 's' })
    const b = computeFindingKey({ projectFingerprint: 'p', signature: 's' })
    expect(a).toBe(b)
    expect(a).toHaveLength(24)
  })

  it('differs when either input differs', () => {
    const a = computeFindingKey({ projectFingerprint: 'p', signature: 's' })
    const b = computeFindingKey({ projectFingerprint: 'p2', signature: 's' })
    const c = computeFindingKey({ projectFingerprint: 'p', signature: 's2' })
    expect(new Set([a, b, c]).size).toBe(3)
  })
})

describe('dispatch idempotency', () => {
  it('dispatches once and skips on replay', async () => {
    const sent: unknown[] = []
    const stubAdapter: Adapter = {
      send: async () => {
        sent.push(1)
        return { externalRef: 'https://example.test/issue/1' }
      },
    }
    const config: DispatchConfig = {
      version: 1,
      routes: [{ match: { severity: ['P0'] }, target: 'slack', config: { channel: '#qa' } }],
    }

    const first = await dispatch(baseFinding, config, 'user-1', {
      adapters: { slack: stubAdapter },
    })
    expect(first[0]?.status).toBe('sent')
    expect(sent).toHaveLength(1)
    expect(fakeDbState.insertCalls).toBe(1)

    const second = await dispatch(baseFinding, config, 'user-1', {
      adapters: { slack: stubAdapter },
    })
    expect(second[0]?.status).toBe('skipped_duplicate')
    // Adapter must not be invoked a second time.
    expect(sent).toHaveLength(1)
    expect(fakeDbState.insertCalls).toBe(1)
  })

  it('catches adapter errors without throwing', async () => {
    const exploder: Adapter = {
      send: async () => {
        throw new Error('webhook down')
      },
    }
    const config: DispatchConfig = {
      version: 1,
      routes: [{ match: { severity: ['P0'] }, target: 'slack', config: {} }],
    }
    const outcomes = await dispatch(baseFinding, config, 'user-1', {
      adapters: { slack: exploder },
    })
    expect(outcomes[0]?.status).toBe('failed')
    expect(outcomes[0]?.error).toContain('webhook down')
    // No row recorded → next attempt should NOT be marked duplicate.
    expect(fakeDbState.rows).toHaveLength(0)
  })

  it('fans out across multiple matching routes', () => {
    const config: DispatchConfig = {
      version: 1,
      routes: [
        { match: { severity: ['P0'] }, target: 'slack', config: { channel: '#qa' } },
        { match: { severity: ['P0', 'P1'] }, target: 'github', config: { repo: 'a/b' } },
        { match: { category: ['authz', 'a11y'] }, target: 'jira', config: { project: 'QA' } },
      ],
    }
    expect(findMatchingRoutes(baseFinding, config.routes).map((r) => r.target)).toEqual([
      'slack',
      'github',
      'jira',
    ])
  })
})

describe('slack adapter', () => {
  it('posts to the webhook URL with severity emoji + payload shape', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/T/B/X'
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }) as Response)
    const { slack } = await import('../adapters/slack')
    const result = await slack.send(baseFinding, { channel: '#qa-alerts' })
    expect(result.externalRef).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://hooks.slack.test/services/T/B/X')
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    expect(body.channel).toBe('#qa-alerts')
    const blocks = body.blocks as Array<{ type: string; text?: { text: string } }>
    expect(blocks[0]?.type).toBe('header')
    expect(blocks[0]?.text?.text).toContain('P0')
    expect(blocks[0]?.text?.text).toContain('authz')
    expect(blocks[0]?.text?.text).toContain(':rotating_light:')
  })

  it('throws when SLACK_WEBHOOK_URL is missing and no override', async () => {
    const { slack } = await import('../adapters/slack')
    await expect(slack.send(baseFinding, {})).rejects.toThrow(/SLACK_WEBHOOK_URL/)
  })
})

describe('github adapter', () => {
  it('calls octokit.issues.create with the correct owner/repo and labels', async () => {
    process.env.GITHUB_TOKEN = 'ghp_stub'
    const issuesCreate = vi.fn().mockResolvedValue({
      data: { html_url: 'https://github.com/owner/repo/issues/42' },
    })
    const fakeOctokit = { issues: { create: issuesCreate } }
    __setOctokitForTests(fakeOctokit as unknown as Parameters<typeof __setOctokitForTests>[0])

    const { github } = await import('../adapters/github')
    const result = await github.send(baseFinding, { repo: 'owner/repo', labels: ['extra'] })
    expect(result.externalRef).toBe('https://github.com/owner/repo/issues/42')
    expect(issuesCreate).toHaveBeenCalledTimes(1)
    const args = issuesCreate.mock.calls[0][0] as {
      owner: string
      repo: string
      title: string
      body: string
      labels: string[]
    }
    expect(args.owner).toBe('owner')
    expect(args.repo).toBe('repo')
    expect(args.title).toMatch(/^\[Healix\] P0 authz:/)
    expect(args.labels).toEqual(expect.arrayContaining(['healix', 'p0', 'authz', 'extra']))
    expect(args.body).toContain('Reproducer')
    expect(args.body).toContain('npx playwright test')
    __setOctokitForTests(null)
  })
})

describe('jira adapter', () => {
  it('sends ADF description and a Basic auth header', async () => {
    process.env.JIRA_BASE_URL = 'https://example.atlassian.net'
    process.env.JIRA_EMAIL = 'qa@example.com'
    process.env.JIRA_API_TOKEN = 'token-xyz'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ key: 'QA-123' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }) as Response
    )
    const { jira } = await import('../adapters/jira')
    const result = await jira.send(baseFinding, { project: 'QA', issueType: 'Bug' })
    expect(result.externalRef).toBe('https://example.atlassian.net/browse/QA-123')
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://example.atlassian.net/rest/api/3/issue')
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers.authorization).toMatch(/^Basic /)
    // base64("qa@example.com:token-xyz") = cWFAZXhhbXBsZS5jb206dG9rZW4teHl6
    expect(headers.authorization).toContain('cWFAZXhhbXBsZS5jb206dG9rZW4teHl6')
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
    expect((body.fields as Record<string, unknown>).project).toEqual({ key: 'QA' })
    expect((body.fields as Record<string, unknown>).issuetype).toEqual({ name: 'Bug' })
    const desc = (body.fields as Record<string, unknown>).description as {
      type: string
      content: Array<{ type: string }>
    }
    expect(desc.type).toBe('doc')
    expect(desc.content).toHaveLength(2)
    expect(desc.content[0]?.type).toBe('paragraph')
  })
})

describe('acceptance scenario from prompt 4 hackathon brief', () => {
  it('one pulseboard run dispatches 2 Slack + 3 GitHub; a second run dispatches 0', async () => {
    const slackCalls: string[] = []
    const githubCalls: string[] = []
    const stubSlack: Adapter = {
      send: async (f) => {
        slackCalls.push(f.signature)
        return { externalRef: null }
      },
    }
    const stubGithub: Adapter = {
      send: async (f) => {
        githubCalls.push(f.signature)
        return { externalRef: `https://github.test/issues/${f.signature}` }
      },
    }
    const stubJira: Adapter = {
      send: async () => ({ externalRef: null }),
    }
    const adapters = { slack: stubSlack, github: stubGithub, jira: stubJira }

    // Routes designed to hit the hackathon AC exactly: 2 Slack + 3 GitHub.
    //   slack matches severity=P0 (one finding) AND category=validation (one finding) → 2
    //   github matches severity=P1 only (three findings) → 3
    const config: DispatchConfig = {
      version: 1,
      routes: [
        { match: { severity: ['P0'] }, target: 'slack', config: {} },
        { match: { category: ['validation'] }, target: 'slack', config: {} },
        { match: { severity: ['P1'] }, target: 'github', config: { repo: 'a/b' } },
      ],
    }

    // 8 findings, mirroring the wi1d5l rollup shape: 1 P0, 3 P1, 4 P2.
    const findings: Finding[] = [
      { ...baseFinding, signature: 'f0', severity: 'P0', category: 'authz' },
      { ...baseFinding, signature: 'f1', severity: 'P1', category: 'http_contract' },
      { ...baseFinding, signature: 'f2', severity: 'P1', category: 'validation' },
      { ...baseFinding, signature: 'f3', severity: 'P1', category: 'filter_logic' },
      { ...baseFinding, signature: 'f4', severity: 'P2', category: 'a11y' },
      { ...baseFinding, signature: 'f5', severity: 'P2', category: 'a11y' },
      { ...baseFinding, signature: 'f6', severity: 'P2', category: 'a11y' },
      { ...baseFinding, signature: 'f7', severity: 'P2', category: 'a11y' },
    ]

    for (const f of findings) {
      await dispatch(f, config, 'user-x', { adapters })
    }
    expect(slackCalls).toEqual(['f0', 'f2'])
    expect(githubCalls).toEqual(['f1', 'f2', 'f3'])

    // Second pulseboard run with identical findings → no new dispatches.
    const slackBefore = slackCalls.length
    const githubBefore = githubCalls.length
    for (const f of findings) {
      await dispatch(f, config, 'user-x', { adapters })
    }
    expect(slackCalls.length).toBe(slackBefore)
    expect(githubCalls.length).toBe(githubBefore)
  })
})
