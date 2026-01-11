const JiraClient = require('./jira-client');
const JiraTestMapper = require('./jira-test-mapper');
const fs = require('fs');
const path = require('path');

/**
 * Updates Jira board based on test results
 * - Failing tests → Move story to "In Progress"
 * - Passing tests → Move story to "Done"
 * - New/Untested → Keep in "To Do"
 */
class JiraBoardUpdater {
  constructor(config) {
    this.config = config;
    this.jiraClient = new JiraClient(config);
    this.testMapper = new JiraTestMapper();
    this.transitionCache = new Map();
  }

  /**
   * Analyze test results and determine story statuses
   */
  async analyzeTestResults(testResultsPath) {
    console.log('\n📊 Analyzing test results for Jira board update...\n');

    // Load test results
    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf-8'));

    // Map tests to stories
    const mapping = this.testMapper.mapTestResults(testResults);

    // Aggregate results by story
    const storyResults = await this.aggregateResultsByStory(testResults, mapping);

    return storyResults;
  }

  /**
   * Aggregate test results by story
   */
  async aggregateResultsByStory(testResults, mapping) {
    const storyResults = {};

    // Initialize all mapped stories
    Object.keys(mapping.storyToTests).forEach(storyKey => {
      storyResults[storyKey] = {
        key: storyKey,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        tests: [],
        recommendedStatus: null,
        currentStatus: null
      };
    });

    // Process test results
    testResults.suites.forEach(suite => {
      this.processSuiteResults(suite, storyResults, mapping);
    });

    // Determine recommended status for each story
    for (const storyKey in storyResults) {
      const result = storyResults[storyKey];
      
      if (result.totalTests === 0) {
        result.recommendedStatus = 'To Do';
      } else if (result.failedTests > 0) {
        result.recommendedStatus = 'In Progress';
      } else if (result.passedTests === result.totalTests) {
        result.recommendedStatus = 'Done';
      } else {
        result.recommendedStatus = 'In Progress';
      }

      // Fetch current status from Jira
      try {
        const issue = await this.jiraClient.getIssue(storyKey);
        result.currentStatus = issue.fields.status.name;
        result.summary = issue.fields.summary;
      } catch (error) {
        console.warn(`  ⚠️  Could not fetch status for ${storyKey}:`, error.message);
      }
    }

    return storyResults;
  }

  processSuiteResults(suite, storyResults, mapping, parentSuiteName = '') {
    const suiteName = parentSuiteName ? `${parentSuiteName} › ${suite.title}` : suite.title;

    if (suite.specs && suite.specs.length > 0) {
      suite.specs.forEach(spec => {
        this.processSpecResults(spec, suiteName, storyResults, mapping);
      });
    }

    if (suite.suites && suite.suites.length > 0) {
      suite.suites.forEach(nestedSuite => {
        this.processSuiteResults(nestedSuite, storyResults, mapping, suiteName);
      });
    }
  }

  processSpecResults(spec, suiteName, storyResults, mapping) {
    const tests = spec.tests || [];

    tests.forEach(test => {
      const testTitle = test.title || spec.title;
      const testId = `${suiteName}-${testTitle}`.replace(/\s+/g, '-').toLowerCase();
      const storyKey = mapping.testToStory[testId];

      if (storyKey && storyResults[storyKey]) {
        const results = test.results || [];
        const lastResult = results[results.length - 1];

        if (lastResult) {
          const status = this.normalizeStatus(lastResult.status);
          
          storyResults[storyKey].totalTests++;
          storyResults[storyKey].tests.push({
            id: testId,
            title: testTitle,
            status: status,
            duration: lastResult.duration || 0
          });

          if (status === 'passed') {
            storyResults[storyKey].passedTests++;
          } else if (status === 'failed') {
            storyResults[storyKey].failedTests++;
          } else if (status === 'skipped') {
            storyResults[storyKey].skippedTests++;
          }
        }
      }
    });
  }

  normalizeStatus(status) {
    if (!status) return 'unknown';
    const normalized = status.toLowerCase();
    if (normalized === 'expected') return 'passed';
    if (normalized === 'unexpected') return 'failed';
    if (normalized === 'pending') return 'skipped';
    return normalized;
  }

  /**
   * Get available transitions for a story
   */
  async getAvailableTransitions(storyKey) {
    if (this.transitionCache.has(storyKey)) {
      return this.transitionCache.get(storyKey);
    }

    try {
      const transitions = await this.jiraClient.makeRequest(`issue/${storyKey}/transitions`);
      this.transitionCache.set(storyKey, transitions.transitions || []);
      return transitions.transitions || [];
    } catch (error) {
      console.error(`Failed to get transitions for ${storyKey}:`, error.message);
      return [];
    }
  }

  /**
   * Find transition ID for target status
   */
  async findTransitionId(storyKey, targetStatus) {
    const transitions = await this.getAvailableTransitions(storyKey);
    
    // Try exact match first
    let transition = transitions.find(t => 
      t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    // Try partial match
    if (!transition) {
      transition = transitions.find(t => 
        t.to.name.toLowerCase().includes(targetStatus.toLowerCase()) ||
        targetStatus.toLowerCase().includes(t.to.name.toLowerCase())
      );
    }

    return transition ? transition.id : null;
  }

  /**
   * Update Jira board based on test results
   */
  async updateJiraBoard(storyResults, options = {}) {
    console.log('\n🔄 Updating Jira board based on test results...\n');

    const updates = {
      updated: [],
      skipped: [],
      failed: []
    };

    for (const storyKey in storyResults) {
      const result = storyResults[storyKey];
      
      // Skip if no status change needed
      if (result.currentStatus === result.recommendedStatus) {
        console.log(`  ✓ ${storyKey}: Already in "${result.currentStatus}"`);
        updates.skipped.push({
          key: storyKey,
          status: result.currentStatus,
          reason: 'No change needed'
        });
        continue;
      }

      // Skip if dry run
      if (options.dryRun) {
        console.log(`  🔍 ${storyKey}: Would move from "${result.currentStatus}" → "${result.recommendedStatus}"`);
        updates.skipped.push({
          key: storyKey,
          from: result.currentStatus,
          to: result.recommendedStatus,
          reason: 'Dry run'
        });
        continue;
      }

      // Perform transition
      try {
        const transitionId = await this.findTransitionId(storyKey, result.recommendedStatus);
        
        if (!transitionId) {
          console.log(`  ⚠️  ${storyKey}: No transition available to "${result.recommendedStatus}"`);
          updates.skipped.push({
            key: storyKey,
            from: result.currentStatus,
            to: result.recommendedStatus,
            reason: 'No transition available'
          });
          continue;
        }

        await this.transitionStory(storyKey, transitionId, result);
        
        console.log(`  ✅ ${storyKey}: Moved from "${result.currentStatus}" → "${result.recommendedStatus}"`);
        updates.updated.push({
          key: storyKey,
          from: result.currentStatus,
          to: result.recommendedStatus,
          testsPassed: result.passedTests,
          testsFailed: result.failedTests,
          testsTotal: result.totalTests
        });

      } catch (error) {
        console.error(`  ❌ ${storyKey}: Failed to update -`, error.message);
        updates.failed.push({
          key: storyKey,
          error: error.message
        });
      }
    }

    // Save update log
    await this.saveUpdateLog(updates);

    return updates;
  }

  /**
   * Transition a story to new status
   */
  async transitionStory(storyKey, transitionId, testResult) {
    const payload = {
      transition: {
        id: transitionId
      }
    };

    // Add comment with test results
    if (this.config.addCommentOnTransition !== false) {
      const comment = this.generateTestResultComment(testResult);
      payload.update = {
        comment: [{
          add: {
            body: comment
          }
        }]
      };
    }

    await this.jiraClient.makeRequest(`issue/${storyKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Generate comment with test results
   */
  generateTestResultComment(testResult) {
    const passRate = testResult.totalTests > 0 
      ? Math.round((testResult.passedTests / testResult.totalTests) * 100)
      : 0;

    let comment = `*Automated Test Results Update*\n\n`;
    comment += `Total Tests: ${testResult.totalTests}\n`;
    comment += `✅ Passed: ${testResult.passedTests}\n`;
    comment += `❌ Failed: ${testResult.failedTests}\n`;
    comment += `⏭️ Skipped: ${testResult.skippedTests}\n`;
    comment += `📊 Pass Rate: ${passRate}%\n\n`;

    if (testResult.failedTests > 0) {
      comment += `*Failed Tests:*\n`;
      testResult.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          comment += `- ${t.title}\n`;
        });
    }

    comment += `\n_Updated automatically by test automation system_`;

    return comment;
  }

  /**
   * Save update log
   */
  async saveUpdateLog(updates) {
    const logDir = path.join(process.cwd(), '.jira-cache');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      summary: {
        updated: updates.updated.length,
        skipped: updates.skipped.length,
        failed: updates.failed.length
      },
      details: updates
    };

    // Append to log file
    const logPath = path.join(logDir, 'board-update-log.json');
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
    }

    logs.unshift(logEntry);
    
    // Keep only last 50 entries
    if (logs.length > 50) {
      logs = logs.slice(0, 50);
    }

    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');
  }

  /**
   * Print summary
   */
  printSummary(updates) {
    console.log('\n═'.repeat(60));
    console.log('📊 JIRA BOARD UPDATE SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Updated: ${updates.updated.length}`);
    console.log(`⏭️  Skipped: ${updates.skipped.length}`);
    console.log(`❌ Failed: ${updates.failed.length}`);
    console.log('═'.repeat(60));
  }
}

module.exports = JiraBoardUpdater;
