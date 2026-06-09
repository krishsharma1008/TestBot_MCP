import { describe, it, expect } from 'vitest'
import { OpenAITestGenerator } from './openai-generator'
import { contextHasMainLandmark, validateGrounding, buildObservedRoleMap } from './grounding-validator'
import type { CapturedContext } from './types'

// Regression coverage for the "improper main-scoped selectors" timeout.
//
// Root cause: the generator was prompted to scope locators to `main`, but apps
// like Create React App / plain MUI render NO <main> landmark. `page.locator('main')`
// then matches zero elements and every scoped toBeVisible()/click() dead-hangs for
// the full test timeout, blowing the execution budget. These tests lock in:
//   Fix 1 — normalizeGeneratedContent() rewrites main → body when no main landmark.
//   Fix 3 — validateGrounding() flags ungrounded `main` so the audit is honest.

/** Set the private per-run flag the normalizer reads. */
function normalizerFor(hasMain: boolean) {
  const gen = new OpenAITestGenerator()
  ;(gen as unknown as { appHasMainLandmark: boolean }).appHasMainLandmark = hasMain
  return (content: string) => gen.normalizeGeneratedContent(content)
}

/** Set the private observed-role map the normalizer reads for tab reconciliation. */
function normalizerWithRoles(roleMap: Map<string, Set<string>>) {
  const gen = new OpenAITestGenerator()
  // Keep main rewriting out of the way for these focused cases.
  ;(gen as unknown as { appHasMainLandmark: boolean }).appHasMainLandmark = true
  ;(gen as unknown as { observedRoleMap: Map<string, Set<string>> }).observedRoleMap = roleMap
  return (content: string) => gen.normalizeGeneratedContent(content)
}

/** A context whose ground-truth corpus is large enough (>= 5) to be validated. */
function contextWithHints(hints: string[]): CapturedContext {
  return { selectorHints: hints }
}

describe('contextHasMainLandmark', () => {
  it('returns false when no source signal references a main landmark', () => {
    expect(contextHasMainLandmark({ selectorHints: ['button:has-text("Edit")'] })).toBe(false)
    expect(contextHasMainLandmark(null)).toBe(false)
    expect(contextHasMainLandmark(undefined)).toBe(false)
  })

  it('detects a main landmark from an exploration-artifact element role', () => {
    const artifact = { routes: [{ elements: [{ role: 'main', selector: 'main' }] }] }
    expect(contextHasMainLandmark({}, artifact)).toBe(true)
  })

  it('detects a main landmark from a [role="main"] selector hint', () => {
    expect(contextHasMainLandmark({ selectorHints: ['[role="main"]'] })).toBe(true)
  })

  it('detects a main landmark from captured <main> markup', () => {
    const ctx = { fileContents: { 'App.jsx': '<main className="content">x</main>' } } as unknown as CapturedContext
    expect(contextHasMainLandmark(ctx)).toBe(true)
  })

  it('does not false-positive on identifiers that merely contain "main"', () => {
    const ctx = {
      selectorHints: ['.main-content', '#domain', 'maintenance-banner'],
      fileContents: { 'a.tsx': 'const domain = "x"; // maintenance' },
    } as unknown as CapturedContext
    expect(contextHasMainLandmark(ctx)).toBe(false)
  })
})

describe('normalizeGeneratedContent — main→body rewrite (Fix 1)', () => {
  it('rewrites page.locator(\'main\') to body when the app has no main landmark', () => {
    const out = normalizerFor(false)(
      "await expect(page.locator('main').first()).toBeVisible();",
    )
    expect(out).toContain("page.locator('body')")
    expect(out).not.toMatch(/locator\(\s*['"`]main['"`]\s*\)/)
  })

  it('rewrites a main descendant scope, preserving the rest of the selector', () => {
    const out = normalizerFor(false)("page.locator('main a[href*=\"/x\"]').click();")
    expect(out).toContain("page.locator('body a[href*=\"/x\"]')")
  })

  it("rewrites scoped main.getByRole(...) so the inner query runs against body", () => {
    const out = normalizerFor(false)(
      "await page.locator('main').getByRole('button', { name: 'Edit' }).click();",
    )
    expect(out).toContain("page.locator('body').getByRole('button', { name: 'Edit' })")
  })

  it('rewrites [role="main"] and getByRole(\'main\') variants', () => {
    expect(normalizerFor(false)("page.locator('[role=\"main\"]').first()")).toContain(
      "page.locator('body')",
    )
    expect(normalizerFor(false)("page.getByRole('main').first()")).toContain(
      "page.locator('body')",
    )
  })

  it('does NOT touch identifiers like main-content / maintenance', () => {
    const out = normalizerFor(false)("page.locator('.main-content'); page.locator('main-nav');")
    expect(out).toContain(".main-content")
    expect(out).toContain("main-nav")
  })

  it('preserves main scoping when the app genuinely exposes a main landmark', () => {
    const out = normalizerFor(true)(
      "await expect(page.locator('main').first()).toBeVisible();",
    )
    expect(out).toContain("page.locator('main')")
    expect(out).not.toContain("page.locator('body')")
  })
})

describe('validateGrounding — structural-landmark flag (Fix 3)', () => {
  // 6 non-main hints keep the corpus above the size-5 validation floor.
  const noMainCtx = contextWithHints(['a1', 'b2', 'c3', 'd4', 'e5', 'f6'])

  it('flags page.locator(\'main\') as ungrounded when no main landmark exists', () => {
    const result = validateGrounding(
      "await expect(page.locator('main').first()).toBeVisible();",
      noMainCtx,
      'frontend',
    )
    const landmark = result.ungrounded.find((u) => u.kind === 'structural-landmark')
    expect(landmark).toBeDefined()
    expect(landmark?.literal).toBe('main')
  })

  it('does NOT flag main when the context shows a main landmark', () => {
    const withMainCtx = contextWithHints(['[role="main"]', 'b2', 'c3', 'd4', 'e5', 'f6'])
    const result = validateGrounding(
      "await expect(page.locator('main').first()).toBeVisible();",
      withMainCtx,
      'frontend',
    )
    expect(result.ungrounded.some((u) => u.kind === 'structural-landmark')).toBe(false)
  })

  it('honors the caller-supplied appHasMainLandmark option (consistency with the normalizer)', () => {
    const content = "await expect(page.locator('main').first()).toBeVisible();"
    // Option true wins even when context alone shows no main → no flag (matches
    // the normalizer keeping `main` because the artifact proved it).
    const kept = validateGrounding(content, noMainCtx, 'frontend', { appHasMainLandmark: true })
    expect(kept.ungrounded.some((u) => u.kind === 'structural-landmark')).toBe(false)
    // Option false forces the flag.
    const flagged = validateGrounding(content, noMainCtx, 'frontend', { appHasMainLandmark: false })
    expect(flagged.ungrounded.some((u) => u.kind === 'structural-landmark')).toBe(true)
  })
})

describe('buildObservedRoleMap', () => {
  it('merges roles from context role-aware elements and artifact route elements', () => {
    const ctx = {
      sourceContext: { elements: [{ role: 'button', accessibleName: 'Create New User' }] },
    } as unknown as CapturedContext
    const artifact = {
      routes: [
        {
          elements: [
            { role: 'tab', name: 'User Management', selector: '#mui-1' },
            { role: 'tab', name: 'Role Management', selector: '#mui-2' },
            { role: 'button', name: 'Edit' },
          ],
        },
      ],
    }
    const map = buildObservedRoleMap(ctx, artifact)
    expect(map.get('user management')).toEqual(new Set(['tab']))
    expect(map.get('role management')).toEqual(new Set(['tab']))
    expect(map.get('edit')).toEqual(new Set(['button']))
    expect(map.get('create new user')).toEqual(new Set(['button']))
  })
})

describe('normalizeGeneratedContent — tab-as-button reconciliation', () => {
  const roleMap = new Map<string, Set<string>>([
    ['user management', new Set(['tab'])],
    ['role management', new Set(['tab'])],
    ['create new user', new Set(['button'])],
    ['settings', new Set(['tab', 'button'])], // ambiguous: observed as both
  ])

  it("rewrites getByRole('button', { name }) to 'tab' when the name is observed only as a tab", () => {
    const out = normalizerWithRoles(roleMap)(
      "await expect(page.getByRole('button', { name: 'User Management', exact: true })).toBeVisible();",
    )
    expect(out).toContain("getByRole('tab', { name: 'User Management', exact: true })")
    expect(out).not.toContain("getByRole('button', { name: 'User Management'")
  })

  it('does NOT rewrite a name that is genuinely a button', () => {
    const out = normalizerWithRoles(roleMap)(
      "await page.getByRole('button', { name: 'Create New User', exact: true }).click();",
    )
    expect(out).toContain("getByRole('button', { name: 'Create New User', exact: true })")
  })

  it('does NOT rewrite an ambiguous name observed as both tab and button', () => {
    const out = normalizerWithRoles(roleMap)(
      "await page.getByRole('button', { name: 'Settings' }).click();",
    )
    expect(out).toContain("getByRole('button', { name: 'Settings' })")
  })

  it('does NOT rewrite a name we never observed', () => {
    const out = normalizerWithRoles(roleMap)(
      "await page.getByRole('button', { name: 'Totally Unknown' }).click();",
    )
    expect(out).toContain("getByRole('button', { name: 'Totally Unknown' })")
  })

  it('leaves existing getByRole(\'tab\', …) untouched', () => {
    const out = normalizerWithRoles(roleMap)(
      "await page.getByRole('tab', { name: 'User Management', exact: true }).click();",
    )
    expect(out).toContain("getByRole('tab', { name: 'User Management', exact: true })")
  })
})
