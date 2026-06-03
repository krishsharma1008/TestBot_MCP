/**
 * Spec coverage validator — Phase 2 post-generation check.
 *
 * Extracts // @spec <id> annotations from generated test files and diffs them
 * against the TestCaseSpec[] that was passed to the code generator. No LLM
 * calls — pure regex + set arithmetic.
 */

import type { TestCaseSpec, GeneratedTestFile, SpecValidationResult } from './types'

// Matches:  // @spec F1-UI-01  (leading whitespace allowed, trailing text ignored)
const SPEC_ANNOTATION_RE = /\/\/\s*@spec\s+([\w-]+)/g

/**
 * Scan generated files for // @spec annotations and compare against the
 * planned specs. Returns covered/uncovered/unplanned ID lists plus a
 * boolean `valid` that is true only when every planned spec is covered.
 */
export function validateSpecCoverage(
  specs: TestCaseSpec[],
  files: GeneratedTestFile[],
  featureId: string,
  agentType: 'ui' | 'api'
): SpecValidationResult {
  const plannedIds = new Set(specs.map((s) => s.id))
  const foundIds = new Set<string>()

  for (const file of files) {
    for (const match of file.content.matchAll(SPEC_ANNOTATION_RE)) {
      foundIds.add(match[1])
    }
  }

  const covered = [...plannedIds].filter((id) => foundIds.has(id))
  const uncovered = [...plannedIds].filter((id) => !foundIds.has(id))
  const unplanned = [...foundIds].filter((id) => !plannedIds.has(id))

  return {
    featureId,
    agentType,
    specCount: specs.length,
    covered,
    uncovered,
    unplanned,
    valid: uncovered.length === 0,
  }
}
