const SOURCE_LABELS: Record<string, string> = {
  'browser-use+playwright-enrichment': 'Browser-use + Playwright',
  'browser-use-empty+playwright-heuristic+enrichment': 'Playwright heuristic',
  'playwright-heuristic+enrichment': 'Playwright heuristic',
  'playwright-heuristic': 'Playwright heuristic',
  'phase_a_enrichment+static-context': 'Static analysis',
  'failed+static-context': 'Fallback (static)',
  'skipped': 'Skipped',
  'unavailable': 'Unavailable',
  'unknown': 'Unknown',
}

export function explorationSourceLabel(raw: string | null | undefined): string {
  if (!raw) return 'Unknown'
  return SOURCE_LABELS[raw] ?? raw
}
