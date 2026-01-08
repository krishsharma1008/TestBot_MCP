const fetch = require('node-fetch');

/**
 * Sarvam AI Client for automated test failure analysis
 * Uses Sarvam-M 24B multilingual model
 * Fully automated - no manual intervention required
 */
class SarvamClient {
  constructor(config = {}) {
    // Try multiple sources for API key
    const apiKey = config.apiKey || process.env.SARVAM_API_KEY || process.env.AI_API_KEY;
    
    this.config = {
      ...config,
      apiKey: apiKey,
      model: config.model || process.env.AI_MODEL || 'sarvam-m',
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.2,
      timeout: config.timeout || 120000
    };
    
    if (!this.config.apiKey) {
      throw new Error('Sarvam API key is required. Set SARVAM_API_KEY in .env or pass apiKey in config');
    }
    
    this.baseUrl = 'https://api.sarvam.ai/v1';
  }

  /**
   * Analyze test failures using Sarvam AI
   * @param {Array} failures - Array of test failures with artifacts
   * @returns {Promise<Array>} - Analysis results
   */
  async analyzeFailures(failures) {
    console.log(`\n🤖 Sarvam AI Auto-Analysis Starting...`);
    console.log(`   Model: ${this.config.model}`);
    console.log(`   Failures to analyze: ${failures.length}`);
    
    const results = [];
    
    // Analyze each failure
    for (let i = 0; i < failures.length; i++) {
      const failure = failures[i];
      console.log(`\n  [${i + 1}/${failures.length}] Analyzing: ${failure.testName}`);
      
      try {
        const analysis = await this.analyzeFailure(failure);
        results.push(analysis);
        console.log(`     ✅ Complete (confidence: ${analysis.confidence})`);
      } catch (error) {
        console.error(`     ❌ Failed: ${error.message}`);
        results.push({
          failure,
          analysis: `Analysis failed: ${error.message}`,
          suggestedFix: null,
          confidence: 0,
          error: error.message
        });
      }
    }
    
    console.log(`\n✅ Sarvam AI analysis complete: ${results.length} failures analyzed`);
    return results;
  }

  /**
   * Analyze a single test failure
   */
  async analyzeFailure(failure) {
    const messages = this.buildAnalysisMessages(failure);
    const response = await this.callSarvamAPI(messages);
    const parsed = this.parseResponse(response);
    
    return {
      failure,
      analysis: parsed.analysis,
      suggestedFix: parsed.fix,
      confidence: parsed.confidence,
      affectedFiles: parsed.affectedFiles || [failure.file]
    };
  }

  /**
   * Build chat messages for analysis
   */
  buildAnalysisMessages(failure) {
    const systemPrompt = `You are an expert software testing and debugging assistant. Analyze test failures and provide precise fixes in JSON format.

Your response MUST be a valid JSON object with this exact structure:
{
  "analysis": "Detailed explanation of what caused the failure",
  "rootCause": "Root cause of the issue",
  "fix": {
    "description": "Clear description of the fix",
    "changes": [
      {
        "file": "path/to/file.js",
        "action": "replace",
        "lineStart": 10,
        "lineEnd": 15,
        "oldCode": "current code to replace",
        "newCode": "fixed code"
      }
    ]
  },
  "confidence": 0.95,
  "affectedFiles": ["path/to/file.js"],
  "testingRecommendations": "How to verify the fix works"
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting, no explanations outside the JSON.`;

    const userPrompt = this.buildFailureContext(failure);

    return [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userPrompt
      }
    ];
  }

  /**
   * Build detailed failure context
   */
  buildFailureContext(failure) {
    let context = `# Test Failure Analysis Request\n\n`;
    
    // Test information
    context += `## Test Details\n`;
    context += `- **Test Name**: ${failure.testName}\n`;
    context += `- **File**: ${failure.file}\n`;
    context += `- **Line**: ${failure.line || 'unknown'}\n`;
    context += `- **Status**: ${failure.status}\n`;
    context += `- **Duration**: ${failure.duration}ms\n\n`;
    
    // Error information
    context += `## Error Message\n\`\`\`\n${failure.error?.message || 'No error message'}\n\`\`\`\n\n`;
    
    if (failure.error?.stack) {
      context += `## Stack Trace\n\`\`\`\n${failure.error.stack}\n\`\`\`\n\n`;
    }
    
    // Code context
    if (failure.artifacts?.errorContext) {
      context += `## Code Context\n\`\`\`javascript\n${failure.artifacts.errorContext}\n\`\`\`\n\n`;
    }
    
    // Screenshots
    if (failure.artifacts?.screenshots?.length > 0) {
      context += `## Visual Evidence\n`;
      context += `${failure.artifacts.screenshots.length} screenshot(s) available showing the failure state.\n`;
      failure.artifacts.screenshots.forEach((screenshot, idx) => {
        context += `- Screenshot ${idx + 1}: ${screenshot.name}\n`;
      });
      context += `\n`;
    }
    
    // Additional artifacts
    if (failure.artifacts?.videos?.length > 0) {
      context += `## Video Recording\n`;
      context += `${failure.artifacts.videos.length} video(s) available.\n\n`;
    }
    
    if (failure.artifacts?.traces?.length > 0) {
      context += `## Playwright Trace\n`;
      context += `${failure.artifacts.traces.length} trace file(s) available for detailed debugging.\n\n`;
    }
    
    context += `## Task\n`;
    context += `Analyze this test failure and provide a fix. Focus on:\n`;
    context += `1. Identifying the root cause\n`;
    context += `2. Providing exact code changes needed\n`;
    context += `3. Ensuring the fix is minimal and targeted\n`;
    context += `4. Assigning a confidence score (0.0 to 1.0)\n\n`;
    context += `Return your analysis as a JSON object following the specified format.`;
    
    return context;
  }

  /**
   * Call Sarvam AI API
   */
  async callSarvamAPI(messages) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': this.config.apiKey
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          n: 1
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || response.statusText;
        } catch {
          errorMessage = errorText || response.statusText;
        }
        throw new Error(`Sarvam API error (${response.status}): ${errorMessage}`);
      }
      
      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from Sarvam API');
      }
      
      return data.choices[0].message.content;
      
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Sarvam API request timeout');
      }
      throw error;
    }
  }

  /**
   * Parse Sarvam AI response
   */
  parseResponse(response) {
    try {
      // Try to parse as JSON directly
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch {
        // If not valid JSON, try to extract JSON from markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          // Try to find any JSON object in the response
          const objectMatch = response.match(/{[\s\S]*}/);
          if (objectMatch) {
            parsed = JSON.parse(objectMatch[0]);
          } else {
            throw new Error('No valid JSON found in response');
          }
        }
      }
      
      return {
        analysis: parsed.analysis || 'No analysis provided',
        rootCause: parsed.rootCause || 'Unknown',
        fix: parsed.fix || { description: 'No fix provided', changes: [] },
        confidence: parsed.confidence || 0.5,
        affectedFiles: parsed.affectedFiles || [],
        testingRecommendations: parsed.testingRecommendations || ''
      };
    } catch (error) {
      throw new Error(`Failed to parse Sarvam AI response: ${error.message}`);
    }
  }
}

module.exports = SarvamClient;
