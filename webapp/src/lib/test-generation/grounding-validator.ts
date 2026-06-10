/**
 * Grounding validator — mechanical enforcement of "no invented selectors".
 *
 * Replaces prompt-side rules ("please don't hallucinate text") with code-side
 * verification. Extracts every selector literal/regex from generated test
 * content and cross-checks it against a ground-truth corpus built from the
 * CapturedContext payload that was passed to the model.
 *
 * If a literal can't be grounded, the file is rejected and the correction
 * prompt receives a structured list of ungrounded literals + suggested fixes.
 *
 * This is the architectural upgrade away from accumulating hardcoded
 * anti-patterns in the prompt. The prompt now only describes the contract;
 * enforcement lives here.
 */

import type { CapturedContext } from './types'

/**
 * Role-aware element produced by the framework-agnostic extractor in
 * testbot-mcp/src/source-extractors/. Optional on CapturedContext — when
 * present, the validator upgrades from string-only grounding to role+name
 * tuple grounding. When absent (older runs, unsupported frameworks), the
 * validator falls back to the string corpus and still works.
 */
export interface RoleAwareElement {
  role: string
  accessibleName: string
  isDynamic: boolean
  attributes?: Record<string, string | number | undefined>
  sourceFile?: string
  route?: string | null
  conditional?: string | null
}

export type SelectorKind =
  | 'role-name'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'test-id'
  | 'to-have-text'
  | 'to-contain-text'
  | 'structural-landmark'

export interface UngroundedLiteral {
  literal: string
  kind: SelectorKind
  snippet: string
  suggestedFix: string
}

export interface GroundingResult {
  valid: boolean
  confidence: number
  totalLiterals: number
  groundedLiterals: number
  ungrounded: UngroundedLiteral[]
}

export interface GroundingOptions {
  /** Pass rate threshold below which the file is rejected. Default per-agent. */
  minConfidence?: number
  /** Maximum number of ungrounded literals tolerated. Default per-agent. */
  maxUngrounded?: number
  /**
   * When true, regex literals are treated as grounded if ANY ground-truth
   * string matches. When false, only literal strings are checked (regex
   * patterns are passed through). Default: true.
   */
  resolveRegex?: boolean
  /**
   * Caller-supplied "does this app expose a `main` landmark" determination.
   * The generator computes this once from context + the exploration artifact
   * (a richer source than `context` alone), so passing it here keeps the
   * structural-landmark check consistent with the normalizer's main→body
   * rewrite — otherwise the two could disagree (validator flags `main` that
   * the normalizer legitimately kept). When omitted, falls back to
   * `contextHasMainLandmark(context)`.
   */
  appHasMainLandmark?: boolean
}

// Thresholds are set to enforce a high bar for grounding. Files that fail
// are rejected and trigger the correction retry loop.
const DEFAULTS_BY_PREFIX: Record<string, { minConfidence: number; maxUngrounded: number }> = {
  smoke:    { minConfidence: 0.55, maxUngrounded: 2 },
  frontend: { minConfidence: 0.50, maxUngrounded: 4 },
  workflow: { minConfidence: 0.45, maxUngrounded: 4 },
  error:    { minConfidence: 0.45, maxUngrounded: 4 },
  api:      { minConfidence: 0.35, maxUngrounded: 8 },
  expansion:{ minConfidence: 0.45, maxUngrounded: 4 },
}

const FALLBACK_DEFAULTS = { minConfidence: 0.2, maxUngrounded: 12 }

// ────────────────────────────────────────────────────────────────────────────
// Ground-truth corpus extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build the set of provable strings from the context payload. Everything in
 * here is something the model COULD have seen during context construction.
 * If a generated literal matches any of these, it's grounded.
 */
export function buildGroundTruthCorpus(context: CapturedContext | undefined | null): Set<string> {
  const corpus = new Set<string>()
  if (!context) return corpus

  const add = (value: unknown): void => {
    if (typeof value !== 'string') return
    const normalized = value.trim().toLowerCase()
    if (normalized.length >= 2 && normalized.length <= 200) corpus.add(normalized)
  }

  // sourceContext top-level
  for (const t of context.sourceContext?.assertableText || []) add(t)
  for (const t of context.sourceContext?.testIds || []) add(t)
  for (const p of context.sourceContext?.routePaths || []) add(p)
  for (const file of context.sourceContext?.files || []) {
    for (const t of file.assertableText || []) add(t)
    for (const t of file.testIds || []) add(t)
    for (const r of file.routePaths || []) add(r)
    for (const c of file.components || []) add(c)
  }

  // forms
  for (const form of context.forms || []) {
    for (const field of form.fields || []) {
      add(field.label)
      add(field.placeholder)
      add(field.ariaLabel)
      add(field.name)
      add(field.testId)
      add(field.id)
    }
  }

  // pages
  for (const page of context.pages || []) {
    const p = page as unknown as Record<string, unknown>
    add(p.title)
    add(p.description)
    add(p.name)
    add(p.path)
    add(p.heading)
    // Buttons/links/headings observed during exploration
    for (const arr of ['buttons', 'links', 'headings', 'inputs'] as const) {
      const items = Array.isArray(p[arr]) ? (p[arr] as unknown[]) : []
      for (const item of items) {
        if (typeof item === 'string') add(item)
        else if (item && typeof item === 'object') {
          const it = item as Record<string, unknown>
          add(it.name)
          add(it.text)
          add(it.label)
          add(it.aria)
          add(it.ariaLabel)
        }
      }
    }
  }

  // workflows
  for (const wf of context.workflows || []) {
    if (typeof wf === 'string') { add(wf); continue }
    add(wf.name)
    add(wf.description)
    for (const step of wf.steps || []) add(step)
    for (const assertion of wf.criticalAssertions || []) add(assertion)
  }

  // selectorHints
  for (const hint of context.selectorHints || []) add(hint)

  // routeAccess (lives under meta in some payloads, top-level in others)
  const routeAccess =
    (context as unknown as { routeAccess?: unknown }).routeAccess ||
    ((context as unknown as { meta?: { routeAccess?: unknown } }).meta?.routeAccess)
  if (routeAccess && typeof routeAccess === 'object') {
    const ra = routeAccess as Record<string, unknown>
    for (const arr of ['publicRoutes', 'protectedRoutes'] as const) {
      const items = Array.isArray(ra[arr]) ? (ra[arr] as unknown[]) : []
      for (const it of items) add(it)
    }
    const observed = ra.observedRoutes as Record<string, unknown> | undefined
    if (observed && typeof observed === 'object') {
      for (const route of Object.values(observed)) {
        if (!route || typeof route !== 'object') continue
        const r = route as Record<string, unknown>
        for (const arr of ['headings', 'buttons', 'links', 'inputs'] as const) {
          const items = Array.isArray(r[arr]) ? (r[arr] as unknown[]) : []
          for (const item of items) {
            if (typeof item === 'string') add(item)
            else if (item && typeof item === 'object') {
              const it = item as Record<string, unknown>
              add(it.name); add(it.text); add(it.label)
            }
          }
        }
      }
    }
  }

  // QA contracts (deterministic assertions seeded from source)
  const qa = context.qaContracts as unknown
  if (qa && typeof qa === 'object') {
    const queue: unknown[] = [qa]
    while (queue.length > 0) {
      const node = queue.shift()
      if (!node) continue
      if (typeof node === 'string') { add(node); continue }
      if (Array.isArray(node)) { queue.push(...node); continue }
      if (typeof node === 'object') queue.push(...Object.values(node))
    }
  }

  return corpus
}

// ────────────────────────────────────────────────────────────────────────────
// Selector literal extraction
// ────────────────────────────────────────────────────────────────────────────

interface ExtractedLiteral {
  literal: string
  kind: SelectorKind
  snippet: string
  isRegex: boolean
  /** For role-name kind: the role passed to getByRole (e.g. "button", "link") */
  roleHint?: string | null
}

/**
 * Pull every name/text/label/placeholder/testId literal from a generated
 * Playwright test file. Handles both string and regex forms.
 */
export function extractSelectorLiterals(content: string): ExtractedLiteral[] {
  const literals: ExtractedLiteral[] = []
  if (typeof content !== 'string' || content.length === 0) return literals

  // Strip line comments so commented-out examples don't count.
  const stripped = content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  // getByRole('role', { name: /regex/i | 'string' })
  // Capture role too (group 1) so the validator can do role+name lookup
  // against the role-aware extractor output.
  const roleNameRe =
    /getByRole\(\s*['"`](\w+)['"`]\s*,\s*\{[^}]*\bname\s*:\s*(?:\/((?:\\\/|[^/])+)\/[gimsuy]*|['"`]([^'"`]+)['"`])/g
  for (const m of stripped.matchAll(roleNameRe)) {
    const isRegex = !!m[2]
    literals.push({
      literal: (m[2] || m[3] || '').trim(),
      kind: 'role-name',
      snippet: m[0].slice(0, 160),
      isRegex,
      roleHint: m[1] || null,
    })
  }

  // getByText(/regex/i | 'string')
  const textRe =
    /getByText\(\s*(?:\/((?:\\\/|[^/])+)\/[gimsuy]*|['"`]([^'"`]+)['"`])/g
  for (const m of stripped.matchAll(textRe)) {
    const isRegex = !!m[1]
    literals.push({
      literal: (m[1] || m[2] || '').trim(),
      kind: 'text',
      snippet: m[0].slice(0, 160),
      isRegex,
    })
  }

  // getByLabel
  const labelRe =
    /getByLabel\(\s*(?:\/((?:\\\/|[^/])+)\/[gimsuy]*|['"`]([^'"`]+)['"`])/g
  for (const m of stripped.matchAll(labelRe)) {
    const isRegex = !!m[1]
    literals.push({
      literal: (m[1] || m[2] || '').trim(),
      kind: 'label',
      snippet: m[0].slice(0, 160),
      isRegex,
    })
  }

  // getByPlaceholder
  const phRe =
    /getByPlaceholder\(\s*(?:\/((?:\\\/|[^/])+)\/[gimsuy]*|['"`]([^'"`]+)['"`])/g
  for (const m of stripped.matchAll(phRe)) {
    const isRegex = !!m[1]
    literals.push({
      literal: (m[1] || m[2] || '').trim(),
      kind: 'placeholder',
      snippet: m[0].slice(0, 160),
      isRegex,
    })
  }

  // toHaveText('string')  — only exact string forms; regex forms are bounded
  const haveTextRe = /toHaveText\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  for (const m of stripped.matchAll(haveTextRe)) {
    literals.push({
      literal: m[1].trim(),
      kind: 'to-have-text',
      snippet: m[0].slice(0, 160),
      isRegex: false,
    })
  }

  // toContainText('string')
  const containTextRe = /toContainText\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  for (const m of stripped.matchAll(containTextRe)) {
    literals.push({
      literal: m[1].trim(),
      kind: 'to-contain-text',
      snippet: m[0].slice(0, 160),
      isRegex: false,
    })
  }

  return literals.filter((l) => l.literal.length >= 2)
}

// ────────────────────────────────────────────────────────────────────────────
// Grounding check
// ────────────────────────────────────────────────────────────────────────────

function getRoleAwareElements(context: CapturedContext | undefined | null): RoleAwareElement[] {
  if (!context) return []
  const sc = context.sourceContext as unknown as { elements?: unknown } | undefined
  const elements = sc?.elements
  if (!Array.isArray(elements)) return []
  return elements.filter((e): e is RoleAwareElement => {
    if (!e || typeof e !== 'object') return false
    const re = e as Record<string, unknown>
    return typeof re.role === 'string' && typeof re.accessibleName === 'string'
  })
}

/** A captured selector/markup string references a `main` ARIA landmark. */
const MAIN_SELECTOR_RE =
  /(?:^|[\s,>(])main(?=[\s.#:[>)]|$)|\[role=["']?main["']?\]|getByRole\(\s*["']main["']/i
const MAIN_MARKUP_RE =
  /<main[\s/>]|role=["']main["']|component=\{?["']main["']/i

/**
 * Detects whether the explored app actually exposes a `main` ARIA landmark
 * (a `<main>` element or `[role="main"]`).
 *
 * Many SPA stacks — Create React App, plain MUI/`<div>` layouts — render NO
 * `main` landmark. On those apps a generated `page.locator('main')` matches
 * zero elements, so every scoped `toBeVisible()`/`click()` silently waits the
 * full test timeout and then fails. The generator's normalizer and this
 * validator use this signal to decide whether `main` scoping is safe or must
 * be rewritten / flagged.
 *
 * Returns `true` only on POSITIVE evidence; absence of evidence returns
 * `false` (treat as "no main landmark"), which is the safe default — we would
 * rather rewrite an unnecessary `main` than ship one that dead-hangs.
 */
export function contextHasMainLandmark(
  context?: CapturedContext | null,
  explorationArtifact?: {
    routes?: Array<{ elements?: Array<{ role?: unknown; selector?: unknown }> }>
  } | null,
): boolean {
  // 1. Role-aware elements captured by the source extractor.
  for (const el of getRoleAwareElements(context)) {
    if (String(el.role || '').toLowerCase() === 'main') return true
  }

  // 2. Exploration-artifact route elements (role or selector).
  for (const route of explorationArtifact?.routes || []) {
    for (const el of route?.elements || []) {
      if (String(el?.role || '').toLowerCase() === 'main') return true
      if (typeof el?.selector === 'string' && MAIN_SELECTOR_RE.test(el.selector)) return true
    }
  }

  // 3. Selector hints.
  for (const hint of context?.selectorHints || []) {
    if (typeof hint === 'string' && MAIN_SELECTOR_RE.test(hint)) return true
  }

  // 4. Captured source/markup.
  const blobs: string[] = []
  const fc = (context?.fileContents || {}) as Record<string, unknown>
  for (const v of Object.values(fc)) if (typeof v === 'string') blobs.push(v)
  for (const f of context?.sourceContext?.files || []) {
    const c = (f as { content?: unknown }).content
    if (typeof c === 'string') blobs.push(c)
  }
  for (const blob of blobs) {
    if (MAIN_MARKUP_RE.test(blob)) return true
  }

  return false
}

/**
 * Builds a map of accessible-name → set of observed ARIA roles, from the
 * role-aware element corpus (source extractor) plus the exploration artifact's
 * browser-observed route elements.
 *
 * Used to reconcile role mismatches in generated selectors. The classic case:
 * MUI `<Tab>` controls are observed as `role: tab`, but the exploration
 * artifact's flat `buttons` list *also* surfaces their labels, so the generator
 * emits `getByRole('button', { name: 'User Management' })` — which matches
 * nothing and hangs for the full timeout. With this map the normalizer can
 * rewrite such a query to `getByRole('tab', …)` when the name is observed as a
 * tab and never as a button.
 *
 * Names are normalized to trimmed lower-case for case-insensitive lookup.
 */
export function buildObservedRoleMap(
  context?: CapturedContext | null,
  explorationArtifact?: {
    routes?: Array<{ elements?: Array<{ role?: unknown; name?: unknown; accessibleName?: unknown }> }>
  } | null,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const add = (name: unknown, role: unknown) => {
    const n = typeof name === 'string' ? name.trim().toLowerCase() : ''
    const r = typeof role === 'string' ? role.trim().toLowerCase() : ''
    if (!n || !r) return
    let roles = map.get(n)
    if (!roles) {
      roles = new Set<string>()
      map.set(n, roles)
    }
    roles.add(r)
  }

  for (const el of getRoleAwareElements(context)) add(el.accessibleName, el.role)
  for (const route of explorationArtifact?.routes || []) {
    for (const el of route?.elements || []) {
      add((el as { name?: unknown }).name ?? (el as { accessibleName?: unknown }).accessibleName, (el as { role?: unknown }).role)
    }
  }
  return map
}

// Map JSX/Playwright role names to the canonical roles produced by the
// extractor. Playwright accepts a broader vocabulary (e.g. 'menuitem',
// 'option') but for our purposes we only need the common UI control roles.
const ROLE_ALIASES: Record<string, string[]> = {
  button:  ['button'],
  link:    ['link'],
  heading: ['heading'],
  textbox: ['textbox'],
  checkbox:['checkbox'],
  radio:   ['radio'],
  img:     ['image'],
  image:   ['image'],
  combobox:['combobox'],
  tab:     ['tab'],
  navigation: ['navigation'],
  main:    ['main'],
}

function roleAwareMatch(
  literal: string,
  isRegex: boolean,
  requestedRole: string | null,
  elements: RoleAwareElement[],
): boolean {
  if (elements.length === 0) return false
  const candidates = requestedRole
    ? elements.filter((el) => {
        const allowed = ROLE_ALIASES[requestedRole.toLowerCase()] || [requestedRole.toLowerCase()]
        return allowed.includes(el.role.toLowerCase())
      })
    : elements

  if (candidates.length === 0) return false

  // Dynamic-named elements (e.g. {product.name}) can match anything — they're
  // grounded by virtue of existing, even if the exact literal can't be proven.
  if (candidates.some((el) => el.isDynamic)) return true

  if (isRegex) {
    try {
      const re = new RegExp(literal.replace(/\\\//g, '/'), 'i')
      for (const el of candidates) {
        if (re.test(el.accessibleName)) return true
      }
    } catch {
      // malformed regex
    }
    // Alternation split
    for (const alt of literal.split('|')) {
      const altNorm = alt.replace(/[\\^$.*+?()[\]{}]/g, '').trim().toLowerCase()
      if (altNorm.length < 2) continue
      for (const el of candidates) {
        if (normalizeForMatch(el.accessibleName).includes(normalizeForMatch(altNorm))) return true
      }
    }
    return false
  }

  const needle = normalizeForMatch(literal)
  if (!needle) return true
  for (const el of candidates) {
    const name = normalizeForMatch(el.accessibleName)
    if (name.includes(needle) || needle.includes(name)) return true
  }
  return false
}

const KIND_TO_ROLE: Record<SelectorKind, string | null> = {
  'role-name':       null,        // role inferred from the actual getByRole(...) call site
  'text':            null,        // text could match any role-bearing element
  'label':           null,        // labels apply to form controls
  'placeholder':     'textbox',
  'test-id':         null,
  'to-have-text':    null,
  'to-contain-text': null,
  'structural-landmark': null,  // landmark scope, not a role-bearing literal
}

function literalIsGrounded(
  literal: string,
  isRegex: boolean,
  corpus: Set<string>,
  resolveRegex: boolean,
  roleHint?: string | null,
  elements?: RoleAwareElement[],
): boolean {
  // Try role-aware matching first when extractor data is present and we have
  // a role hint. This is the strongest signal.
  if (elements && elements.length > 0 && roleHint) {
    if (roleAwareMatch(literal, isRegex, roleHint, elements)) return true
  }
  const needle = literal.trim().toLowerCase()
  if (!needle) return true // empty literals not checkable; not our concern

  // Domain-agnostic safe text — always grounded.
  // These are generic UX labels that appear in nearly every web app.
  const ALWAYS_GROUNDED = new Set([
    'submit', 'cancel', 'close', 'save', 'delete', 'edit', 'next', 'previous',
    'back', 'continue', 'ok', 'yes', 'no', 'search', 'menu',
  ])
  if (ALWAYS_GROUNDED.has(needle)) return true

  if (isRegex && resolveRegex) {
    // Try the regex against every corpus entry.
    try {
      const safe = literal.replace(/\\\//g, '/')
      const re = new RegExp(safe, 'i')
      for (const entry of corpus) {
        if (re.test(entry)) return true
      }
    } catch {
      // malformed regex — treat as ungrounded
    }
    // Also try alternation splitting (e.g. /access denied|log in/i).
    for (const alt of literal.split('|')) {
      const altNorm = alt.replace(/[\\^$.*+?()[\]{}]/g, '').trim().toLowerCase()
      if (altNorm.length >= 2 && corpusContains(corpus, altNorm)) return true
    }
    return false
  }

  return corpusContains(corpus, needle)
}

function normalizeForMatch(s: string): string {
  // Collapse all whitespace, strip non-alphanumeric. Lets "log in" match
  // "Login", "sign-in" match "signin", etc.
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function corpusContains(corpus: Set<string>, needle: string): boolean {
  if (corpus.has(needle)) return true
  const normNeedle = normalizeForMatch(needle)
  if (normNeedle.length < 2) return false
  for (const entry of corpus) {
    if (entry.includes(needle) || needle.includes(entry)) return true
    const normEntry = normalizeForMatch(entry)
    if (normEntry.includes(normNeedle) || normNeedle.includes(normEntry)) return true
  }
  return false
}

// ────────────────────────────────────────────────────────────────────────────
// Suggested fix per selector kind
// ────────────────────────────────────────────────────────────────────────────

function suggestFix(kind: SelectorKind, literal: string): string {
  switch (kind) {
    case 'role-name':
      return `Drop the {name} filter — use structural locator like \`page.getByRole('heading').first()\` or \`page.locator('h1').first()\`. The literal "${literal}" is not in CONTEXT_JSON.`
    case 'text':
      // Do NOT recommend page.locator('main') — many apps (MUI, CRA, etc.) have
      // no <main> landmark, so that assertion fails on the very pages we are
      // trying to keep green. Anchor to a literal proven in assertableText, or
      // fall back to a heading / always-present <body>.
      return `Replace getByText("${literal}") with an assertion on a literal proven in sourceContext.assertableText, or a structural locator that is guaranteed to exist (e.g. \`page.getByRole('heading').first()\` or \`page.locator('body')\`). Never use \`page.locator('main')\` — it is not guaranteed to exist.`
    case 'label':
      return `getByLabel("${literal}") is unproven. Switch to \`page.locator('input[name="..."]')\` using a field name from forms[*].fields, or use a proven label.`
    case 'placeholder':
      return `Placeholder "${literal}" not in CONTEXT_JSON. Use \`page.locator('input[type="..."]')\` or a proven placeholder from forms[*].fields[*].placeholder.`
    case 'to-have-text':
      return `Replace toHaveText("${literal}") with \`not.toBeEmpty()\` or a regex-based bounded assertion — exact text is not proven.`
    case 'to-contain-text':
      return `Replace toContainText("${literal}") with \`not.toBeEmpty()\` — the text is not proven in CONTEXT_JSON.`
    case 'test-id':
      return `data-testid "${literal}" not in sourceContext.testIds. Use a proven testId or fall back to role-based locator.`
    case 'structural-landmark':
      return `No \`main\` landmark was observed for this app — \`page.locator('main')\` matches nothing and hangs. Scope to \`page.locator('body')\` or a container proven in CONTEXT_JSON instead.`
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

export function validateGrounding(
  content: string,
  context: CapturedContext | undefined | null,
  prefix: string,
  options: GroundingOptions = {},
): GroundingResult {
  const literals = extractSelectorLiterals(content)
  const corpus = buildGroundTruthCorpus(context)

  // If the corpus is too small, we can't validate — skip rather than reject.
  // This protects new projects where exploration captured little.
  if (corpus.size < 5) {
    return {
      valid: true,
      confidence: 1,
      totalLiterals: literals.length,
      groundedLiterals: literals.length,
      ungrounded: [],
    }
  }

  const resolveRegex = options.resolveRegex !== false
  const ungrounded: UngroundedLiteral[] = []
  let grounded = 0
  const roleAwareElements = getRoleAwareElements(context)

  for (const l of literals) {
    // Resolve role hint: explicit from getByRole(...), else infer from selector kind.
    const roleHint = l.roleHint ?? KIND_TO_ROLE[l.kind] ?? null
    if (literalIsGrounded(l.literal, l.isRegex, corpus, resolveRegex, roleHint, roleAwareElements)) {
      grounded += 1
    } else {
      ungrounded.push({
        literal: l.literal,
        kind: l.kind,
        snippet: l.snippet,
        suggestedFix: suggestFix(l.kind, l.literal),
      })
    }
  }

  // Structural-landmark grounding: `page.locator('main')` / `getByRole('main')`
  // / `[role="main"]` match zero elements (and dead-hang every scoped
  // assertion/click for the full timeout) on apps with no main landmark. The
  // text-literal corpus above can't catch these — they carry no asserted text
  // — so flag them explicitly when the captured context shows no `main`. This
  // keeps the grounding audit honest (it otherwise reported 100% grounded
  // while shipping selectors that always hang) and lets `enforce` mode reject.
  const hasMainLandmark = options.appHasMainLandmark ?? contextHasMainLandmark(context)
  if (!hasMainLandmark) {
    const mainScope =
      /\.locator\(\s*['"`]\s*main\b|\.locator\(\s*['"`]\[role=["']main["']\]|getByRole\(\s*['"`]main['"`]/g
    const seen = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = mainScope.exec(content)) !== null) {
      const snippet = content.slice(Math.max(0, m.index - 12), m.index + 48).replace(/\s+/g, ' ').trim()
      if (seen.has(snippet)) continue
      seen.add(snippet)
      ungrounded.push({
        literal: 'main',
        kind: 'structural-landmark',
        snippet,
        suggestedFix:
          "No `main` landmark was observed for this app — `page.locator('main')` matches nothing and hangs. Scope to `page.locator('body')` or a container proven in CONTEXT_JSON instead.",
      })
    }
  }

  const total = literals.length
  const confidence = total === 0 ? 1 : grounded / total
  const cfg = DEFAULTS_BY_PREFIX[prefix] || FALLBACK_DEFAULTS
  const minConfidence = options.minConfidence ?? cfg.minConfidence
  const maxUngrounded = options.maxUngrounded ?? cfg.maxUngrounded

  const valid = confidence >= minConfidence && ungrounded.length <= maxUngrounded

  return {
    valid,
    confidence,
    totalLiterals: total,
    groundedLiterals: grounded,
    ungrounded,
  }
}

/**
 * Render a `GroundingResult` into the same error-string format that
 * `validateGeneratedContent` returns, so the rejection path can treat
 * grounding failures uniformly with other quality errors.
 */
export function renderGroundingErrors(result: GroundingResult): string[] {
  if (result.valid) return []
  const header = `Grounding confidence ${(result.confidence * 100).toFixed(0)}% (${result.groundedLiterals}/${result.totalLiterals} literals proven) — ${result.ungrounded.length} ungrounded`
  const items = result.ungrounded.slice(0, 8).map((u) =>
    `  • [${u.kind}] "${u.literal}" — ${u.suggestedFix}`,
  )
  return [header, ...items]
}

/**
 * Build a correction-prompt fragment that the model can use to fix the
 * specific ungrounded literals on retry. Returned text is appended to the
 * existing buildCorrectionPrompt() output.
 *
 * When a corpus is provided, the top proven strings are inlined so the model
 * can pick replacements without having to guess what is valid.
 */
export function buildGroundingCorrection(result: GroundingResult, corpus?: Set<string>): string {
  if (result.valid || result.ungrounded.length === 0) return ''
  const lines = [
    '',
    'GROUNDING FAILURES — fix these specific literals on retry:',
    ...result.ungrounded.slice(0, 6).map(
      (u) => `  - ${u.kind} "${u.literal}" is NOT in CONTEXT_JSON. ${u.suggestedFix}`,
    ),
    '',
    'Use only literals that appear verbatim in CONTEXT_JSON.context.sourceContext.assertableText or routeAccess.observedRoutes. When in doubt, drop the {name} filter and assert structurally.',
  ]

  if (corpus && corpus.size > 0) {
    // Include a sample of provable strings so the model has concrete replacements.
    // Prefer text-like entries (not route paths) that are short enough to be useful.
    const proven = [...corpus]
      .filter((s) => !s.startsWith('/') && s.length >= 3 && s.length <= 80)
      .slice(0, 25)
    if (proven.length > 0) {
      lines.push(
        '',
        'PROVEN STRINGS you may use verbatim as selector names or text assertions:',
        ...proven.map((s) => `  - "${s}"`),
        'If the element you need is not in this list, use a structural locator (getByRole without name, not.toBeEmpty(), etc.).',
      )
    }
  }

  return lines.join('\n')
}
