const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class WindsurfAPIClient {
  constructor(config = {}) {
    this.config = {
      mode: config.mode || 'file', // 'file', 'cli', or 'api'
      tempDir: config.tempDir || '.ai-agent-temp',
      model: config.model || 'cascade-codex-5.1', // Windsurf Cascade model
      timeout: config.timeout || 120000,
      ...config
    };
  }

  detectWindsurfPath() {
    const possiblePaths = [
      'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\windsurf\\Windsurf.exe',
      'C:\\Program Files\\Windsurf\\Windsurf.exe',
      '/Applications/Windsurf.app/Contents/MacOS/Windsurf',
      '/usr/local/bin/windsurf',
      'windsurf'
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return 'windsurf';
  }

  async analyzeFailure(payload) {
    console.log(`\n🌊 Sending to Windsurf IDE for analysis...`);
    console.log(`   Test: ${payload.test.name}`);
    console.log(`   Artifacts: ${payload.artifacts.screenshots.length} screenshots, ${payload.artifacts.videos.length} videos, ${payload.artifacts.traces.length} traces`);

    if (this.config.mode === 'api') {
      return await this.analyzeViaAPI(payload);
    } else {
      return await this.analyzeViaCLI(payload);
    }
  }

  async analyzeViaAPI(payload) {
    const prompt = this.buildPromptFromPayload(payload);
    
    try {
      const response = await this.callWindsurfAPI(prompt, payload);
      return this.parseResponse(response);
    } catch (error) {
      console.error(`❌ Windsurf API error: ${error.message}`);
      console.log(`\n⚠️  Falling back to file-based communication...`);
      return await this.analyzeViaFile(payload);
    }
  }

  async callWindsurfAPI(prompt, payload) {
    const tempDir = path.join(process.cwd(), '.ai-agent-temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const requestFile = path.join(tempDir, `request-${Date.now()}.json`);
    const responseFile = path.join(tempDir, `response-${Date.now()}.json`);

    const request = {
      prompt: prompt,
      payload: payload,
      responseFile: responseFile,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(requestFile, JSON.stringify(request, null, 2));

    console.log(`\n📝 Request saved to: ${requestFile}`);
    console.log(`\n🤖 Attempting to invoke Windsurf AI...`);

    try {
      const command = `"${this.config.windsurfPath}" --ai-analyze "${requestFile}" --output "${responseFile}"`;
      execSync(command, { 
        timeout: this.config.timeout,
        stdio: 'pipe'
      });

      if (fs.existsSync(responseFile)) {
        const response = JSON.parse(fs.readFileSync(responseFile, 'utf-8'));
        console.log(`✅ Received response from Windsurf AI`);
        return response;
      }
    } catch (error) {
      console.log(`⚠️  Direct API call not available: ${error.message}`);
    }

    throw new Error('Windsurf API not available');
  }

  async analyzeViaFile(payload) {
    const tempDir = path.join(process.cwd(), 'ai-agent-requests');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const testName = payload.test.name.replace(/[^a-z0-9]/gi, '-').substring(0, 50);
    const requestFile = path.join(tempDir, `${testName}.md`);
    const responseFile = path.join(tempDir, `${testName}-response.json`);

    const markdown = this.buildMarkdownFromPayload(payload);
    fs.writeFileSync(requestFile, markdown);

    console.log(`     📄 Request saved: ai-agent-requests/${testName}.md`);
    
    // Check if response already exists
    if (fs.existsSync(responseFile)) {
      try {
        const response = JSON.parse(fs.readFileSync(responseFile, 'utf-8'));
        console.log(`     ✅ Using existing response`);
        return this.parseResponse(response);
      } catch (error) {
        console.error(`     ⚠️  Invalid response file, will need new analysis`);
      }
    }

    // Return a placeholder that indicates manual analysis needed
    console.log(`     ⏳ Awaiting Windsurf analysis...`);
    return this.generateFallbackAnalysis(payload);
  }

  async analyzeViaCLI(payload) {
    return await this.analyzeViaFile(payload);
  }

  buildPromptFromPayload(payload) {
    let prompt = `You are an expert software engineer analyzing a test failure. Analyze the following test failure and provide a detailed fix.\n\n`;
    
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
    
    if (payload.artifacts.errorContext) {
      prompt += `**Additional Context:**\n${payload.artifacts.errorContext}\n\n`;
    }
    
    if (payload.artifacts.screenshots.length > 0) {
      prompt += `**Visual Evidence:**\n`;
      prompt += `${payload.artifacts.screenshots.length} screenshot(s) available showing the failure state.\n\n`;
    }
    
    if (payload.artifacts.traces.length > 0) {
      prompt += `**Playwright Traces:**\n`;
      payload.artifacts.traces.forEach(trace => {
        prompt += `- ${trace.viewCommand}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `Please provide your response in the following JSON format:\n`;
    prompt += `{\n`;
    prompt += `  "analysis": "Detailed explanation of what caused the error",\n`;
    prompt += `  "rootCause": "The root cause of the issue",\n`;
    prompt += `  "fix": {\n`;
    prompt += `    "description": "Description of the fix",\n`;
    prompt += `    "changes": [\n`;
    prompt += `      {\n`;
    prompt += `        "file": "path/to/file",\n`;
    prompt += `        "action": "replace|insert|delete",\n`;
    prompt += `        "lineStart": 10,\n`;
    prompt += `        "lineEnd": 15,\n`;
    prompt += `        "oldCode": "code to replace",\n`;
    prompt += `        "newCode": "new code"\n`;
    prompt += `      }\n`;
    prompt += `    ]\n`;
    prompt += `  },\n`;
    prompt += `  "confidence": 0.95,\n`;
    prompt += `  "affectedFiles": ["list of files that need changes"],\n`;
    prompt += `  "testingRecommendations": "How to verify the fix works"\n`;
    prompt += `}\n`;
    
    return prompt;
  }

  buildMarkdownFromPayload(payload) {
    let markdown = `# 🔍 Test Failure Analysis Request\n\n`;
    markdown += `> **AI Model**: Please use Windsurf Cascade with **Codex 5.1** for this analysis\n\n`;
    markdown += `## 📋 Test Information\n\n`;
    markdown += `- **Test Name**: ${payload.test.name}\n`;
    markdown += `- **File**: ${payload.test.file}\n`;
    markdown += `- **Project**: ${payload.test.project}\n`;
    markdown += `- **Status**: ${payload.test.status}\n`;
    markdown += `- **Duration**: ${payload.test.duration}ms\n`;
    
    if (payload.test.error.line) {
      markdown += `- **Error Line**: ${payload.test.error.line}\n`;
    }
    
    markdown += `\n## ❌ Error Details\n\n`;
    markdown += `\`\`\`\n${payload.test.error.message}\n\`\`\`\n\n`;
    
    if (payload.test.error.stack) {
      markdown += `### Stack Trace\n\n`;
      markdown += `\`\`\`\n${payload.test.error.stack}\n\`\`\`\n\n`;
    }
    
    markdown += `## 💻 Code Context\n\n`;
    markdown += `**Around line ${payload.code.contextStartLine}:**\n\n`;
    markdown += `\`\`\`javascript\n${payload.code.context}\n\`\`\`\n\n`;
    
    if (payload.artifacts.errorContext) {
      markdown += `## 📝 Additional Error Context\n\n`;
      markdown += `${payload.artifacts.errorContext}\n\n`;
    }
    
    if (payload.artifacts.screenshots.length > 0) {
      markdown += `## 📸 Screenshots (${payload.artifacts.screenshots.length})\n\n`;
      payload.artifacts.screenshots.forEach((screenshot, idx) => {
        markdown += `### Screenshot ${idx + 1}: ${screenshot.name}\n\n`;
        markdown += `![Screenshot ${idx + 1}](${screenshot.dataUrl})\n\n`;
        markdown += `*Path: \`${screenshot.path}\`*\n\n`;
      });
    }
    
    if (payload.artifacts.videos.length > 0) {
      markdown += `## 🎥 Videos (${payload.artifacts.videos.length})\n\n`;
      payload.artifacts.videos.forEach((video, idx) => {
        markdown += `- **Video ${idx + 1}**: \`${video.path}\`\n`;
      });
      markdown += `\n`;
    }
    
    if (payload.artifacts.traces.length > 0) {
      markdown += `## 🔬 Playwright Traces (${payload.artifacts.traces.length})\n\n`;
      payload.artifacts.traces.forEach((trace, idx) => {
        markdown += `- **Trace ${idx + 1}**: \`${trace.viewCommand}\`\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `---\n\n`;
    markdown += `## 🎯 Analysis Request\n\n`;
    markdown += `Please analyze this test failure and provide:\n\n`;
    markdown += `1. **Root cause analysis** - What caused this failure?\n`;
    markdown += `2. **Suggested fix** - Specific code changes needed\n`;
    markdown += `3. **Confidence level** - How confident are you in this fix? (0-1)\n`;
    markdown += `4. **Testing recommendations** - How to verify the fix\n\n`;
    
    markdown += `\n## 🎯 Analysis Request for Windsurf Cascade (Codex 5.1)\n\n`;
    markdown += `**Instructions for Cascade AI:**\n\n`;
    markdown += `1. Analyze the test failure above with all provided context (error, code, screenshots)\n`;
    markdown += `2. Identify the root cause of the failure\n`;
    markdown += `3. Provide a precise fix with exact code changes\n`;
    markdown += `4. Return your response as a JSON object with this structure:\n\n`;
    markdown += `\`\`\`json\n`;
    markdown += `{\n`;
    markdown += `  "analysis": "Detailed analysis of what went wrong and why",\n`;
    markdown += `  "rootCause": "The fundamental root cause of the failure",\n`;
    markdown += `  "fix": {\n`;
    markdown += `    "description": "Clear description of the fix to apply",\n`;
    markdown += `    "changes": [\n`;
    markdown += `      {\n`;
    markdown += `        "file": "path/to/file.js",\n`;
    markdown += `        "action": "replace",\n`;
    markdown += `        "lineStart": 10,\n`;
    markdown += `        "lineEnd": 15,\n`;
    markdown += `        "oldCode": "exact code to replace",\n`;
    markdown += `        "newCode": "exact new code"\n`;
    markdown += `      }\n`;
    markdown += `    ]\n`;
    markdown += `  },\n`;
    markdown += `  "confidence": 0.95,\n`;
    markdown += `  "affectedFiles": ["file1.js", "file2.js"],\n`;
    markdown += `  "testingStrategy": "How to verify the fix works"\n`;
    markdown += `}\n`;
    markdown += `\`\`\`\n\n`;
    markdown += `**Critical**: Return ONLY the JSON object above, no markdown formatting, no additional text.\n`;
    markdown += `The JSON will be parsed programmatically, so it must be valid and complete.\n`;
    
    markdown += `---\n\n`;
    markdown += `*Generated by AI Agent v1.0.0*\n`;
    
    return markdown;
  }

  parseResponse(response) {
    if (typeof response === 'string') {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        response = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON found in response');
      }
    }

    return {
      analysis: response.analysis || 'No analysis provided',
      rootCause: response.rootCause || 'Unknown',
      fix: response.fix || { description: 'No fix provided', changes: [] },
      confidence: response.confidence || 0.5,
      affectedFiles: response.affectedFiles || [],
      testingRecommendations: response.testingRecommendations || 'Run tests to verify'
    };
  }

  generateFallbackAnalysis(payload) {
    return {
      analysis: `Test "${payload.test.name}" failed with error: ${payload.error.message}. Manual analysis required.`,
      rootCause: 'Unable to determine automatically',
      fix: {
        description: 'Manual intervention required',
        changes: []
      },
      confidence: 0.3,
      affectedFiles: [payload.test.file],
      testingRecommendations: 'Review the error message and test artifacts manually'
    };
  }

  async waitForUserInput() {
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('', () => {
        readline.close();
        resolve();
      });
    });
  }
}

module.exports = WindsurfAPIClient;
