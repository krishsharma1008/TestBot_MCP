/**
 * Scenario planner — Phase 1 of two-phase test generation.
 *
 * Given one PRDFeature and the exploration artifact from the running app,
 * produces a TestCaseSpec[] that describes WHAT to test without writing code.
 * The code generators (Phase 2) receive these specs and only write Playwright.
 *
 * targetRoute and targetEndpoint are resolved from ExplorationArtifact so
 * PRDs that contain no technical page/endpoint details still produce
 * well-targeted specs.
 */

import { z } from 'zod'
import { OpenAIClient } from './openai-client'
import { resolveConfiguredOpenAIModel } from '@/lib/model-defaults'
import type {
  TestCaseSpec,
  FeatureTestPlan,
  PRDFeature,
  ExplorationArtifact,
  CapturedContext,
  ApiEndpoint,
  ProjectInfo,
  OpenAIUsage,
} from './types'

const EMPTY_USAGE: OpenAIUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

/** FeatureTestPlan plus the token usage the planner LLM call consumed. */
export type FeatureTestPlanResult = FeatureTestPlan & { usage: OpenAIUsage }

// ── Zod schema for LLM response validation ────────────────────────────────────

const TestCaseSpecSchema = z.object({
  id: z.string().min(1),
  featureId: z.string().min(1),
  acId: z.string().min(1),
  agentType: z.enum(['ui', 'api']),
  kind: z.enum(['positive', 'negative', 'boundary']),
  title: z.string().min(1),
  targetRoute: z.string().optional(),
  targetEndpoint: z.string().optional(),
  preconditions: z.array(z.string()),
  steps: z.array(z.string()).min(1),
  assertions: z.array(z.string()).min(1),
})

const ScenarioPlanResponseSchema = z.array(TestCaseSpecSchema).max(60)

// ── Public interface ──────────────────────────────────────────────────────────

export interface ScenarioPlannerInput {
  feature: PRDFeature
  explorationArtifact: ExplorationArtifact | null
  context?: CapturedContext | null       // source of apiEndpoints
  testType: 'frontend' | 'backend' | 'both'
  prd?: string
  projectInfo?: ProjectInfo
}

export async function planFeatureTestCases(
  input: ScenarioPlannerInput,
  openaiApiKey: string
): Promise<FeatureTestPlanResult> {
  const { feature, explorationArtifact, context, testType, prd, projectInfo } = input

  const client = new OpenAIClient({
    apiKey: openaiApiKey,
    model: resolveConfiguredOpenAIModel(),
    maxTokens: 4000,
    temperature: 0.1,
  })

  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt({ feature, explorationArtifact, context, testType, prd, projectInfo })

  let specs: TestCaseSpec[] = []
  let usage: OpenAIUsage = EMPTY_USAGE

  try {
    const result = await client.callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    usage = result.usage ?? EMPTY_USAGE

    const raw = extractJsonArray(result.text)
    const parsed = ScenarioPlanResponseSchema.safeParse(raw)

    if (parsed.success) {
      specs = parsed.data as TestCaseSpec[]
    } else {
      console.warn('[scenario-planner] schema validation failed', parsed.error.format())
      specs = coerceSpecs(raw, feature.id)
    }
  } catch (err) {
    console.warn('[scenario-planner] LLM call failed, returning empty plan', (err as Error).message)
    specs = []
  }

  // Ensure featureId is always set correctly regardless of what LLM returned
  specs = specs.map((s) => ({ ...s, featureId: feature.id }))

  // Filter by testType
  if (testType === 'frontend') specs = specs.filter((s) => s.agentType === 'ui')
  if (testType === 'backend') specs = specs.filter((s) => s.agentType === 'api')

  return {
    featureId: feature.id,
    featureName: feature.name,
    plannedAt: new Date().toISOString(),
    specs,
    usage,
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a senior QA engineer writing a test plan. Your job is to decide WHAT to test, not HOW to test it.

Given one product feature (user stories + acceptance criteria) and observed application data (routes, forms, API endpoints), produce a list of test case specifications in JSON.

Rules:
- Return a JSON array of test case objects. No markdown, no code fences, just the JSON array.
- Do NOT write any Playwright or test code.
- For each acceptance criterion, produce at least: 1 positive case, 1 negative case, 1 boundary case.
- Assign agentType "ui" for browser-interaction tests and "api" for HTTP API tests.
- Resolve targetRoute from the observed routes list (exact path string). Leave undefined if no matching route.
- Resolve targetEndpoint from the observed API endpoints (format: "METHOD /path"). Leave undefined if not found.
- title must be a plain human-readable label — do NOT include [REQ:...] or [positive] prefixes.
- steps and assertions must be plain English sentences.
- id format: "{featureId}-UI-{nn}" for ui specs, "{featureId}-API-{nn}" for api specs, zero-padded to 2 digits.

JSON schema for each item:
{
  "id": string,
  "featureId": string,
  "acId": string,
  "agentType": "ui" | "api",
  "kind": "positive" | "negative" | "boundary",
  "title": string,
  "targetRoute": string | undefined,
  "targetEndpoint": string | undefined,
  "preconditions": string[],
  "steps": string[],
  "assertions": string[]
}`
}

function buildUserPrompt({
  feature,
  explorationArtifact,
  context,
  testType,
  prd,
  projectInfo,
}: ScenarioPlannerInput): string {
  const sections: string[] = []

  sections.push(`## Feature: ${feature.name} (${feature.id})`)

  for (const story of feature.userStories) {
    sections.push(`\n### User Story ${story.id}: ${story.goal}`)
    sections.push(`Persona: ${story.persona}`)
    for (const ac of story.acceptanceCriteria) {
      const authNote = ac.authRequired ? ` [auth required${ac.roleHint ? `, role: ${ac.roleHint}` : ''}]` : ''
      sections.push(`- AC ${ac.id}${authNote}: ${ac.text}`)
    }
  }

  if (explorationArtifact) {
    if (explorationArtifact.routes?.length) {
      sections.push('\n## Observed Routes')
      for (const route of explorationArtifact.routes) {
        const auth = route.requiresAuth ? ' (auth required)' : ''
        sections.push(`- ${route.path}${auth}`)
      }
    }

    if (explorationArtifact.forms?.length) {
      sections.push('\n## Observed Forms')
      for (const form of explorationArtifact.forms) {
        const fields = form.fields.map((f) => `${f.name}(${f.type}${f.required ? ',required' : ''})`).join(', ')
        sections.push(`- ${form.route}: [${fields}] submit="${form.submitLabel}"`)
      }
    }

    // API endpoints come from CapturedContext (context-gatherer network intercepts),
    // not from ExplorationArtifact whose route.elements stores ARIA roles only.
    const apiEndpoints = formatApiEndpoints(context?.apiEndpoints)
    if (apiEndpoints.length) {
      sections.push('\n## Observed API Endpoints')
      for (const ep of apiEndpoints) {
        sections.push(`- ${ep}`)
      }
    }

    if (explorationArtifact.keyFlows?.length) {
      sections.push('\n## Observed Key Flows')
      for (const flow of explorationArtifact.keyFlows) {
        sections.push(`- ${flow.name}: ends with "${flow.endCondition}"`)
      }
    }
  }

  if (prd?.trim()) {
    const trimmed = prd.trim().slice(0, 3000)
    sections.push(`\n## PRD Excerpt\n${trimmed}${prd.length > 3000 ? '\n...(truncated)' : ''}`)
  }

  if (projectInfo?.baseURL) {
    sections.push(`\n## Base URL: ${projectInfo.baseURL}`)
  }

  const scopeNote =
    testType === 'frontend' ? '\nScope: UI tests only (agentType "ui")'
    : testType === 'backend' ? '\nScope: API tests only (agentType "api")'
    : '\nScope: both UI and API tests'
  sections.push(scopeNote)

  sections.push('\nReturn a JSON array of test case specs for this feature.')

  return sections.join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim()
  // Response may be a bare array or wrapped in {"specs": [...]}
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) } catch { /* fall through */ }
  }
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>
    const key = Object.keys(obj).find((k) => Array.isArray(obj[k]))
    if (key) return obj[key]
  } catch { /* fall through */ }
  // Last resort: find first [...] block
  const match = trimmed.match(/\[[\s\S]*\]/)
  if (match) {
    try { return JSON.parse(match[0]) } catch { /* fall through */ }
  }
  return []
}

function formatApiEndpoints(apiEndpoints: ApiEndpoint[] | undefined | null): string[] {
  if (!apiEndpoints?.length) return []
  return [...new Set(
    apiEndpoints.map((ep) => {
      const method = (ep.method || 'GET').toUpperCase()
      const auth = ep.requiresAuth || ep.authRequired ? ' (auth)' : ''
      return `${method} ${ep.path}${auth}`
    })
  )]
}

function coerceSpecs(raw: unknown, featureId: string): TestCaseSpec[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item, i): TestCaseSpec[] => {
    if (typeof item !== 'object' || item === null) return []
    const r = item as Record<string, unknown>
    if (!r.acId || !r.agentType || !r.kind || !r.title) return []
    const agentType = r.agentType === 'api' ? 'api' : 'ui'
    const kind = ['positive', 'negative', 'boundary'].includes(String(r.kind))
      ? (r.kind as 'positive' | 'negative' | 'boundary')
      : 'positive'
    const idx = String(i + 1).padStart(2, '0')
    return [{
      id: String(r.id || `${featureId}-${agentType.toUpperCase()}-${idx}`),
      featureId,
      acId: String(r.acId),
      agentType,
      kind,
      title: String(r.title),
      targetRoute: r.targetRoute ? String(r.targetRoute) : undefined,
      targetEndpoint: r.targetEndpoint ? String(r.targetEndpoint) : undefined,
      preconditions: toStringArray(r.preconditions),
      steps: toStringArray(r.steps),
      assertions: toStringArray(r.assertions),
    }]
  })
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string') return [val]
  return []
}
