/**
 * Shared types for the outbound dispatch router (Slack / GitHub / Jira).
 *
 * `Finding` mirrors a row of `qaFindings` produced by `buildQaFindings` in
 * testbot-mcp/src/report-generator.js. We only depend on the fields the
 * adapters actually format — every other field on the finding is allowed
 * but ignored.
 */

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'

export type CanonicalCategory =
  | 'a11y'
  | 'authz'
  | 'validation'
  | 'filter_logic'
  | 'http_contract'
  | 'functional'
  | string

export interface FindingReproducer {
  command?: string
  note?: string
}

export interface FindingEvidence {
  error?: string | null
  suite?: string | null
  qacMarkers?: string[]
  attachments?: unknown
  [key: string]: unknown
}

export interface Finding {
  signature: string
  projectFingerprint: string
  severity: Severity
  category: CanonicalCategory
  findingType?: string
  title: string
  status?: string
  testFile?: string
  testTitle?: string
  ownerHint?: string
  reproducer?: FindingReproducer
  evidence?: FindingEvidence
  [key: string]: unknown
}

export interface RouteMatch {
  severity?: Severity[]
  category?: CanonicalCategory[]
}

export type AdapterName = 'slack' | 'github' | 'jira'

export interface SlackRouteConfig {
  channel?: string
  webhookUrl?: string
}

export interface GitHubRouteConfig {
  repo: string
  labels?: string[]
}

export interface JiraRouteConfig {
  project: string
  issueType?: string
}

export type AdapterRouteConfig = SlackRouteConfig | GitHubRouteConfig | JiraRouteConfig

export interface DispatchRoute {
  match: RouteMatch
  target: AdapterName
  config: AdapterRouteConfig
}

export interface DispatchConfig {
  version: number
  routes: DispatchRoute[]
}

export interface AdapterResult {
  externalRef: string | null
}

export interface Adapter {
  send(finding: Finding, ruleConfig: AdapterRouteConfig): Promise<AdapterResult>
}
