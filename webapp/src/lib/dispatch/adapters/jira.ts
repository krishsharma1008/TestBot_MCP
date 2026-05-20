/**
 * Jira Cloud adapter — creates an issue via REST API v3. Description must
 * be ADF (Atlassian Document Format): we send a single `doc` with two
 * `paragraph` blocks (error text, reproducer command).
 *
 * Auth uses Basic auth with the user's email + an API token from
 * https://id.atlassian.com/manage-profile/security/api-tokens.
 *
 * externalRef is `{baseUrl}/browse/{key}` — the canonical Jira URL.
 */

import type {
  Adapter,
  AdapterResult,
  Finding,
  JiraRouteConfig,
} from '../types'

interface JiraEnv {
  baseUrl: string
  email: string
  apiToken: string
}

function readEnv(): JiraEnv {
  const baseUrl = (process.env.JIRA_BASE_URL || '').replace(/\/+$/, '')
  const email = process.env.JIRA_EMAIL || ''
  const apiToken = process.env.JIRA_API_TOKEN || ''
  if (!baseUrl || !email || !apiToken) {
    throw new Error('Jira adapter: JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must all be set')
  }
  return { baseUrl, email, apiToken }
}

function basicAuthHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function buildAdfDescription(finding: Finding) {
  const errorRaw = String(finding.evidence?.error ?? '').trim() || '(no error captured)'
  const errorExcerpt = truncate(errorRaw, 4000)
  const command = finding.reproducer?.command || '(no reproducer)'

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Error:\n', marks: [{ type: 'strong' }] },
          { type: 'text', text: errorExcerpt },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Reproducer:\n', marks: [{ type: 'strong' }] },
          { type: 'text', text: command, marks: [{ type: 'code' }] },
        ],
      },
    ],
  }
}

export const jira: Adapter = {
  async send(finding: Finding, ruleConfig: JiraRouteConfig): Promise<AdapterResult> {
    const { baseUrl, email, apiToken } = readEnv()
    const projectKey = String(ruleConfig.project || '').trim()
    if (!projectKey) {
      throw new Error('Jira adapter: route config.project is required')
    }
    const issueType = String(ruleConfig.issueType || 'Bug').trim()
    const severity = finding.severity || 'P3'
    const category = finding.category || 'unknown'

    const body = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary: `[Healix] ${severity} ${category}: ${truncate(finding.title || 'Untitled finding', 240)}`,
        description: buildAdfDescription(finding),
        labels: Array.from(new Set(['healix', severity.toLowerCase(), category])).filter(Boolean),
      },
    }

    const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        authorization: basicAuthHeader(email, apiToken),
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Jira create issue failed: ${response.status} ${text}`)
    }

    const json = (await response.json().catch(() => ({}))) as { key?: string }
    const externalRef = json.key ? `${baseUrl}/browse/${json.key}` : null
    return { externalRef }
  },
}
