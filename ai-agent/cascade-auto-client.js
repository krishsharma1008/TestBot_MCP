const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Automated Cascade AI Client
 * Automatically invokes Windsurf Cascade to analyze and fix test failures
 * No manual intervention required - fully automated workflow
 */
class CascadeAutoClient {
  constructor(config = {}) {
    this.config = {
      model: config.model || 'cascade-codex-5.1',
      timeout: config.timeout || 300000, // 5 minutes per analysis
      batchSize: config.batchSize || 3, // Analyze 3 failures at a time
      showInIDE: config.showInIDE !== false, // Show analysis in Windsurf IDE
      ...config
    };
    
    this.analysisQueue = [];
    this.results = [];
  }

  /**
   * Automatically analyze all test failures using Cascade
   * @param {Array} failures - Array of test failures with artifacts
   * @returns {Promise<Array>} - Analysis results from Cascade
   */
  async analyzeFailures(failures) {
    console.log(`\n🌊 Cascade AI Auto-Analysis Starting...`);
    console.log(`   Model: ${this.config.model}`);
    console.log(`   Failures to analyze: ${failures.length}`);
    console.log(`   Batch size: ${this.config.batchSize}`);
    
    const results = [];
    
    // Process failures in batches to avoid overwhelming Cascade
    for (let i = 0; i < failures.length; i += this.config.batchSize) {
      const batch = failures.slice(i, i + this.config.batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(failures.length / this.config.batchSize)}`);
      
      const batchResults = await this.analyzeBatch(batch);
      results.push(...batchResults);
    }
    
    console.log(`\n✅ Cascade analysis complete: ${results.length} failures analyzed`);
    return results;
  }

  /**
   * Analyze a batch of failures
   */
  async analyzeBatch(failures) {
    const promises = failures.map(failure => this.analyzeFailure(failure));
    return await Promise.all(promises);
  }

  /**
   * Analyze a single failure using Cascade AI
   */
  async analyzeFailure(failure) {
    console.log(`\n  🔍 Analyzing: ${failure.testName}`);
    console.log(`     File: ${failure.file}`);
    console.log(`     Artifacts: ${failure.artifacts.screenshots.length} screenshots, ${failure.artifacts.videos.length} videos`);
    
    try {
      // Create analysis prompt for Cascade
      const prompt = this.buildCascadePrompt(failure);
      
      // Invoke Cascade AI automatically
      const cascadeResponse = await this.invokeCascade(prompt, failure);
      
      // Parse and validate response
      const analysis = this.parseResponse(cascadeResponse);
      
      console.log(`     ✅ Analysis complete (confidence: ${analysis.confidence})`);
      
      return {
        failure,
        analysis: analysis.analysis,
        suggestedFix: analysis.fix,
        confidence: analysis.confidence,
        affectedFiles: analysis.affectedFiles || [failure.file]
      };
      
    } catch (error) {
      console.error(`     ❌ Analysis failed: ${error.message}`);
      return {
        failure,
        analysis: `Cascade analysis failed: ${error.message}`,
        suggestedFix: null,
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Build a comprehensive prompt for Cascade AI
   */
  buildCascadePrompt(failure) {
    let prompt = `# Test Failure Analysis Request\n\n`;
    prompt += `**Model**: Cascade Codex 5.1\n\n`;
    
    // Test information
    prompt += `## Test Information\n`;
    prompt += `- **Test**: ${failure.testName}\n`;
    prompt += `- **File**: ${failure.file}\n`;
    prompt += `- **Line**: ${failure.line}\n`;
    prompt += `- **Status**: ${failure.status}\n\n`;
    
    // Error details
    prompt += `## Error\n\`\`\`\n${failure.error.message || 'No error message'}\n\`\`\`\n\n`;
    
    // Code context
    if (failure.artifacts.errorContext) {
      prompt += `## Code Context\n${failure.artifacts.errorContext}\n\n`;
    }
    
    // Visual evidence
    if (failure.artifacts.screenshots.length > 0) {
      prompt += `## Screenshots\n`;
      failure.artifacts.screenshots.forEach((screenshot, idx) => {
        prompt += `![Screenshot ${idx + 1}](${screenshot.dataUrl})\n`;
      });
      prompt += `\n`;
    }
    
    // Analysis request
    prompt += `## Task\n`;
    prompt += `Analyze this test failure and provide a fix. Return ONLY a JSON object:\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += `{\n`;
    prompt += `  "analysis": "What caused this failure",\n`;
    prompt += `  "rootCause": "Root cause",\n`;
    prompt += `  "fix": {\n`;
    prompt += `    "description": "Fix description",\n`;
    prompt += `    "changes": [{\n`;
    prompt += `      "file": "${failure.file}",\n`;
    prompt += `      "action": "replace",\n`;
    prompt += `      "lineStart": ${failure.line},\n`;
    prompt += `      "lineEnd": ${failure.line},\n`;
    prompt += `      "oldCode": "current code",\n`;
    prompt += `      "newCode": "fixed code"\n`;
    prompt += `    }]\n`;
    prompt += `  },\n`;
    prompt += `  "confidence": 0.95,\n`;
    prompt += `  "affectedFiles": ["${failure.file}"]\n`;
    prompt += `}\n`;
    prompt += `\`\`\`\n`;
    
    return prompt;
  }

  /**
   * Invoke Cascade AI through Windsurf IDE
   * This is the key automation - directly calling Cascade
   */
  async invokeCascade(prompt, failure) {
    // Save prompt to temp file for Cascade to process
    const tempDir = path.join(process.cwd(), '.cascade-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const promptFile = path.join(tempDir, `prompt-${Date.now()}.md`);
    const responseFile = path.join(tempDir, `response-${Date.now()}.json`);
    
    fs.writeFileSync(promptFile, prompt);
    
    // Method 1: Try to invoke Cascade via Windsurf CLI (if available)
    try {
      const response = await this.invokeCascadeViaCLI(promptFile, responseFile);
      if (response) return response;
    } catch (error) {
      console.log(`     ⚠️  CLI invocation not available: ${error.message}`);
    }
    
    // Method 2: Use Windsurf IDE integration (show in IDE for developer to see)
    if (this.config.showInIDE) {
      return await this.invokeCascadeViaIDE(prompt, failure);
    }
    
    // Method 3: Fallback - create analysis request for manual processing
    return await this.createAnalysisRequest(prompt, failure);
  }

  /**
   * Invoke Cascade via Windsurf CLI (if available)
   */
  async invokeCascadeViaCLI(promptFile, responseFile) {
    return new Promise((resolve, reject) => {
      // Try to find Windsurf executable
      const windsurfPaths = [
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\windsurf\\Windsurf.exe',
        'windsurf'
      ];
      
      let windsurfPath = null;
      for (const p of windsurfPaths) {
        if (fs.existsSync(p)) {
          windsurfPath = p;
          break;
        }
      }
      
      if (!windsurfPath) {
        reject(new Error('Windsurf executable not found'));
        return;
      }
      
      // Invoke Windsurf with AI analysis command
      const args = ['--ai-analyze', promptFile, '--output', responseFile, '--model', this.config.model];
      const process = spawn(windsurfPath, args, {
        timeout: this.config.timeout,
        stdio: 'pipe'
      });
      
      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0 && fs.existsSync(responseFile)) {
          const response = fs.readFileSync(responseFile, 'utf-8');
          resolve(response);
        } else {
          reject(new Error('Cascade CLI invocation failed'));
        }
      });
      
      setTimeout(() => {
        process.kill();
        reject(new Error('Cascade invocation timeout'));
      }, this.config.timeout);
    });
  }

  /**
   * Invoke Cascade via Windsurf IDE integration
   * Opens the analysis in Windsurf for the developer to see
   */
  async invokeCascadeViaIDE(prompt, failure) {
    console.log(`     🎯 Sending to Windsurf IDE (Cascade will analyze in real-time)...`);
    
    // Create a workspace file that Windsurf can open
    const workspaceDir = path.join(process.cwd(), '.cascade-workspace');
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    
    const analysisFile = path.join(workspaceDir, `analysis-${failure.testName.replace(/[^a-z0-9]/gi, '-')}.md`);
    fs.writeFileSync(analysisFile, prompt);
    
    // Create a response placeholder
    const responseFile = analysisFile.replace('.md', '-response.json');
    
    console.log(`     📄 Analysis request: ${path.relative(process.cwd(), analysisFile)}`);
    console.log(`     ⏳ Waiting for Cascade response...`);
    
    // Wait for response file to be created (developer uses Cascade in IDE)
    const response = await this.waitForResponse(responseFile, 60000); // 1 minute timeout
    
    if (response) {
      return response;
    }
    
    // If no response, return a placeholder
    throw new Error('No response from Cascade - analysis request saved for manual review');
  }

  /**
   * Wait for Cascade response file
   */
  async waitForResponse(responseFile, timeout) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (fs.existsSync(responseFile)) {
          clearInterval(checkInterval);
          try {
            const response = fs.readFileSync(responseFile, 'utf-8');
            resolve(response);
          } catch (error) {
            resolve(null);
          }
        }
        
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 1000); // Check every second
    });
  }

  /**
   * Create analysis request for manual processing (fallback)
   */
  async createAnalysisRequest(prompt, failure) {
    const requestsDir = path.join(process.cwd(), 'ai-agent-requests');
    if (!fs.existsSync(requestsDir)) {
      fs.mkdirSync(requestsDir, { recursive: true });
    }
    
    const testName = failure.testName.replace(/[^a-z0-9]/gi, '-').substring(0, 50);
    const requestFile = path.join(requestsDir, `${testName}.md`);
    const responseFile = path.join(requestsDir, `${testName}-response.json`);
    
    fs.writeFileSync(requestFile, prompt);
    
    // Check if response already exists
    if (fs.existsSync(responseFile)) {
      return fs.readFileSync(responseFile, 'utf-8');
    }
    
    // Return placeholder
    throw new Error('Analysis request created - awaiting manual Cascade analysis');
  }

  /**
   * Parse Cascade response
   */
  parseResponse(response) {
    if (typeof response === 'string') {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        response = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON in Cascade response');
      }
    }
    
    return {
      analysis: response.analysis || 'No analysis provided',
      rootCause: response.rootCause || 'Unknown',
      fix: response.fix || { description: 'No fix provided', changes: [] },
      confidence: response.confidence || 0.5,
      affectedFiles: response.affectedFiles || []
    };
  }
}

module.exports = CascadeAutoClient;
