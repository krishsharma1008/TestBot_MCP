export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'

// API test generation requires strict contract reasoning — hallucinations on
// response body fields are the primary source of invalid tests. Use a stronger
// model for these agents; override with OPENAI_API_AGENT_MODEL env var.
export const DEFAULT_API_AGENT_MODEL = 'gpt-5'

const PROVIDER_MODEL_ALIASES: Record<string, string> = {
  // Product-facing Healix default. OpenAI's public API currently exposes this
  // capability under gpt-5-mini, so translate only at the provider boundary.
  'gpt-5.5-mini': 'gpt-5.4-mini',
}

export function resolveConfiguredOpenAIModel(override?: string | null): string {
  const explicit = String(override || '').trim()
  if (explicit) return explicit
  const envModel = process.env.OPENAI_MODEL?.trim()
  return envModel || DEFAULT_OPENAI_MODEL
}

export function resolveApiAgentModel(override?: string | null): string {
  const explicit = String(override || '').trim()
  if (explicit) return explicit
  const envModel = process.env.OPENAI_API_AGENT_MODEL?.trim()
  return envModel || DEFAULT_API_AGENT_MODEL
}

export function resolveProviderOpenAIModel(model?: string | null): string {
  const configured = resolveConfiguredOpenAIModel(model)
  return PROVIDER_MODEL_ALIASES[configured] || configured
}
