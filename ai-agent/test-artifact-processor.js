const fs = require('fs');
const path = require('path');

class TestArtifactProcessor {
  constructor(config = {}) {
    this.config = {
      testResultsPath: config.testResultsPath || './test-results.json',
      artifactsDir: config.artifactsDir || './test-results',
      includeScreenshots: config.includeScreenshots !== false,
      includeVideos: config.includeVideos !== false,
      includeTraces: config.includeTraces !== false,
      ...config
    };
  }

  async processTestResults() {
    console.log('📦 Processing test artifacts...');
    
    const testResults = this.loadTestResults();
    if (!testResults) {
      throw new Error('No test results found. Run tests first.');
    }

    const failures = this.extractFailuresWithArtifacts(testResults);
    
    console.log(`✅ Processed ${failures.length} test failure(s) with artifacts`);
    
    return {
      testResults,
      failures,
      timestamp: new Date().toISOString()
    };
  }

  loadTestResults() {
    const resultsPath = path.resolve(this.config.testResultsPath);
    
    if (!fs.existsSync(resultsPath)) {
      console.error(`❌ Test results not found at: ${resultsPath}`);
      return null;
    }

    try {
      const content = fs.readFileSync(resultsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`❌ Failed to parse test results: ${error.message}`);
      return null;
    }
  }

  extractFailuresWithArtifacts(testResults) {
    const failures = [];
    
    const processSuites = (suites) => {
      for (const suite of suites) {
        // Process specs in this suite
        if (suite.specs) {
          for (const spec of suite.specs) {
            // Each spec has a 'tests' array with the actual test runs
            if (spec.tests) {
              for (const test of spec.tests) {
                // Check if test has failed - Playwright uses "unexpected" status for failures
                const hasFailed = test.status === 'unexpected' || 
                                 test.status === 'flaky' ||
                                 test.status === 'failed' || 
                                 test.status === 'timedOut';
                
                // Also check results array
                const hasFailedResult = test.results && test.results.some(result => 
                  result.status === 'failed' || 
                  result.status === 'timedOut' ||
                  result.status === 'interrupted'
                );
                
                if (hasFailed || hasFailedResult) {
                  const failure = this.buildFailureWithArtifacts(test, spec, suite);
                  failures.push(failure);
                }
              }
            }
          }
        }
        
        // Recursively process nested suites
        if (suite.suites) {
          processSuites(suite.suites);
        }
      }
    };

    if (testResults.suites) {
      processSuites(testResults.suites);
    }
    return failures;
  }

  buildFailureWithArtifacts(test, spec, suite) {
    // Extract error information from results
    let error = {};
    let errorLine = null;
    let errorColumn = null;
    
    if (test.results && test.results.length > 0) {
      const failedResult = test.results.find(r => 
        r.status === 'failed' || r.status === 'timedOut' || r.status === 'interrupted'
      );
      
      if (failedResult && failedResult.errors && failedResult.errors.length > 0) {
        error = failedResult.errors[0];
        errorLine = error.location?.line;
        errorColumn = error.location?.column;
      }
    }
    
    const failure = {
      testName: spec.title,  // Use spec.title for the test name
      file: spec.file || suite.file,
      projectName: test.projectName || test.projectId,
      status: test.status,
      duration: test.results?.[0]?.duration || 0,
      error: error,
      line: errorLine || spec.line || suite.line,
      column: errorColumn || spec.column || suite.column,
      artifacts: {
        screenshots: [],
        videos: [],
        traces: [],
        errorContext: null
      }
    };

    // Extract artifacts from test results
    if (test.results) {
      for (const result of test.results) {
        // Process attachments
        if (result.attachments) {
          for (const attachment of result.attachments) {
            this.processAttachment(attachment, failure);
          }
        }
      }
    }

    return failure;
  }

  processAttachment(attachment, failure) {
    const { name, contentType, path: attachmentPath } = attachment;
    
    if (!attachmentPath || !fs.existsSync(attachmentPath)) {
      return;
    }

    // Screenshots
    if (contentType && contentType.includes('image') && this.config.includeScreenshots) {
      const screenshot = this.processScreenshot(attachmentPath);
      if (screenshot) {
        failure.artifacts.screenshots.push(screenshot);
      }
    }
    
    // Videos
    else if (contentType && contentType.includes('video') && this.config.includeVideos) {
      const video = this.processVideo(attachmentPath);
      if (video) {
        failure.artifacts.videos.push(video);
      }
    }
    
    // Traces
    else if (contentType && contentType.includes('zip') && this.config.includeTraces) {
      const trace = this.processTrace(attachmentPath);
      if (trace) {
        failure.artifacts.traces.push(trace);
      }
    }
    
    // Error context (markdown)
    else if (name && name.includes('Error Context')) {
      const errorContext = this.processErrorContext(attachmentPath);
      if (errorContext) {
        failure.artifacts.errorContext = errorContext;
      }
    }
  }

  processScreenshot(screenshotPath) {
    try {
      const stats = fs.statSync(screenshotPath);
      const base64 = fs.readFileSync(screenshotPath, 'base64');
      
      return {
        path: screenshotPath,
        name: path.basename(screenshotPath),
        size: stats.size,
        base64: base64,
        dataUrl: `data:image/png;base64,${base64}`
      };
    } catch (error) {
      console.error(`Failed to process screenshot: ${error.message}`);
      return null;
    }
  }

  processVideo(videoPath) {
    try {
      const stats = fs.statSync(videoPath);
      
      return {
        path: videoPath,
        name: path.basename(videoPath),
        size: stats.size,
        exists: true
      };
    } catch (error) {
      console.error(`Failed to process video: ${error.message}`);
      return null;
    }
  }

  processTrace(tracePath) {
    try {
      const stats = fs.statSync(tracePath);
      
      return {
        path: tracePath,
        name: path.basename(tracePath),
        size: stats.size,
        viewCommand: `npx playwright show-trace ${tracePath}`
      };
    } catch (error) {
      console.error(`Failed to process trace: ${error.message}`);
      return null;
    }
  }

  processErrorContext(contextPath) {
    try {
      const content = fs.readFileSync(contextPath, 'utf-8');
      return {
        path: contextPath,
        content: content
      };
    } catch (error) {
      console.error(`Failed to process error context: ${error.message}`);
      return null;
    }
  }

  buildEnhancedErrorContext(failure) {
    const fileContent = this.readFileContent(failure.file);
    const lines = fileContent ? fileContent.split('\n') : [];
    const errorLine = failure.line || 0;
    const contextStart = Math.max(0, errorLine - 15);
    const contextEnd = Math.min(lines.length, errorLine + 15);
    const contextLines = lines.slice(contextStart, contextEnd);

    const context = {
      testName: failure.testName,
      file: failure.file,
      projectName: failure.projectName,
      errorMessage: failure.error.message || 'Unknown error',
      errorStack: failure.error.stack || '',
      line: errorLine,
      column: failure.column,
      codeContext: contextLines.join('\n'),
      contextStartLine: contextStart + 1,
      fullFileContent: fileContent,
      
      // Enhanced with artifacts
      hasScreenshots: failure.artifacts.screenshots.length > 0,
      screenshotCount: failure.artifacts.screenshots.length,
      screenshots: failure.artifacts.screenshots,
      
      hasVideos: failure.artifacts.videos.length > 0,
      videoCount: failure.artifacts.videos.length,
      videos: failure.artifacts.videos,
      
      hasTraces: failure.artifacts.traces.length > 0,
      traceCount: failure.artifacts.traces.length,
      traces: failure.artifacts.traces,
      
      errorContext: failure.artifacts.errorContext?.content || null
    };

    return context;
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

  generateWindsurfPayload(failure) {
    const context = this.buildEnhancedErrorContext(failure);
    
    const payload = {
      type: 'test_failure_analysis',
      test: {
        name: context.testName,
        file: context.file,
        project: context.projectName,
        line: context.line,
        column: context.column
      },
      error: {
        message: context.errorMessage,
        stack: context.errorStack
      },
      code: {
        context: context.codeContext,
        contextStartLine: context.contextStartLine,
        fullFile: context.fullFileContent
      },
      artifacts: {
        screenshots: context.screenshots.map(s => ({
          name: s.name,
          path: s.path,
          dataUrl: s.dataUrl
        })),
        videos: context.videos.map(v => ({
          name: v.name,
          path: v.path
        })),
        traces: context.traces.map(t => ({
          name: t.name,
          path: t.path,
          viewCommand: t.viewCommand
        })),
        errorContext: context.errorContext
      },
      metadata: {
        timestamp: new Date().toISOString(),
        duration: failure.duration
      }
    };

    return payload;
  }

  generateMarkdownReport(failure) {
    const context = this.buildEnhancedErrorContext(failure);
    
    let markdown = `# Test Failure Analysis Request\n\n`;
    markdown += `## Test Information\n`;
    markdown += `- **Test Name**: ${context.testName}\n`;
    markdown += `- **File**: ${context.file}\n`;
    markdown += `- **Project**: ${context.projectName}\n`;
    markdown += `- **Error Line**: ${context.line}\n\n`;
    
    markdown += `## Error Details\n`;
    markdown += `\`\`\`\n${context.errorMessage}\n\`\`\`\n\n`;
    
    if (context.errorStack) {
      markdown += `### Stack Trace\n`;
      markdown += `\`\`\`\n${context.errorStack}\n\`\`\`\n\n`;
    }
    
    markdown += `## Code Context (around line ${context.contextStartLine})\n`;
    markdown += `\`\`\`javascript\n${context.codeContext}\n\`\`\`\n\n`;
    
    if (context.errorContext) {
      markdown += `## Additional Error Context\n`;
      markdown += `${context.errorContext}\n\n`;
    }
    
    if (context.hasScreenshots) {
      markdown += `## Screenshots (${context.screenshotCount})\n`;
      context.screenshots.forEach((screenshot, idx) => {
        markdown += `### Screenshot ${idx + 1}: ${screenshot.name}\n`;
        markdown += `![Screenshot](${screenshot.dataUrl})\n\n`;
      });
    }
    
    if (context.hasVideos) {
      markdown += `## Videos (${context.videoCount})\n`;
      context.videos.forEach((video, idx) => {
        markdown += `- Video ${idx + 1}: \`${video.path}\`\n`;
      });
      markdown += `\n`;
    }
    
    if (context.hasTraces) {
      markdown += `## Playwright Traces (${context.traceCount})\n`;
      context.traces.forEach((trace, idx) => {
        markdown += `- Trace ${idx + 1}: \`${trace.viewCommand}\`\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `## Analysis Request\n\n`;
    markdown += `Please analyze this test failure and provide:\n`;
    markdown += `1. Root cause analysis\n`;
    markdown += `2. Suggested fix with code changes\n`;
    markdown += `3. Confidence level (0-1)\n`;
    markdown += `4. Testing recommendations\n\n`;
    markdown += `Respond in JSON format:\n`;
    markdown += `\`\`\`json\n`;
    markdown += `{\n`;
    markdown += `  "analysis": "Detailed explanation",\n`;
    markdown += `  "rootCause": "Root cause",\n`;
    markdown += `  "fix": {\n`;
    markdown += `    "description": "Fix description",\n`;
    markdown += `    "changes": [...]\n`;
    markdown += `  },\n`;
    markdown += `  "confidence": 0.95,\n`;
    markdown += `  "affectedFiles": [...],\n`;
    markdown += `  "testingRecommendations": "..."\n`;
    markdown += `}\n`;
    markdown += `\`\`\`\n`;
    
    return markdown;
  }
}

module.exports = TestArtifactProcessor;
