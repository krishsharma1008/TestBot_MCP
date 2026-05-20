/**
 * Slack adapter — posts a Block Kit message to an incoming webhook.
 * Uses SLACK_WEBHOOK_URL from the environment unless the route config
 * overrides it. Incoming webhooks accept a JSON body; we don't get a
 * usable identifier back, so externalRef is null.
 */

import type {
  Adapter,
  AdapterResult,
  Finding,
  SlackRouteConfig,
} from '../types'

const SEVERITY_EMOJI: Record<string, string> = {
  P0: ':rotating_light:',
  P1: ':warning:',
  P2: ':large_yellow_square:',
  P3: ':information_source:',
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function buildBlocks(finding: Finding) {
  const severity = finding.severity || 'P3'
  const emoji = SEVERITY_EMOJI[severity] || ':grey_question:'
  const category = finding.category || 'unknown'
  const testFile = finding.testFile || '(unknown file)'
  const command = finding.reproducer?.command || ''
  const errorRaw = String(finding.evidence?.error ?? '').trim()
  const errorExcerpt = errorRaw ? truncate(errorRaw, 800) : '(no error captured)'

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${severity} ${category}: ${truncate(finding.title || 'Untitled finding', 140)}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Severity*\n${severity}` },
        { type: 'mrkdwn', text: `*Category*\n${category}` },
        { type: 'mrkdwn', text: `*Test file*\n\`${testFile}\`` },
        ...(command ? [{ type: 'mrkdwn' as const, text: `*Reproducer*\n\`${command}\`` }] : []),
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Error*\n\`\`\`${errorExcerpt}\`\`\`` },
    },
  ]
}

export const slack: Adapter = {
  async send(finding: Finding, ruleConfig: SlackRouteConfig): Promise<AdapterResult> {
    const webhookUrl = ruleConfig.webhookUrl || process.env.SLACK_WEBHOOK_URL || ''
    if (!webhookUrl) {
      throw new Error('Slack adapter: SLACK_WEBHOOK_URL is not configured')
    }
    const payload: Record<string, unknown> = {
      text: `${finding.severity || 'P3'} ${finding.category || 'unknown'}: ${finding.title || 'Untitled finding'}`,
      blocks: buildBlocks(finding),
    }
    if (ruleConfig.channel) payload.channel = ruleConfig.channel

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Slack webhook failed: ${response.status} ${body}`)
    }
    return { externalRef: null }
  },
}
