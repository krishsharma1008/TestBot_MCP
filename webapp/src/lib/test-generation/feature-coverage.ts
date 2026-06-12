import type { FeatureStat, FeatureCoverageEntry, FeatureCoverage } from '@/lib/coverage'

interface RawTest {
  name?: string
  title?: string
  file?: string
  suite?: string
  status?: string
}

function parseFeatureFile(fileOrSuite: string): { slug: string; type: 'ui' | 'api' | 'e2e' | 'auth' } | null {
  const base = fileOrSuite.replace(/\\/g, '/').split('/').pop() ?? fileOrSuite
  // Strip .spec.ts/.spec.js suffix, then plain .ts/.js for action/setup files
  const stripped = base.replace(/\.spec\.[jt]s$/i, '').replace(/\.[jt]s$/i, '')

  if (stripped === 'e2e-workflows') return { slug: 'e2e', type: 'e2e' }
  // Skip helper files (no test blocks)
  if (stripped.endsWith('-setup') || stripped.endsWith('-actions')) return null

  const lastDash = stripped.lastIndexOf('-')
  if (lastDash === -1) return null

  const suffix = stripped.slice(lastDash + 1)
  const slug = stripped.slice(0, lastDash)

  if ((suffix !== 'ui' && suffix !== 'api') || !slug) return null
  if (slug === 'auth') return { slug: 'auth', type: 'auth' }

  return { slug, type: suffix as 'ui' | 'api' }
}

function extractTags(title: string) {
  return {
    smoke:      /@smoke\b/.test(title),
    sanity:     /@sanity\b/.test(title),
    regression: /@regression\b/.test(title),
    positive:   /@happy-path\b/.test(title),
    negative:   /@negative\b/.test(title),
    boundary:   /@boundary\b/.test(title),
  }
}

function makeStat(): FeatureStat { return { total: 0, passed: 0, failed: 0 } }

function incStat(stat: FeatureStat, status: string): void {
  stat.total++
  if (status === 'passed' || status === 'pass') stat.passed++
  else if (status === 'failed' || status === 'fail') stat.failed++
}

function nullIfEmpty(stat: FeatureStat): FeatureStat | null {
  return stat.total > 0 ? stat : null
}

function toDisplayName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

type Accumulator = {
  displayName: string
  total: FeatureStat
  ui: FeatureStat
  api: FeatureStat
  smoke: FeatureStat
  sanity: FeatureStat
  regression: FeatureStat
  positive: FeatureStat
  negative: FeatureStat
  boundary: FeatureStat
}

export function computeFeatureCoverage(tests: RawTest[]): FeatureCoverage {
  const map = new Map<string, Accumulator>()

  for (const t of tests) {
    const fileKey = t.file ?? t.suite ?? ''
    if (!fileKey) continue

    const parsed = parseFeatureFile(fileKey)
    if (!parsed) continue

    const { slug, type } = parsed
    const title = t.title ?? t.name ?? ''
    const status = (t.status ?? 'unknown').toLowerCase()
    const tags = extractTags(title)

    if (!map.has(slug)) {
      map.set(slug, {
        displayName: toDisplayName(slug),
        total: makeStat(), ui: makeStat(), api: makeStat(),
        smoke: makeStat(), sanity: makeStat(), regression: makeStat(),
        positive: makeStat(), negative: makeStat(), boundary: makeStat(),
      })
    }

    const entry = map.get(slug)!
    incStat(entry.total, status)

    if (type === 'ui' || type === 'auth') incStat(entry.ui, status)
    else if (type === 'api') incStat(entry.api, status)

    if (tags.smoke)      incStat(entry.smoke, status)
    if (tags.sanity)     incStat(entry.sanity, status)
    if (tags.regression) incStat(entry.regression, status)
    if (tags.positive)   incStat(entry.positive, status)
    if (tags.negative)   incStat(entry.negative, status)
    if (tags.boundary)   incStat(entry.boundary, status)
  }

  const result: FeatureCoverage = {}
  for (const [slug, entry] of map.entries()) {
    result[slug] = {
      slug,
      displayName: entry.displayName,
      total:  entry.total.total,
      passed: entry.total.passed,
      failed: entry.total.failed,
      ui:         nullIfEmpty(entry.ui),
      api:        nullIfEmpty(entry.api),
      smoke:      nullIfEmpty(entry.smoke),
      sanity:     nullIfEmpty(entry.sanity),
      regression: nullIfEmpty(entry.regression),
      positive:   nullIfEmpty(entry.positive),
      negative:   nullIfEmpty(entry.negative),
      boundary:   nullIfEmpty(entry.boundary),
    } satisfies FeatureCoverageEntry
  }

  return result
}
