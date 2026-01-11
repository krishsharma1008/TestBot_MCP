const JiraClient = require('./jira-client');
const JiraTestMapper = require('./jira-test-mapper');
const JiraBoardUpdater = require('./jira-board-updater');
const fs = require('fs');
const path = require('path');

/**
 * Enriches test results with Jira story information for dashboard display
 */
class DashboardEnricher {
  constructor(config) {
    this.config = config;
    this.jiraClient = new JiraClient(config);
    this.testMapper = new JiraTestMapper();
    this.boardUpdater = new JiraBoardUpdater(config);
  }

  /**
   * Enrich test results with Jira data for dashboard
   */
  async enrichDashboardData(testResultsPath, outputPath) {
    console.log('\n📊 Enriching dashboard with Jira data...\n');

    // Load test results
    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf-8'));

    // Map tests to stories
    const mapping = this.testMapper.mapTestResults(testResults);

    // Fetch Jira stories
    const storyKeys = Object.keys(mapping.storyToTests);
    console.log(`Found ${storyKeys.length} Jira stories linked to tests`);

    const jiraStories = await this.fetchJiraStories(storyKeys);

    // Analyze test results by story
    const storyResults = await this.boardUpdater.aggregateResultsByStory(testResults, mapping);

    // Create enriched data
    const enrichedData = {
      timestamp: new Date().toISOString(),
      jiraProject: this.config.jiraProjectKey,
      jiraBaseUrl: this.config.jiraBaseUrl,
      mapping: {
        totalTests: Object.keys(mapping.testToStory).length,
        totalStories: storyKeys.length,
        testToStory: mapping.testToStory,
        storyToTests: mapping.storyToTests
      },
      stories: this.formatStoriesForDashboard(jiraStories, storyResults),
      testResults: this.enrichTestsWithStoryInfo(testResults, mapping, jiraStories)
    };

    // Save enriched data
    fs.writeFileSync(outputPath, JSON.stringify(enrichedData, null, 2), 'utf-8');
    console.log(`✅ Saved enriched data to ${outputPath}`);

    return enrichedData;
  }

  /**
   * Fetch Jira stories
   */
  async fetchJiraStories(storyKeys) {
    const stories = [];

    for (const key of storyKeys) {
      try {
        const story = await this.jiraClient.getIssue(key);
        stories.push(story);
      } catch (error) {
        console.warn(`  ⚠️  Could not fetch ${key}:`, error.message);
      }
    }

    return stories;
  }

  /**
   * Format stories for dashboard display
   */
  formatStoriesForDashboard(jiraStories, storyResults) {
    const formatted = [];

    jiraStories.forEach(story => {
      const result = storyResults[story.key] || {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        tests: []
      };

      const passRate = result.totalTests > 0 
        ? Math.round((result.passedTests / result.totalTests) * 100)
        : 0;

      formatted.push({
        key: story.key,
        summary: story.fields.summary,
        status: story.fields.status.name,
        statusCategory: story.fields.status.statusCategory?.key || 'new',
        priority: story.fields.priority?.name || 'Medium',
        assignee: story.fields.assignee ? {
          name: story.fields.assignee.displayName,
          email: story.fields.assignee.emailAddress
        } : null,
        url: `${this.config.jiraBaseUrl}/browse/${story.key}`,
        testResults: {
          total: result.totalTests,
          passed: result.passedTests,
          failed: result.failedTests,
          skipped: result.skippedTests,
          passRate: passRate,
          tests: result.tests
        },
        recommendedStatus: result.recommendedStatus || 'To Do',
        needsUpdate: story.fields.status.name !== result.recommendedStatus
      });
    });

    return formatted;
  }

  /**
   * Enrich test results with story information
   */
  enrichTestsWithStoryInfo(testResults, mapping, jiraStories) {
    const storyMap = new Map();
    jiraStories.forEach(story => {
      storyMap.set(story.key, {
        key: story.key,
        summary: story.fields.summary,
        status: story.fields.status.name,
        priority: story.fields.priority?.name || 'Medium',
        url: `${this.config.jiraBaseUrl}/browse/${story.key}`
      });
    });

    const enriched = [];

    testResults.suites.forEach(suite => {
      this.enrichSuiteTests(suite, enriched, mapping, storyMap);
    });

    return enriched;
  }

  enrichSuiteTests(suite, enriched, mapping, storyMap, parentSuiteName = '') {
    const suiteName = parentSuiteName ? `${parentSuiteName} › ${suite.title}` : suite.title;

    if (suite.specs && suite.specs.length > 0) {
      suite.specs.forEach(spec => {
        this.enrichSpecTests(spec, suiteName, enriched, mapping, storyMap);
      });
    }

    if (suite.suites && suite.suites.length > 0) {
      suite.suites.forEach(nestedSuite => {
        this.enrichSuiteTests(nestedSuite, enriched, mapping, storyMap, suiteName);
      });
    }
  }

  enrichSpecTests(spec, suiteName, enriched, mapping, storyMap) {
    const tests = spec.tests || [];

    tests.forEach(test => {
      const testTitle = test.title || spec.title;
      const testId = `${suiteName}-${testTitle}`.replace(/\s+/g, '-').toLowerCase();
      const storyKey = mapping.testToStory[testId];

      const results = test.results || [];
      const lastResult = results[results.length - 1];

      if (lastResult) {
        const enrichedTest = {
          id: testId,
          title: testTitle,
          suite: suiteName,
          file: spec.file || '',
          status: this.normalizeStatus(lastResult.status),
          duration: lastResult.duration || 0,
          error: lastResult.error ? {
            message: lastResult.error.message || '',
            stack: lastResult.error.stack || ''
          } : null,
          jiraStory: null
        };

        if (storyKey && storyMap.has(storyKey)) {
          enrichedTest.jiraStory = storyMap.get(storyKey);
        }

        enriched.push(enrichedTest);
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
   * Generate Jira board view data
   */
  generateJiraBoardView(enrichedData) {
    const boardView = {
      todo: [],
      inProgress: [],
      done: []
    };

    enrichedData.stories.forEach(story => {
      const boardItem = {
        key: story.key,
        summary: story.summary,
        status: story.status,
        priority: story.priority,
        url: story.url,
        testsPassed: story.testResults.passed,
        testsFailed: story.testResults.failed,
        testsTotal: story.testResults.total,
        passRate: story.testResults.passRate,
        needsUpdate: story.needsUpdate,
        recommendedStatus: story.recommendedStatus
      };

      // Categorize by current status
      const statusCategory = story.statusCategory || 'new';
      
      if (statusCategory === 'done') {
        boardView.done.push(boardItem);
      } else if (statusCategory === 'indeterminate' || story.status.toLowerCase().includes('progress')) {
        boardView.inProgress.push(boardItem);
      } else {
        boardView.todo.push(boardItem);
      }
    });

    return boardView;
  }
}

module.exports = DashboardEnricher;
