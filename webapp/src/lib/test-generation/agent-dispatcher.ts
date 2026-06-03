/**
 * Feature-based agent dispatcher.
 *
 * Replaces the old rule-based 5-agent plan with a per-feature dispatch:
 *   - 'auth'  → auth tests + auth-actions.ts + auth-setup.ts  (always first)
 *   - 'ui'    → {feature}-actions.ts + {feature}-ui.spec.ts
 *   - 'api'   → {feature}-api.spec.ts
 *   - 'e2e'   → e2e-workflows.spec.ts  (always last)
 *
 * The MCP pipeline-worker controls the loop order:
 *   1. auth (blocking)
 *   2. sequential feature loop — UI + API in parallel per testType
 *   3. E2E (blocking, after all features)
 *   4. Dynamic playwright.config.ts generation
 */

import { OpenAITestGenerator, OpenAITestGeneratorConfig } from './openai-generator'
import type {
  FeatureAgentType,
  FeatureManifest,
  AgentCompleteHook,
  GenerateTestsParams,
  GeneratedTestFile,
  GenerationMeta,
  GenerationQuality,
  PRDFeature,
  TestCaseSpec,
} from './types'

export interface DispatchParams extends GenerateTestsParams {
  generatorConfig?: OpenAITestGeneratorConfig
  onAgentComplete?: AgentCompleteHook
  abortSignal?: AbortSignal
}

export interface DispatchResult {
  files: GeneratedTestFile[]
  summary: {
    totalFiles: number
    files: GeneratedTestFile[]
    generationMeta: GenerationMeta | null
    generationQuality: GenerationQuality | null
    tokenUsage: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
      modelUsed: string | null
    }
    byType: Record<string, number>
    agentRuns: Array<import('./types').AgentRunRecord>
  }
  agentType: FeatureAgentType
  featureId: string | null
}

/**
 * Dispatch a single feature+agentType generation unit.
 *
 * Callers pass:
 *   params.agentType   — which agent to run ('auth' | 'ui' | 'api' | 'e2e')
 *   params.featureId   — PRDFeature.id to scope the AC list (null for auth/e2e)
 *   params.featureManifest — list of feature action signatures (e2e only)
 */
export async function dispatchFeature(params: DispatchParams): Promise<DispatchResult> {
  const agentType: FeatureAgentType = params.agentType ?? 'ui'
  const featureId = params.featureId ?? null

  const generator = new OpenAITestGenerator(params.generatorConfig)
  generator.setAbortSignal(params.abortSignal)

  const files = await generator.generateTests({
    context: params.context,
    prd: params.prd,
    parsedPRD: params.parsedPRD,
    explorationArtifact: params.explorationArtifact,
    roles: params.roles,
    testType: params.testType,
    projectInfo: params.projectInfo,
    options: params.options,
    onAgentComplete: params.onAgentComplete,
    agentType,
    featureId,
    featureManifest: params.featureManifest,
    specs: params.specs,
  })

  const summary = generator.getSummary()
  return { files, summary, agentType, featureId }
}

/**
 * Resolve the PRDFeature object from parsedPRD by featureId.
 * Returns null when featureId is null or not found.
 */
export function resolveFeature(
  parsedPRD: import('./types').ParsedPRD | null | undefined,
  featureId: string | null | undefined,
): PRDFeature | null {
  if (!featureId || !parsedPRD?.features) return null
  return parsedPRD.features.find((f) => f.id === featureId) ?? null
}

/**
 * Detect the auth feature in a parsed PRD.
 *
 * The auth feature is the one whose name matches common auth patterns
 * (authentication, login, auth, sign-in) OR is the first feature that
 * contains ACs with authRequired: true.
 *
 * Returns null when no auth feature is detected.
 */
export function detectAuthFeature(
  parsedPRD: import('./types').ParsedPRD | null | undefined,
): PRDFeature | null {
  if (!parsedPRD?.features?.length) return null

  const AUTH_NAMES = /^(auth|authentication|login|sign.?in|sign.?up|register|account)$/i

  // First pass: name match
  for (const feature of parsedPRD.features) {
    if (AUTH_NAMES.test(feature.name.trim())) return feature
  }

  // Second pass: first feature with any authRequired AC
  for (const feature of parsedPRD.features) {
    for (const story of feature.userStories || []) {
      for (const ac of story.acceptanceCriteria || []) {
        if (ac.authRequired) return feature
      }
    }
  }

  return null
}

/**
 * Build a feature manifest entry from a feature and its generated actions file content.
 * Extracts exported function signatures via a lightweight regex parse.
 */
export function buildFeatureManifestEntry(
  feature: PRDFeature,
  actionsFileContent: string,
): FeatureManifest {
  const featureSlug = feature.name
    .toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    || feature.id.toLowerCase()

  // Regex: export async function name(params): returnType {
  const fnRegex = /export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/g
  const actions: import('./types').ActionSignature[] = []
  let m: RegExpExecArray | null
  while ((m = fnRegex.exec(actionsFileContent)) !== null) {
    const name = m[1]
    const rawParams = m[2].trim()
    const params = rawParams ? rawParams.split(',').map((p) => p.trim()).filter(Boolean) : []
    actions.push({ name, params })
  }

  return {
    featureId: feature.id,
    featureSlug,
    featureName: feature.name,
    actionsFile: `${featureSlug}-actions.ts`,
    actions,
  }
}

/**
 * Generate a dynamic playwright.config.ts from the feature list and auth roles.
 */
export function generatePlaywrightConfig({
  features,
  authFeatureId,
  roles,
  testType,
  baseURL = 'http://localhost:3000',
}: {
  features: PRDFeature[]
  authFeatureId: string | null
  roles: Array<{ name?: string; role?: string; storageStatePath?: string }>
  testType: 'frontend' | 'backend' | 'both'
  baseURL?: string
}): string {
  const defaultRole = roles[0]
    ? (roles[0].name || roles[0].role || 'user').toLowerCase().replace(/[^a-z0-9_-]/g, '')
    : 'user'

  const featureSlug = (f: PRDFeature) =>
    f.name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || f.id.toLowerCase()

  const nonAuthFeatures = features.filter((f) => f.id !== authFeatureId)
  const hasAuth = authFeatureId !== null

  // Determine which spec patterns to include per testType
  const specPatternFor = (slug: string): string => {
    if (testType === 'frontend') return `**/${slug}-ui.spec.ts`
    if (testType === 'backend') return `**/${slug}-api.spec.ts`
    return `**/${slug}-*.spec.ts`
  }

  const featureProjectLines = nonAuthFeatures.map((f) => {
    const slug = featureSlug(f)
    const storageState = hasAuth ? `\n      use: { storageState: '.healix/${defaultRole}.json' },` : ''
    const deps = hasAuth ? `\n      dependencies: ['auth-setup'],` : ''
    return `    {
      name: '${slug}',
      testMatch: '${specPatternFor(slug)}',${deps}${storageState}
    }`
  })

  const allFeatureSlugs = nonAuthFeatures.map((f) => `'${featureSlug(f)}'`).join(', ')

  const authProject = hasAuth
    ? `    {
      name: 'auth-setup',
      testMatch: '**/auth-setup.ts',
    },\n`
    : ''

  const e2eProject = `    {
      name: 'e2e',
      testMatch: '**/e2e-workflows.spec.ts',
      dependencies: [${allFeatureSlugs}],
    }`

  return `// playwright.config.ts — generated by Healix. Do not edit manually.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/generated',
  fullyParallel: false,
  use: {
    baseURL: '${baseURL}',
    trace: 'on-first-retry',
  },
  projects: [
${authProject}${featureProjectLines.join(',\n')},
${e2eProject},
  ],
})
`
}
