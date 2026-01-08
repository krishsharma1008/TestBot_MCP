const fs = require('fs');
const path = require('path');
const TestArtifactProcessor = require('./test-artifact-processor');
const WindsurfAPIClient = require('./windsurf-api-client');
const CascadeAutoClient = require('./cascade-auto-client');
const SarvamClient = require('./sarvam-client');

class ErrorAnalyzer {
  constructor(config = {}) {
    this.config = {
      aiProvider: config.aiProvider || 'openai',
      apiKey: config.apiKey || process.env.AI_API_KEY,
      model: config.model || 'gpt-4',
      maxRetries: config.maxRetries || 3,
      autoAnalyze: config.autoAnalyze !== false, // Enable auto-analysis by default
      ...config
    };
    
    this.artifactProcessor = new TestArtifactProcessor(config);
    this.windsurfClient = new WindsurfAPIClient(config);
    this.cascadeClient = new CascadeAutoClient(config);
    this._sarvamClient = null; // Lazy initialization
  }
  
  get sarvamClient() {
    if (!this._sarvamClient) {
      this._sarvamClient = new SarvamClient(this.config);
    }
    return this._sarvamClient;
  }

  async analyzeTestFailures(testResults) {
    console.log(`\n📦 Processing test results with artifacts...`);
    const processedData = await this.artifactProcessor.processTestResults();
    
    const failures = processedData.failures;
    
    if (failures.length === 0) {
      return { hasErrors: false, fixes: [] };
    }

    console.log(`\n🔍 Analyzing ${failures.length} test failure(s) with full context...`);
    
    // Use Sarvam AI for automated analysis
    if (this.config.aiProvider === 'sarvam' && this.config.autoAnalyze) {
      console.log(`\n🤖 Using Sarvam AI Analysis...`);
      const analysisResults = await this.sarvamClient.analyzeFailures(failures);
      
      return {
        hasErrors: true,
        failures,
        analysisResults,
        timestamp: new Date().toISOString()
      };
    }
    
    // Use automated Cascade analysis for Windsurf mode
    if (this.config.aiProvider === 'windsurf' && this.config.autoAnalyze) {
      console.log(`\n🌊 Using Automated Cascade Analysis (Codex 5.1)...`);
      const analysisResults = await this.cascadeClient.analyzeFailures(failures);
      
      return {
        hasErrors: true,
        failures,
        analysisResults,
        timestamp: new Date().toISOString()
      };
    }
    
    // Fallback to manual analysis for other providers
    const analysisResults = [];
    for (const failure of failures) {
      const analysis = await this.analyzeFailureWithArtifacts(failure);
      analysisResults.push(analysis);
    }

    return {
      hasErrors: true,
      failures,
      analysisResults,
      timestamp: new Date().toISOString()
    };
  }

  extractFailures(testResults) {
    const failures = [];
    
    if (!testResults || !testResults.suites) {
      return failures;
    }

    const processSpecs = (specs) => {
      for (const spec of specs) {
        if (spec.tests) {
          for (const test of spec.tests) {
            if (test.status === 'failed' || test.status === 'timedOut') {
              failures.push({
                testName: test.title,
                file: spec.file,
                error: test.errors?.[0] || {},
                line: test.errors?.[0]?.location?.line,
                column: test.errors?.[0]?.location?.column,
                status: test.status,
                duration: test.duration,
                projectName: test.projectName
              });
            }
          }
        }
        if (spec.suites) {
          processSpecs(spec.suites);
        }
      }
    };

    processSpecs(testResults.suites);
    return failures;
  }

  async analyzeFailureWithArtifacts(failure) {
    console.log(`\n  📊 Analyzing: ${failure.testName}`);
    console.log(`     Artifacts: ${failure.artifacts.screenshots.length} screenshots, ${failure.artifacts.videos.length} videos, ${failure.artifacts.traces.length} traces`);
    
    const payload = this.artifactProcessor.generateWindsurfPayload(failure);
    
    try {
      let aiResponse;
      
      if (this.config.aiProvider === 'windsurf') {
        console.log(`     🌊 Using Windsurf IDE mode`);
        aiResponse = await this.windsurfClient.analyzeFailure(payload);
      } else if (this.config.apiKey) {
        const prompt = this.buildAnalysisPromptWithArtifacts(payload);
        aiResponse = await this.callAI(prompt);
      } else {
        throw new Error(`No API key configured for ${this.config.aiProvider}. Please set AI_API_KEY in .env or use --provider windsurf`);
      }
      
      return {
        failure,
        analysis: aiResponse.analysis,
        suggestedFix: aiResponse.fix,
        confidence: aiResponse.confidence,
        affectedFiles: aiResponse.affectedFiles || [failure.file]
      };
    } catch (error) {
      console.error(`❌ Failed to analyze error: ${error.message}`);
      return {
        failure,
        analysis: 'AI analysis failed',
        suggestedFix: null,
        confidence: 0,
        error: error.message
      };
    }
  }

  async analyzeFailure(failure) {
    const fileContent = this.readFileContent(failure.file);
    const errorContext = this.buildErrorContext(failure, fileContent);
    
    const prompt = this.buildAnalysisPrompt(errorContext);
    
    try {
      const aiResponse = await this.callAI(prompt);
      return {
        failure,
        analysis: aiResponse.analysis,
        suggestedFix: aiResponse.fix,
        confidence: aiResponse.confidence,
        affectedFiles: aiResponse.affectedFiles || [failure.file]
      };
    } catch (error) {
      console.error(`❌ Failed to analyze error: ${error.message}`);
      return {
        failure,
        analysis: 'AI analysis failed',
        suggestedFix: null,
        confidence: 0,
        error: error.message
      };
    }
  }

  buildAnalysisPromptWithArtifacts(payload) {
    let prompt = `You are an expert software engineer analyzing a test failure with full context including screenshots, videos, and traces.\n\n`;
    
    prompt += `**Test Information:**\n`;
    prompt += `- Test Name: ${payload.test.name}\n`;
    prompt += `- File: ${payload.test.file}\n`;
    prompt += `- Project: ${payload.test.project}\n`;
    prompt += `- Error Line: ${payload.test.line}\n\n`;
    
    prompt += `**Error Message:**\n${payload.error.message}\n\n`;
    
    if (payload.error.stack) {
      prompt += `**Error Stack:**\n${payload.error.stack}\n\n`;
    }
    
    prompt += `**Code Context:**\n\`\`\`\n${payload.code.context}\n\`\`\`\n\n`;
    
    if (payload.artifacts.screenshots.length > 0) {
      prompt += `**Visual Evidence:**\n`;
      prompt += `${payload.artifacts.screenshots.length} screenshot(s) showing the failure state.\n`;
      prompt += `The screenshots show the UI state at the time of failure.\n\n`;
    }
    
    if (payload.artifacts.errorContext) {
      prompt += `**Additional Context:**\n${payload.artifacts.errorContext}\n\n`;
    }
    
    prompt += `Please provide your response in JSON format with analysis, fix, and confidence.\n`;
    
    return prompt;
  }

  readFileContent(filePath) {
    try {
      const fullPath = path.resolve(filePath);
      if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf-8');
      }
      return null;
    } catch (error) {
      console.error(`Failed to read file ${filePath}: ${error.message}`);
      return null;
    }
  }

  buildErrorContext(failure, fileContent) {
    const lines = fileContent ? fileContent.split('\n') : [];
    const errorLine = failure.line || 0;
    const contextStart = Math.max(0, errorLine - 10);
    const contextEnd = Math.min(lines.length, errorLine + 10);
    const contextLines = lines.slice(contextStart, contextEnd);

    return {
      testName: failure.testName,
      file: failure.file,
      errorMessage: failure.error.message || 'Unknown error',
      errorStack: failure.error.stack || '',
      line: errorLine,
      column: failure.column,
      codeContext: contextLines.join('\n'),
      contextStartLine: contextStart + 1,
      fullFileContent: fileContent,
      projectName: failure.projectName
    };
  }

  buildAnalysisPrompt(context) {
    return `You are an expert software engineer analyzing a test failure. Analyze the following test failure and provide a detailed fix.

**Test Information:**
- Test Name: ${context.testName}
- File: ${context.file}
- Project: ${context.projectName}
- Error Line: ${context.line}

**Error Message:**
${context.errorMessage}

**Error Stack:**
${context.errorStack}

**Code Context (around line ${context.contextStartLine}):**
\`\`\`
${context.codeContext}
\`\`\`

**Full File Content:**
\`\`\`
${context.fullFileContent}
\`\`\`

Please provide your response in the following JSON format:
{
  "analysis": "Detailed explanation of what caused the error",
  "rootCause": "The root cause of the issue",
  "fix": {
    "description": "Description of the fix",
    "changes": [
      {
        "file": "path/to/file",
        "action": "replace|insert|delete",
        "lineStart": 10,
        "lineEnd": 15,
        "oldCode": "code to replace",
        "newCode": "new code"
      }
    ]
  },
  "confidence": 0.95,
  "affectedFiles": ["list of files that need changes"],
  "testingRecommendations": "How to verify the fix works"
}`;
  }

  async callAI(prompt) {
    if (this.config.aiProvider === 'openai') {
      return await this.callOpenAI(prompt);
    } else if (this.config.aiProvider === 'anthropic') {
      return await this.callAnthropic(prompt);
    } else if (this.config.aiProvider === 'windsurf') {
      return await this.callWindsurf(prompt);
    } else {
      throw new Error(`Unsupported AI provider: ${this.config.aiProvider}`);
    }
  }

  async callOpenAI(prompt) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software engineer who analyzes test failures and provides precise fixes. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    return JSON.parse(content);
  }

  async callAnthropic(prompt) {
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Failed to parse AI response as JSON');
  }

  async callWindsurf(prompt) {
    console.log('\n📝 AI Analysis Prompt Generated:');
    console.log('─'.repeat(80));
    console.log(prompt);
    console.log('─'.repeat(80));
    console.log('\n⚠️  Windsurf IDE Integration:');
    console.log('Please copy the above prompt and paste it into Windsurf IDE.');
    console.log('The AI will analyze the error and suggest fixes.');
    console.log('\nWaiting for manual input of AI response...\n');
    
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      let jsonInput = '';
      console.log('Paste the AI response JSON (press Ctrl+D or Ctrl+Z when done):');
      
      readline.on('line', (line) => {
        jsonInput += line + '\n';
      });

      readline.on('close', () => {
        try {
          const parsed = JSON.parse(jsonInput);
          resolve(parsed);
        } catch (error) {
          console.error('Failed to parse JSON input:', error.message);
          resolve({
            analysis: 'Manual analysis required',
            rootCause: 'Could not parse AI response',
            fix: { description: 'Manual fix required', changes: [] },
            confidence: 0,
            affectedFiles: []
          });
        }
      });
    });
  }

  generateErrorReport(analysisResults) {
    const report = {
      summary: {
        totalFailures: analysisResults.failures?.length || 0,
        timestamp: analysisResults.timestamp,
        analyzedFailures: analysisResults.analysisResults?.length || 0
      },
      failures: [],
      recommendations: []
    };

    if (analysisResults.analysisResults) {
      for (const result of analysisResults.analysisResults) {
        report.failures.push({
          test: result.failure.testName,
          file: result.failure.file,
          error: result.failure.error.message,
          analysis: result.analysis,
          confidence: result.confidence,
          suggestedFix: result.suggestedFix?.description
        });

        if (result.suggestedFix?.testingRecommendations) {
          report.recommendations.push(result.suggestedFix.testingRecommendations);
        }
      }
    }

    return report;
  }
}

module.exports = ErrorAnalyzer;
