import type { FeatureAgentType } from './types'

/**
 * Derives execution-tier tags based on agent type and AC kind.
 *
 * Execution tiers:
 *   @smoke      — ~10% of tests, critical happy paths, gates deployment
 *   @sanity     — ~30% of tests, post-deploy health check, fast subset
 *   @regression — ~100% of tests, full suite, runs on PRs/nightly
 */
export function deriveExecutionTier(agentType: FeatureAgentType | string, acKind: string): string[] {
  // Only the top-priority happy-path test per AC gets @smoke/@sanity.
  // The UI agent's positive tests are the closest equivalent to the old smoke agent.
  if ((agentType === 'ui' || agentType === 'auth') && acKind === 'positive') {
    return ['@smoke', '@sanity', '@regression']
  }
  if (agentType === 'api' && acKind === 'positive') {
    return ['@sanity', '@regression']
  }
  return ['@regression']
}

/**
 * Derives the test-nature tag from an AC kind string.
 *
 * Nature tags:
 *   @happy-path — positive / success path
 *   @negative   — invalid input, error state, unauthorised access
 *   @boundary   — min/max values, empty strings, edge-case limits
 */
export function deriveNatureTag(acKind: string): string | null {
  if (acKind === 'positive') return '@happy-path'
  if (acKind === 'negative') return '@negative'
  if (acKind === 'boundary') return '@boundary'
  return null
}

/** Extract the AC id from a title like "[REQ:F2.S1.AC1][positive] …" → "F2.S1.AC1" */
function extractAcId(title: string): string | null {
  const m = title.match(/\[REQ:([^\]]+)\]/)
  return m ? m[1] : null
}

function extractAcKind(title: string): string {
  const m = title.match(/\[(positive|negative|boundary)\]/i)
  return m ? m[1].toLowerCase() : ''
}

/**
 * Resolves the AC kind for a test title. When `acKindMap` is supplied (keyed
 * by AC id like "F2.S1.AC1"), its value takes precedence over the inline
 * bracket extracted from the title — useful when the caller has already parsed
 * the PRD and built a canonical mapping.
 */
function resolveAcKind(title: string, acKindMap?: Map<string, string>): string {
  if (acKindMap) {
    const acId = extractAcId(title)
    if (acId && acKindMap.has(acId)) return acKindMap.get(acId)!
  }
  return extractAcKind(title)
}

function rewriteTitle(
  title: string,
  agentType: FeatureAgentType | string,
  acKindMap?: Map<string, string>,
): string {
  // Guard: already tagged — don't process twice
  if (title.includes('@regression')) return title

  const acKind = resolveAcKind(title, acKindMap)

  const tags: string[] = [...deriveExecutionTier(agentType, acKind)]

  const natureTag = deriveNatureTag(acKind)
  if (natureTag) tags.push(natureTag)

  // Agent-type tags: @ui or @api.
  // @auth is only applied inside auth-ui.spec.ts (handled via agentType='auth').
  // @e2e is omitted — e2e tests live in their own file.
  if (agentType === 'ui') tags.push('@ui')
  if (agentType === 'api') tags.push('@api')
  if (agentType === 'auth') tags.push('@ui', '@auth')

  return `${title} ${tags.join(' ')}`
}

/**
 * Rewrites every test(...) title in a Playwright spec file content string by
 * appending the appropriate Playwright tags derived from the agent type and AC
 * kind prefix.
 *
 * Tags applied:
 *   - Execution tier : @smoke / @sanity / @regression
 *   - Test nature    : @happy-path / @negative / @boundary
 *   - Agent type     : @ui (ui/auth agents) | @api (api agent)
 *
 * Tags intentionally NOT applied here (now handled by file naming):
 *   - Scope/module   : @billing, @checkout etc. — filename carries this
 *   - @e2e           : e2e tests live in e2e-workflows.spec.ts
 *
 * @param content     Raw spec file content string.
 * @param agentType   The agent that generated this file ('ui' | 'api' | 'auth' | 'e2e').
 * @param acKindMap   Optional map of AC id → kind (e.g. "F2.S1.AC1" → "positive").
 *                    When supplied, the map takes precedence over the inline
 *                    [positive|negative|boundary] bracket in the title.
 *
 * Handles single-quoted, double-quoted, and template-literal titles.
 * Titles that already contain @regression are left untouched.
 */
export function tagTestContent(
  content: string,
  agentType: FeatureAgentType | string,
  acKindMap?: Map<string, string>,
): string {
  const fnPattern = 'test(?:\\.(?:only|fixme|fail|slow|todo|skip))?'

  // Single-quoted titles: test('title',
  let result = content.replace(
    new RegExp(`\\b(${fnPattern})\\s*\\('((?:[^'\\\\]|\\\\.)*)'\\s*,`, 'g'),
    (_, fn, title) => `${fn}('${rewriteTitle(title, agentType, acKindMap)}',`
  )

  // Double-quoted titles: test("title",
  result = result.replace(
    new RegExp(`\\b(${fnPattern})\\s*\\("((?:[^"\\\\]|\\\\.)*)"\\s*,`, 'g'),
    (_, fn, title) => `${fn}("${rewriteTitle(title, agentType, acKindMap)}",`
  )

  // Template-literal titles: test(`title`,
  result = result.replace(
    new RegExp(`\\b(${fnPattern})\\s*\\(\`((?:[^\`\\\\]|\\\\.)*)\`\\s*,`, 'g'),
    (_, fn, title) => `${fn}(\`${rewriteTitle(title, agentType, acKindMap)}\`,`
  )

  return result
}
