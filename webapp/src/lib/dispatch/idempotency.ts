/**
 * Idempotency ledger for the dispatch router. `finding_key` is computed as
 *
 *   sha256(projectFingerprint + ":" + signature).slice(0, 24)
 *
 * Both fields are produced by `buildQaFindings` in
 * testbot-mcp/src/report-generator.js.
 *
 * Before dispatching, we check whether a row exists for
 * (user_id, finding_key, adapter). If yes, skip. After a successful
 * dispatch we insert the row — concurrent ingests are guarded by the
 * UNIQUE constraint on the table.
 */

import crypto from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db as defaultDb } from '@/lib/db'
import { dispatchedFindings } from '@/lib/db/schema'
import type { AdapterName, Finding } from './types'

type Db = typeof defaultDb

export function computeFindingKey(finding: Pick<Finding, 'projectFingerprint' | 'signature'>): string {
  const input = `${finding.projectFingerprint || ''}:${finding.signature || ''}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 24)
}

export interface IdempotencyHandle {
  /** True when no prior dispatch row exists for this (user, key, adapter). */
  shouldDispatch: boolean
  findingKey: string
}

export async function checkIdempotency({
  userId,
  finding,
  adapter,
  db = defaultDb,
}: {
  userId: string
  finding: Finding
  adapter: AdapterName
  db?: Db
}): Promise<IdempotencyHandle> {
  const findingKey = computeFindingKey(finding)
  const existing = await db
    .select({ id: dispatchedFindings.id })
    .from(dispatchedFindings)
    .where(
      and(
        eq(dispatchedFindings.userId, userId),
        eq(dispatchedFindings.findingKey, findingKey),
        eq(dispatchedFindings.adapter, adapter)
      )
    )
    .limit(1)
  return { shouldDispatch: existing.length === 0, findingKey }
}

export async function recordDispatch({
  userId,
  findingKey,
  adapter,
  externalRef,
  payload,
  db = defaultDb,
}: {
  userId: string
  findingKey: string
  adapter: AdapterName
  externalRef: string | null
  payload: Record<string, unknown> | null
  db?: Db
}): Promise<void> {
  // The UNIQUE constraint covers concurrent ingests — ON CONFLICT DO NOTHING
  // turns the otherwise-fatal race into a quiet skip.
  await db
    .insert(dispatchedFindings)
    .values({
      userId,
      findingKey,
      adapter,
      externalRef,
      payload,
    })
    .onConflictDoNothing()
}
