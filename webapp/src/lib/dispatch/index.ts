/**
 * Outbound dispatch router.
 *
 * For every finding ingested from the MCP, the dispatcher:
 *   1. Resolves a customer-specific routing config (`.healix/dispatch.json`)
 *      sent with the ingest body.
 *   2. Finds every rule whose `match` ANDs match the finding.
 *   3. For each matching adapter, checks the idempotency ledger and
 *      dispatches if this finding has never been sent to that adapter
 *      for this user before.
 *   4. Records a row in `dispatched_findings` on success.
 *
 * Adapter failures are caught and reported — they must NOT break the
 * containing ingest request.
 */

import { db as defaultDb } from '@/lib/db'
import { parseDispatchConfig } from './config-loader'
import { findMatchingRoutes } from './matcher'
import { checkIdempotency, recordDispatch } from './idempotency'
import { slack } from './adapters/slack'
import { github } from './adapters/github'
import { jira } from './adapters/jira'
import type {
  Adapter,
  AdapterName,
  DispatchConfig,
  DispatchRoute,
  Finding,
} from './types'

type Db = typeof defaultDb

const DEFAULT_ADAPTERS: Record<AdapterName, Adapter> = {
  slack,
  github,
  jira,
}

export interface DispatchOutcome {
  adapter: AdapterName
  status: 'sent' | 'skipped_duplicate' | 'failed' | 'no_config'
  externalRef?: string | null
  error?: string
}

export interface DispatchOptions {
  /** Override adapter registry for unit tests. */
  adapters?: Partial<Record<AdapterName, Adapter>>
  /** Override DB binding for unit tests. */
  db?: Db
}

function isPartialConfig(value: unknown): value is DispatchConfig {
  return !!value && typeof value === 'object' && 'routes' in (value as Record<string, unknown>)
}

export async function dispatch(
  finding: Finding,
  customerConfig: unknown,
  userId: string,
  options: DispatchOptions = {}
): Promise<DispatchOutcome[]> {
  const adapters = { ...DEFAULT_ADAPTERS, ...(options.adapters || {}) }
  const db = options.db || defaultDb

  const config = isPartialConfig(customerConfig)
    ? (customerConfig as DispatchConfig)
    : parseDispatchConfig(customerConfig)
  if (!config) {
    return [{ adapter: 'slack', status: 'no_config' }]
  }

  const routes: DispatchRoute[] = findMatchingRoutes(finding, config.routes)
  if (routes.length === 0) return []

  const outcomes: DispatchOutcome[] = []
  for (const route of routes) {
    const adapter = adapters[route.target]
    if (!adapter) {
      outcomes.push({ adapter: route.target, status: 'failed', error: `unknown adapter "${route.target}"` })
      continue
    }
    try {
      const { shouldDispatch, findingKey } = await checkIdempotency({
        userId,
        finding,
        adapter: route.target,
        db,
      })
      if (!shouldDispatch) {
        outcomes.push({ adapter: route.target, status: 'skipped_duplicate' })
        continue
      }

      const { externalRef } = await adapter.send(finding, route.config)
      await recordDispatch({
        userId,
        findingKey,
        adapter: route.target,
        externalRef,
        payload: {
          severity: finding.severity,
          category: finding.category,
          title: finding.title,
          testFile: finding.testFile ?? null,
        },
        db,
      })
      outcomes.push({ adapter: route.target, status: 'sent', externalRef })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      outcomes.push({ adapter: route.target, status: 'failed', error: message })
    }
  }
  return outcomes
}

export { parseDispatchConfig } from './config-loader'
export { matchesRule, findMatchingRoutes } from './matcher'
export { computeFindingKey } from './idempotency'
export type { Finding, DispatchConfig, DispatchRoute, AdapterName } from './types'
