import type { ParsedPRD } from './types'

// Maps PRD feature IDs (e.g. 'F1') to URL-safe slugs (e.g. 'billing')
export type FeatureMap = Map<string, string>

export function buildFeatureMap(parsedPRD: ParsedPRD | null): FeatureMap {
  const map: FeatureMap = new Map()
  if (!parsedPRD) return map
  for (const feature of parsedPRD.features) {
    const slug = feature.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    if (slug) map.set(feature.id, slug)
  }
  return map
}

export function deriveExecutionTier(agentType: string, acKind: string): string[] {
  if (agentType === 'smoke' && acKind === 'positive') return ['@smoke', '@sanity', '@regression']
  if (agentType === 'frontend' && acKind === 'positive') return ['@sanity', '@regression']
  return ['@regression']
}

export function deriveNatureTag(acKind: string): string | null {
  if (acKind === 'positive') return '@happy-path'
  if (acKind === 'negative') return '@negative'
  if (acKind === 'boundary') return '@boundary'
  return null
}

function extractAcKind(title: string): string {
  const m = title.match(/\[(positive|negative|boundary)\]/i)
  return m ? m[1].toLowerCase() : ''
}

function extractFeatureId(title: string): string | null {
  // Matches [REQ:F1.S1.AC1], [REQ:F1.S1], [REQ:F1 ...] etc.
  const m = title.match(/\[REQ:(F\d+)[.\s_]/)
  return m ? m[1] : null
}

function rewriteTitle(title: string, agentType: string, featureMap: FeatureMap): string {
  // Guard: already tagged — don't process twice
  if (title.includes('@regression')) return title

  const acKind = extractAcKind(title)
  const featureId = extractFeatureId(title)

  const tags: string[] = [...deriveExecutionTier(agentType, acKind)]

  const natureTag = deriveNatureTag(acKind)
  if (natureTag) tags.push(natureTag)

  if (agentType === 'workflow') tags.push('@e2e')
  if (agentType === 'api') tags.push('@api')

  if (featureId) {
    const slug = featureMap.get(featureId)
    if (slug) tags.push(`@${slug}`)
  }

  return `${title} ${tags.join(' ')}`
}

/**
 * Rewrites every test(...) title in a Playwright spec file content string by
 * appending the appropriate Playwright tags derived from the agent type, AC
 * kind prefix, and PRD feature map.
 *
 * Handles single-quoted, double-quoted, and template-literal titles.
 * Titles that already contain @regression are left untouched.
 */
export function tagTestContent(content: string, agentType: string, featureMap: FeatureMap): string {
  const fnPattern = 'test(?:\\.(?:only|fixme|fail|slow|todo|skip))?'

  // Single-quoted titles: test('title',
  let result = content.replace(
    new RegExp(`\\b(${fnPattern})\\s*\\('((?:[^'\\\\]|\\\\.)*)'\\s*,`, 'g'),
    (_, fn, title) => `${fn}('${rewriteTitle(title, agentType, featureMap)}',`
  )

  // Double-quoted titles: test("title",
  result = result.replace(
    new RegExp(`\\b(${fnPattern})\\s*\\("((?:[^"\\\\]|\\\\.)*)"\\s*,`, 'g'),
    (_, fn, title) => `${fn}("${rewriteTitle(title, agentType, featureMap)}",`
  )

  // Template-literal titles: test(`title`, — includes ${...} interpolations
  result = result.replace(
    new RegExp(`\\b(${fnPattern})\\s*\\(\`((?:[^\`\\\\]|\\\\.)*)\`\\s*,`, 'g'),
    (_, fn, title) => `${fn}(\`${rewriteTitle(title, agentType, featureMap)}\`,`
  )

  return result
}
