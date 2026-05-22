/**
 * Loads and validates `.healix/dispatch.json`-shaped config. Callers either
 * pass an in-memory object (e.g. when the MCP forwards the file contents
 * with its ingest request) or a JSON string. Anything that doesn't match
 * the schema returns null and the dispatcher no-ops — failing closed is
 * preferable to paging Slack on a malformed config.
 */

import type {
  DispatchConfig,
  DispatchRoute,
  AdapterName,
  Severity,
} from './types'

const SUPPORTED_TARGETS: AdapterName[] = ['slack', 'github', 'jira']
const VALID_SEVERITIES: Severity[] = ['P0', 'P1', 'P2', 'P3']

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseSeverityArray(input: unknown): Severity[] | undefined {
  if (!Array.isArray(input)) return undefined
  const out: Severity[] = []
  for (const item of input) {
    if (typeof item === 'string' && (VALID_SEVERITIES as string[]).includes(item)) {
      out.push(item as Severity)
    }
  }
  return out.length > 0 ? out : undefined
}

function parseCategoryArray(input: unknown): string[] | undefined {
  if (!Array.isArray(input)) return undefined
  const out: string[] = []
  for (const item of input) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim())
    }
  }
  return out.length > 0 ? out : undefined
}

function parseRoute(raw: unknown): DispatchRoute | null {
  if (!isPlainObject(raw)) return null
  const match = isPlainObject(raw.match) ? raw.match : null
  const target = raw.target
  const config = isPlainObject(raw.config) ? raw.config : null

  if (!match || !config) return null
  if (typeof target !== 'string') return null
  if (!(SUPPORTED_TARGETS as string[]).includes(target)) return null

  const severity = parseSeverityArray(match.severity)
  const category = parseCategoryArray(match.category)
  if (!severity && !category) return null

  return {
    match: {
      ...(severity ? { severity } : {}),
      ...(category ? { category } : {}),
    },
    target: target as AdapterName,
    config: config as DispatchRoute['config'],
  }
}

export function parseDispatchConfig(input: unknown): DispatchConfig | null {
  let parsed: unknown = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input)
    } catch {
      return null
    }
  }
  if (!isPlainObject(parsed)) return null
  if (parsed.version !== 1) return null
  if (!Array.isArray(parsed.routes)) return null

  const routes: DispatchRoute[] = []
  for (const raw of parsed.routes) {
    const route = parseRoute(raw)
    if (route) routes.push(route)
  }

  if (routes.length === 0) return null
  return { version: 1, routes }
}
