/**
 * GitHub adapter — opens an issue via the REST API.
 *
 * `repo` comes from the route config as `owner/repo`. The token lives in
 * GITHUB_TOKEN; it needs `repo` scope (or `issues:write` on the GitHub App
 * equivalent). `externalRef` is the html_url of the created issue.
 */

import { Octokit } from '@octokit/rest'
import type {
  Adapter,
  AdapterResult,
  Finding,
  GitHubRouteConfig,
} from '../types'

let cachedClient: Octokit | null = null
let cachedToken: string | null = null

function getClient(): Octokit {
  const token = process.env.GITHUB_TOKEN || ''
  if (!token) {
    throw new Error('GitHub adapter: GITHUB_TOKEN is not configured')
  }
  if (cachedClient && cachedToken === token) return cachedClient
  cachedClient = new Octokit({ auth: token })
  cachedToken = token
  return cachedClient
}

/** Test seam — used by unit tests to inject a stub Octokit. */
export function __setOctokitForTests(client: Octokit | null): void {
  cachedClient = client
  // Pin the cache key to whatever the current env token is so getClient()
  // returns the stub instead of constructing a fresh real Octokit.
  cachedToken = client ? (process.env.GITHUB_TOKEN || 'test') : null
  if (client && !process.env.GITHUB_TOKEN) process.env.GITHUB_TOKEN = 'test'
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function parseRepo(repo: string): { owner: string; repo: string } {
  const trimmed = String(repo || '').trim()
  const [owner, name] = trimmed.split('/')
  if (!owner || !name) {
    throw new Error(`GitHub adapter: invalid repo "${repo}" — expected "owner/repo"`)
  }
  return { owner, repo: name }
}

function buildBody(finding: Finding): string {
  const severity = finding.severity || 'P3'
  const category = finding.category || 'unknown'
  const testFile = finding.testFile || '(unknown file)'
  const command = finding.reproducer?.command || '(no reproducer)'
  const errorRaw = String(finding.evidence?.error ?? '').trim() || '(no error captured)'
  const errorExcerpt = truncate(errorRaw, 4000)
  const signature = finding.signature || ''

  return [
    `**Severity**: ${severity}`,
    `**Category**: ${category}`,
    `**Test file**: \`${testFile}\``,
    '',
    '**Reproducer**',
    '```bash',
    command,
    '```',
    '',
    '**Error**',
    '```',
    errorExcerpt,
    '```',
    '',
    `<sub>Healix finding signature: \`${signature}\`</sub>`,
  ].join('\n')
}

export const github: Adapter = {
  async send(finding: Finding, ruleConfig: GitHubRouteConfig): Promise<AdapterResult> {
    const { owner, repo } = parseRepo(ruleConfig.repo)
    const octokit = getClient()
    const severity = finding.severity || 'P3'
    const category = finding.category || 'unknown'
    const labels = Array.from(
      new Set(['healix', severity.toLowerCase(), category, ...(ruleConfig.labels || [])])
    ).filter(Boolean)

    const response = await octokit.issues.create({
      owner,
      repo,
      title: `[Healix] ${severity} ${category}: ${truncate(finding.title || 'Untitled finding', 200)}`,
      body: buildBody(finding),
      labels,
    })

    const externalRef = (response?.data?.html_url as string | undefined) || null
    return { externalRef }
  },
}
