const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ErrorAnalyzer = require('./error-analyzer');
const CodeFixer = require('./code-fixer');
const GitHubPRCreator = require('./github-pr-creator');

class AIAgentOrchestrator {
  constructor(config = {}) {
    this.config = {
      aiProvider: config.aiProvider || process.env.AI_PROVIDER || 'openai',
      apiKey: config.apiKey || process.env.SARVAM_API_KEY || process.env.AI_API_KEY,
      model: config.model || process.env.AI_MODEL,
      githubToken: config.githubToken || process.env.GITHUB_TOKEN,
      dryRun: config.dryRun || false,
      autoCommit: config.autoCommit !== false,
      createPR: config.createPR !== false,
      minConfidence: config.minConfidence || 0.7,
      reportDir: config.reportDir || './ai-agent-reports',
      ...config
    };

    this.errorAnalyzer = new ErrorAnalyzer({
      aiProvider: this.config.aiProvider,
      apiKey: this.config.apiKey,
      model: this.config.model,
      autoAnalyze: this.config.autoAnalyze !== false
    });

    this.codeFixer = new CodeFixer({
      dryRun: this.config.dryRun,
      createBackup: true,
      autoCommit: this.config.autoCommit
    });

    this.prCreator = new GitHubPRCreator({
      githubToken: this.config.githubToken,
      baseBranch: this.config.baseBranch || 'main'
    });

    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.config.reportDir)) {
      fs.mkdirSync(this.config.reportDir, { recursive: true });
    }
  }

  async run() {
    console.log('🤖 AI Agent Orchestrator Starting...\n');
    console.log('═'.repeat(80));
    
    const startTime = Date.now();
    const results = {
      success: false,
      timestamp: new Date().toISOString(),
      steps: {}
    };

    try {
      console.log('📋 Step 1: Running tests to detect failures...');
      const testResults = await this.runTests();
      results.steps.testRun = { success: true, testResults };

      if (!testResults.hasFailures) {
        console.log('\n✅ All tests passed! No fixes needed.');
        results.success = true;
        results.message = 'All tests passed';
        return results;
      }

      console.log('\n🔍 Step 2: Analyzing test failures with AI...');
      const analysisResults = await this.errorAnalyzer.analyzeTestFailures(testResults);
      results.steps.analysis = { success: true, analysisResults };

      if (!analysisResults.hasErrors) {
        console.log('\n✅ No actionable errors found.');
        results.success = true;
        results.message = 'No actionable errors';
        return results;
      }

      console.log('\n🔧 Step 3: Applying AI-suggested fixes...');
      const fixResults = await this.codeFixer.applyFixes(analysisResults);
      results.steps.fixes = { success: true, fixResults };

      console.log('\n🧪 Step 4: Verifying fixes...');
      const verificationResults = await this.codeFixer.verifyFixes();
      results.steps.verification = verificationResults;

      if (!verificationResults.allTestsPassed) {
        console.log('\n⚠️  Warning: Some tests still failing after fixes');
        
        if (this.config.rollbackOnFailure) {
          console.log('↩️  Rolling back changes...');
          this.codeFixer.rollbackFixes();
          results.success = false;
          results.message = 'Fixes did not resolve all issues, rolled back';
          return results;
        }
      }

      console.log('\n📊 Step 5: Generating comprehensive report...');
      const report = this.generateReport(analysisResults, fixResults, verificationResults);
      this.saveReport(report);
      results.steps.report = { success: true, reportPath: report.filePath };

      if (this.config.createPR && fixResults.successfulFixes > 0) {
        console.log('\n📤 Step 6: Creating GitHub Pull Request...');
        const prResults = await this.prCreator.createPR(analysisResults, fixResults);
        results.steps.pr = { success: true, prResults };
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log('\n═'.repeat(80));
      console.log(`✅ AI Agent completed successfully in ${duration}s`);
      console.log(`📊 Report saved to: ${report.filePath}`);
      
      if (results.steps.pr) {
        console.log(`📤 Pull Request: ${results.steps.pr.prResults.prUrl}`);
      }

      results.success = true;
      results.duration = duration;
      return results;

    } catch (error) {
      console.error('\n❌ AI Agent failed:', error.message);
      console.error(error.stack);
      
      results.success = false;
      results.error = error.message;
      results.stack = error.stack;
      
      return results;
    }
  }

  loadTestResults() {
    const testResultsPath = path.join(process.cwd(), 'test-results.json');
    
    if (fs.existsSync(testResultsPath)) {
      try {
        const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf-8'));
        return testResults;
      } catch (error) {
        console.error('Failed to parse test results:', error.message);
        return null;
      }
    }
    
    return null;
  }

  async runTests() {
    try {
      execSync('npm test', { 
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      return {
        hasFailures: false,
        allPassed: true
      };
    } catch (error) {
      const testResults = this.loadTestResults();
      
      if (testResults) {
        return {
          hasFailures: true,
          allPassed: false,
          ...testResults
        };
      }
      
      return {
        hasFailures: true,
        allPassed: false,
        error: error.message
      };
    }
  }

  generateReport(analysisResults, fixResults, verificationResults) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFileName = `ai-agent-report-${timestamp}.json`;
    const reportFilePath = path.join(this.config.reportDir, reportFileName);
    
    const htmlFileName = `ai-agent-report-${timestamp}.html`;
    const htmlFilePath = path.join(this.config.reportDir, htmlFileName);

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        aiProvider: this.config.aiProvider,
        model: this.config.model,
        version: '1.0.0'
      },
      summary: {
        totalFailures: analysisResults.failures?.length || 0,
        analyzedFailures: analysisResults.analysisResults?.length || 0,
        fixesApplied: fixResults.successfulFixes || 0,
        fixesFailed: fixResults.failedFixes || 0,
        allTestsPassed: verificationResults.allTestsPassed || false,
        successRate: this.calculateSuccessRate(analysisResults, fixResults)
      },
      failures: analysisResults.failures || [],
      analyses: analysisResults.analysisResults || [],
      fixes: fixResults.appliedFixes || [],
      verification: verificationResults,
      filePath: reportFilePath
    };

    fs.writeFileSync(reportFilePath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`✅ JSON report saved: ${reportFilePath}`);

    const htmlReport = this.generateHTMLReport(report);
    fs.writeFileSync(htmlFilePath, htmlReport, 'utf-8');
    console.log(`✅ HTML report saved: ${htmlFilePath}`);

    report.htmlPath = htmlFilePath;
    return report;
  }

  calculateSuccessRate(analysisResults, fixResults) {
    const total = analysisResults.failures?.length || 0;
    const successful = fixResults.successfulFixes || 0;
    
    if (total === 0) return 100;
    return ((successful / total) * 100).toFixed(1);
  }

  generateHTMLReport(report) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent Report - ${report.metadata.timestamp}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header .subtitle {
            opacity: 0.9;
            font-size: 1.1em;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 40px;
            background: #f8f9fa;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-card .value {
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        .stat-card .label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .stat-card.success .value { color: #10b981; }
        .stat-card.warning .value { color: #f59e0b; }
        .stat-card.error .value { color: #ef4444; }
        .content {
            padding: 40px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }
        .failure-card {
            background: #f8f9fa;
            border-left: 4px solid #ef4444;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .failure-card h3 {
            color: #ef4444;
            margin-bottom: 10px;
        }
        .failure-card .file {
            color: #666;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        .failure-card .error {
            background: white;
            padding: 15px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            color: #ef4444;
            margin: 10px 0;
        }
        .analysis {
            background: white;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .confidence {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
            margin-left: 10px;
        }
        .confidence.high { background: #d1fae5; color: #065f46; }
        .confidence.medium { background: #fef3c7; color: #92400e; }
        .confidence.low { background: #fee2e2; color: #991b1b; }
        .fix-card {
            background: #f0fdf4;
            border-left: 4px solid #10b981;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 4px;
        }
        .fix-card h3 {
            color: #10b981;
            margin-bottom: 10px;
        }
        .fix-card.failed {
            background: #fef2f2;
            border-left-color: #ef4444;
        }
        .fix-card.failed h3 {
            color: #ef4444;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: bold;
            margin-right: 10px;
        }
        .badge.success { background: #d1fae5; color: #065f46; }
        .badge.error { background: #fee2e2; color: #991b1b; }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }
        pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 AI Agent Report</h1>
            <div class="subtitle">Automated Test Failure Analysis & Fixes</div>
            <div class="subtitle">${report.metadata.timestamp}</div>
        </div>

        <div class="summary">
            <div class="stat-card">
                <div class="label">Total Failures</div>
                <div class="value">${report.summary.totalFailures}</div>
            </div>
            <div class="stat-card success">
                <div class="label">Fixes Applied</div>
                <div class="value">${report.summary.fixesApplied}</div>
            </div>
            <div class="stat-card ${report.summary.fixesFailed > 0 ? 'error' : ''}">
                <div class="label">Fixes Failed</div>
                <div class="value">${report.summary.fixesFailed}</div>
            </div>
            <div class="stat-card ${report.summary.allTestsPassed ? 'success' : 'warning'}">
                <div class="label">Success Rate</div>
                <div class="value">${report.summary.successRate}%</div>
            </div>
        </div>

        <div class="content">
            <div class="section">
                <h2>📊 Test Failures</h2>
                ${report.failures.map((failure, idx) => {
                  const analysis = report.analyses[idx];
                  const confidenceClass = analysis?.confidence >= 0.8 ? 'high' : analysis?.confidence >= 0.6 ? 'medium' : 'low';
                  return `
                    <div class="failure-card">
                        <h3>❌ ${failure.testName}</h3>
                        <div class="file">📁 ${failure.file}:${failure.line || 'N/A'}</div>
                        <div class="error">${failure.error.message || 'Unknown error'}</div>
                        ${analysis ? `
                        <div class="analysis">
                            <strong>AI Analysis:</strong>
                            <span class="confidence ${confidenceClass}">
                                ${(analysis.confidence * 100).toFixed(0)}% confidence
                            </span>
                            <p style="margin-top: 10px;">${analysis.analysis}</p>
                            ${analysis.suggestedFix ? `
                            <p style="margin-top: 10px;"><strong>Suggested Fix:</strong> ${analysis.suggestedFix.description}</p>
                            ` : ''}
                        </div>
                        ` : ''}
                    </div>
                  `;
                }).join('')}
            </div>

            <div class="section">
                <h2>🔧 Applied Fixes</h2>
                ${report.fixes.map(fix => `
                    <div class="fix-card ${fix.success ? '' : 'failed'}">
                        <h3>
                            ${fix.success ? '✅' : '❌'} ${fix.test}
                        </h3>
                        <div class="file">📁 ${fix.file}</div>
                        ${fix.error ? `<div class="error">${fix.error}</div>` : ''}
                        ${fix.changes ? `<div style="margin-top: 10px;"><strong>Changes:</strong> ${fix.changes.length} modification(s)</div>` : ''}
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>🧪 Verification Results</h2>
                <div class="stat-card ${report.verification.allTestsPassed ? 'success' : 'warning'}">
                    <div class="label">All Tests Passed</div>
                    <div class="value">${report.verification.allTestsPassed ? '✅ Yes' : '⚠️ No'}</div>
                </div>
            </div>

            <div class="section">
                <h2>ℹ️ Metadata</h2>
                <pre>${JSON.stringify(report.metadata, null, 2)}</pre>
            </div>
        </div>

        <div class="footer">
            Generated by AI Agent v${report.metadata.version} | ${report.metadata.aiProvider} (${report.metadata.model || 'default'})
        </div>
    </div>
</body>
</html>`;
  }

  saveReport(report) {
    const summaryPath = path.join(this.config.reportDir, 'latest-report.json');
    fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

module.exports = AIAgentOrchestrator;
