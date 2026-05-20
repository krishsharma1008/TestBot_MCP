/**
 * Rule matching for the dispatch router.
 *
 * Multiple `match` keys mean ALL must match (AND). A single key with an
 * array of values is satisfied when the finding's value is one of them.
 * A finding can match multiple rules and dispatch to multiple adapters.
 */

import type { DispatchRoute, Finding, RouteMatch } from './types'

export function matchesRule(finding: Finding, match: RouteMatch): boolean {
  if (match.severity && match.severity.length > 0) {
    if (!match.severity.includes(finding.severity)) return false
  }
  if (match.category && match.category.length > 0) {
    if (!match.category.includes(finding.category)) return false
  }
  return true
}

export function findMatchingRoutes(
  finding: Finding,
  routes: DispatchRoute[]
): DispatchRoute[] {
  return routes.filter((route) => matchesRule(finding, route.match))
}
