/**
 * Report Generator
 * Generates test reports in JSON format for the dashboard
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
  /**
   * Generate a test report
   */
  async generate({ projectPath, projectName, testResults, aiAnalysis, jiraData }) {
    const timestamp = new Date().toISOString();
    const reportsDir = path.join(projectPath, 'testbot-reports');

    // Validate and normalize test results
    if (!testResults) {
      console.warn('[Report] No test results provided, creating empty report');
      testResults = {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        failures: []
      };
    }
    
    // Ensure tests array exists
    if (!testResults.tests) {
      testResults.tests = [];
    }

    // Log what we're generating
    console.error(`[Report] Generating report for: ${projectName || path.basename(projectPath)}`);
    console.error(`[Report] Test results: ${testResults.total} total, ${testResults.passed} passed, ${testResults.failed} failed`);
    console.error(`[Report] Tests array length: ${testResults.tests.length}`);

    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Build report structure
    const report = {
      metadata: {
        timestamp,
        projectName: projectName || path.basename(projectPath),
        projectPath,
        version: '1.0.0',
        generator: 'testbot-mcp',
      },
      stats: {
        total: testResults.total || 0,
        passed: testResults.passed || 0,
        failed: testResults.failed || 0,
        skipped: testResults.skipped || 0,
        duration: testResults.duration || 0,
        passRate: testResults.total > 0
          ? Math.round((testResults.passed / testResults.total) * 100)
          : 0,
      },
      tests: this.buildTestsList(testResults, aiAnalysis, jiraData),
      aiSummary: aiAnalysis ? this.buildAISummary(aiAnalysis) : null,
      jiraSummary: jiraData ? this.buildJiraSummary(jiraData) : null,
    };

    // Save report
    const reportFilename = `report-${timestamp.replace(/[:.]/g, '-')}.json`;
    const reportPath = path.join(reportsDir, reportFilename);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    // Also save as latest.json for easy access
    const latestPath = path.join(reportsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf-8');

    console.error(`[Report] Saved: ${reportPath}`);
    console.error(`[Report] Latest: ${latestPath}`);

    // Copy artifacts if present
    await this.copyArtifacts(testResults, reportsDir);

    return {
      path: reportPath,
      latestPath,
      url: `file://${reportPath}`,
    };
  }

  /**
   * Build tests list with AI analysis and Jira data merged
   */
  buildTestsList(testResults, aiAnalysis, jiraData) {
    const tests = testResults.tests || [];

    return tests.map((test) => {
      const testObj = {
        id: test.id,
        title: test.title,
        suite: test.suite,
        file: test.file,
        status: this.normalizeStatus(test.status),
        duration: test.duration,
        error: test.error,
        retries: test.retries || 0,
        attachments: {
          screenshots: test.artifacts?.screenshots || [],
          videos: test.artifacts?.videos || [],
          traces: test.artifacts?.traces || [],
          other: [],
        },
      };

      // Merge AI analysis if available
      if (aiAnalysis) {
        const analysis = aiAnalysis.find(
          (a) => a.testName === test.title || a.failure?.testName === test.title
        );
        if (analysis) {
          testObj.aiAnalysis = {
            analysis: analysis.analysis,
            rootCause: analysis.rootCause,
            suggestedFix: analysis.suggestedFix,
            confidence: analysis.confidence,
            affectedFiles: analysis.affectedFiles,
            testingRecommendations: analysis.testingRecommendations,
            aiProvider: 'testbot',
            model: 'sarvam-m',
          };
        }
      }

      // Merge Jira data if available
      if (jiraData) {
        // Try to match by file name pattern (e.g., mscship_1.spec.js -> MSCSHIP-1)
        const jiraMatch = test.file?.match(/([a-z]+)[_-]?(\d+)/i);
        if (jiraMatch) {
          const storyKey = `${jiraMatch[1].toUpperCase()}-${jiraMatch[2]}`;
          const story = jiraData.find((s) => s.key === storyKey);
          if (story) {
            testObj.jiraStory = {
              key: story.key,
              summary: story.summary,
              status: story.status,
              priority: story.priority,
            };
          }
        }
      }

      return testObj;
    });
  }

  /**
   * Build AI analysis summary
   */
  buildAISummary(aiAnalysis) {
    const total = aiAnalysis.length;
    const highConfidence = aiAnalysis.filter((a) => a.confidence >= 0.8).length;
    const mediumConfidence = aiAnalysis.filter((a) => a.confidence >= 0.5 && a.confidence < 0.8).length;
    const lowConfidence = aiAnalysis.filter((a) => a.confidence < 0.5).length;

    return {
      total,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      analyses: aiAnalysis.map((a) => ({
        testName: a.testName || a.failure?.testName,
        file: a.file || a.failure?.file,
        analysis: a.analysis,
        confidence: a.confidence,
      })),
    };
  }

  /**
   * Build Jira summary
   */
  buildJiraSummary(jiraData) {
    return {
      total: jiraData.length,
      stories: jiraData.map((s) => ({
        key: s.key,
        summary: s.summary,
        status: s.status,
        acceptanceCriteria: s.acceptanceCriteria?.length || 0,
      })),
    };
  }

  /**
   * Copy test artifacts to report directory
   */
  async copyArtifacts(testResults, reportsDir) {
    const artifactsDir = path.join(reportsDir, 'artifacts');

    const failures = testResults.failures || [];
    let artifactsCopied = 0;

    for (const failure of failures) {
      const artifacts = failure.artifacts || {};

      // Copy screenshots
      for (const screenshot of artifacts.screenshots || []) {
        if (screenshot.path && fs.existsSync(screenshot.path)) {
          const destDir = path.join(artifactsDir, 'screenshots');
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const destPath = path.join(destDir, path.basename(screenshot.path));
          try {
            fs.copyFileSync(screenshot.path, destPath);
            artifactsCopied++;
          } catch (error) {
            console.error(`[Report] Failed to copy screenshot: ${error.message}`);
          }
        }
      }

      // Copy videos
      for (const video of artifacts.videos || []) {
        if (video.path && fs.existsSync(video.path)) {
          const destDir = path.join(artifactsDir, 'videos');
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const destPath = path.join(destDir, path.basename(video.path));
          try {
            fs.copyFileSync(video.path, destPath);
            artifactsCopied++;
          } catch (error) {
            console.error(`[Report] Failed to copy video: ${error.message}`);
          }
        }
      }

      // Copy traces
      for (const trace of artifacts.traces || []) {
        if (trace.path && fs.existsSync(trace.path)) {
          const destDir = path.join(artifactsDir, 'traces');
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const destPath = path.join(destDir, path.basename(trace.path));
          try {
            fs.copyFileSync(trace.path, destPath);
            artifactsCopied++;
          } catch (error) {
            console.error(`[Report] Failed to copy trace: ${error.message}`);
          }
        }
      }
    }

    if (artifactsCopied > 0) {
      console.error(`[Report] Copied ${artifactsCopied} artifacts`);
    }
  }

  /**
   * Normalize test status
   */
  normalizeStatus(status) {
    if (!status) return 'unknown';
    const normalized = status.toLowerCase();
    if (normalized === 'expected') return 'passed';
    if (normalized === 'unexpected') return 'failed';
    if (normalized === 'pending') return 'skipped';
    return normalized;
  }
}

module.exports = ReportGenerator;
