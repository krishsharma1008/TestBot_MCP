/**
 * Live Ingest Client
 * Streams findings to the dashboard in real-time during pipeline execution
 */

const axios = require('axios');

const AGENT_TO_TIER = {
  smoke: 'tier-0',
  frontend: 'tier-1',
  api: 'tier-2',
  workflow: 'tier-3',
  error: 'tier-3',
};

class LiveIngestClient {
  constructor({ dashboardUrl, apiKey } = {}) {
    this.dashboardUrl = dashboardUrl || process.env.HEALIX_DASHBOARD_URL || 'http://localhost:3000';
    this.apiKey = apiKey || process.env.HEALIX_API_KEY;
  }

  /**
   * Patch findings to the backend in real-time
   * Uses idempotent upsert based on findingKey
   * Never throws - failures are logged but don't stop worker execution
   */
  async patchFindings(testRunId, apiKey, findings) {
    if (!testRunId || !findings || !Array.isArray(findings) || findings.length === 0) {
      console.log('[LiveIngest] Skipping patch - no findings or invalid input');
      return;
    }

    const key = apiKey || this.apiKey;
    if (!key) {
      console.error('[LiveIngest] No API key available for live ingest');
      return;
    }

    const url = `${this.dashboardUrl}/api/test-runs/${testRunId}/findings`;

    // Log findings being sent for debugging
    console.log('[LiveIngest] Streaming findings:', {
      testRunId,
      count: findings.length,
      tiers: findings.map(f => f.tier),
      sample: findings.slice(0, 2).map(f => ({ id: f.id, tier: f.tier, verdict: f.verdict })),
    });

    try {
      await axios.patch(url, findings, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        timeout: 10000, // 10 second timeout to avoid blocking worker
      });
      console.log(`[LiveIngest] Successfully streamed ${findings.length} findings for run ${testRunId}`);
    } catch (error) {
      // Never throw - log and continue
      console.error('[LiveIngest] Failed to stream findings', {
        testRunId,
        error: error.message,
        statusCode: error.response?.status,
      });
    }
  }

  /**
   * Get tier for an agent
   */
  getTierForAgent(agent) {
    return AGENT_TO_TIER[agent] || 'tier-3';
  }

  /**
   * Inject tier field into findings based on agent
   */
  injectTierIntoFindings(findings, agent) {
    if (!findings || !Array.isArray(findings)) {
      return [];
    }
    const tier = this.getTierForAgent(agent);
    return findings.map(finding => ({
      ...finding,
      tier,
    }));
  }
}

module.exports = LiveIngestClient;
module.exports.AGENT_TO_TIER = AGENT_TO_TIER;
