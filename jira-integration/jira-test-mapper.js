const fs = require('fs');
const path = require('path');

/**
 * Maps Playwright tests to Jira stories
 * Extracts story keys from test files and creates bidirectional mapping
 */
class JiraTestMapper {
  constructor() {
    this.mappingCache = path.join(process.cwd(), '.jira-cache', 'test-story-mapping.json');
    this.mapping = this.loadMapping();
  }

  loadMapping() {
    if (fs.existsSync(this.mappingCache)) {
      try {
        return JSON.parse(fs.readFileSync(this.mappingCache, 'utf-8'));
      } catch (error) {
        console.warn('Failed to load test-story mapping:', error.message);
      }
    }
    return {
      testToStory: {},    // testId -> storyKey
      storyToTests: {},   // storyKey -> [testIds]
      lastUpdated: null
    };
  }

  saveMapping() {
    const dir = path.dirname(this.mappingCache);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.mapping.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.mappingCache, JSON.stringify(this.mapping, null, 2), 'utf-8');
  }

  /**
   * Extract Jira story key from test file
   * Looks for patterns like MSCSHIP-1, PROJ-123 in:
   * - Test file name
   * - Test describe block
   * - Test title
   * - Comments
   */
  extractStoryKeyFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Pattern to match Jira issue keys (PROJECT-NUMBER)
    const jiraKeyPattern = /([A-Z]{2,10}-\d+)/g;
    
    // Check filename first
    const filename = path.basename(filePath);
    const filenameMatch = filename.match(jiraKeyPattern);
    if (filenameMatch) {
      return filenameMatch[0];
    }

    // Check content
    const contentMatches = content.match(jiraKeyPattern);
    if (contentMatches && contentMatches.length > 0) {
      // Return the first match (usually in describe block)
      return contentMatches[0];
    }

    return null;
  }

  /**
   * Extract story key from test title or description
   */
  extractStoryKeyFromTest(testTitle, testFile, testSuite) {
    // Check test title
    const jiraKeyPattern = /([A-Z]{2,10}-\d+)/;
    
    const titleMatch = testTitle.match(jiraKeyPattern);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Check suite name
    if (testSuite) {
      const suiteMatch = testSuite.match(jiraKeyPattern);
      if (suiteMatch) {
        return suiteMatch[1];
      }
    }

    // Check file
    if (testFile) {
      return this.extractStoryKeyFromFile(testFile);
    }

    return null;
  }

  /**
   * Map test results to Jira stories
   */
  mapTestResults(testResults) {
    const mapping = {
      testToStory: {},
      storyToTests: {}
    };

    if (!testResults || !testResults.suites) {
      return mapping;
    }

    // Process all test suites
    testResults.suites.forEach(suite => {
      this.processSuite(suite, mapping);
    });

    // Update cache
    this.mapping.testToStory = { ...this.mapping.testToStory, ...mapping.testToStory };
    this.mapping.storyToTests = { ...this.mapping.storyToTests, ...mapping.storyToTests };
    this.saveMapping();

    return mapping;
  }

  processSuite(suite, mapping, parentSuiteName = '') {
    const suiteName = parentSuiteName ? `${parentSuiteName} › ${suite.title}` : suite.title;

    // Process specs in this suite
    if (suite.specs && suite.specs.length > 0) {
      suite.specs.forEach(spec => {
        this.processSpec(spec, suiteName, mapping);
      });
    }

    // Process nested suites
    if (suite.suites && suite.suites.length > 0) {
      suite.suites.forEach(nestedSuite => {
        this.processSuite(nestedSuite, mapping, suiteName);
      });
    }
  }

  processSpec(spec, suiteName, mapping) {
    const tests = spec.tests || [];
    
    tests.forEach(test => {
      const testTitle = test.title || spec.title;
      const testFile = spec.file || '';
      const testId = `${suiteName}-${testTitle}`.replace(/\s+/g, '-').toLowerCase();

      // Extract story key
      const storyKey = this.extractStoryKeyFromTest(testTitle, testFile, suiteName);

      if (storyKey) {
        // Map test to story
        mapping.testToStory[testId] = storyKey;

        // Map story to tests
        if (!mapping.storyToTests[storyKey]) {
          mapping.storyToTests[storyKey] = [];
        }
        if (!mapping.storyToTests[storyKey].includes(testId)) {
          mapping.storyToTests[storyKey].push(testId);
        }
      }
    });
  }

  /**
   * Get story key for a test
   */
  getStoryForTest(testId) {
    return this.mapping.testToStory[testId] || null;
  }

  /**
   * Get all tests for a story
   */
  getTestsForStory(storyKey) {
    return this.mapping.storyToTests[storyKey] || [];
  }

  /**
   * Get all mapped stories
   */
  getAllStories() {
    return Object.keys(this.mapping.storyToTests);
  }

  /**
   * Create enriched test results with Jira story information
   */
  enrichTestResults(testResults, jiraStories) {
    if (!testResults || !testResults.suites) {
      return testResults;
    }

    // Create story map for quick lookup
    const storyMap = new Map();
    if (jiraStories && Array.isArray(jiraStories)) {
      jiraStories.forEach(story => {
        storyMap.set(story.key, story);
      });
    }

    // Enrich each test with Jira info
    const enriched = JSON.parse(JSON.stringify(testResults));
    
    enriched.suites.forEach(suite => {
      this.enrichSuite(suite, storyMap);
    });

    return enriched;
  }

  enrichSuite(suite, storyMap) {
    if (suite.specs && suite.specs.length > 0) {
      suite.specs.forEach(spec => {
        this.enrichSpec(spec, storyMap);
      });
    }

    if (suite.suites && suite.suites.length > 0) {
      suite.suites.forEach(nestedSuite => {
        this.enrichSuite(nestedSuite, storyMap);
      });
    }
  }

  enrichSpec(spec, storyMap) {
    const tests = spec.tests || [];
    
    tests.forEach(test => {
      const testTitle = test.title || spec.title;
      const testFile = spec.file || '';
      const suiteName = spec.titlePath ? spec.titlePath.join(' › ') : '';
      const testId = `${suiteName}-${testTitle}`.replace(/\s+/g, '-').toLowerCase();

      const storyKey = this.getStoryForTest(testId);
      
      if (storyKey && storyMap.has(storyKey)) {
        const story = storyMap.get(storyKey);
        test.jiraStory = {
          key: story.key,
          summary: story.fields?.summary || story.summary,
          status: story.fields?.status?.name || story.status,
          priority: story.fields?.priority?.name || story.priority,
          url: `${process.env.JIRA_BASE_URL}/browse/${story.key}`
        };
      }
    });
  }

  /**
   * Generate test-to-story mapping report
   */
  generateMappingReport() {
    const report = {
      totalTests: Object.keys(this.mapping.testToStory).length,
      totalStories: Object.keys(this.mapping.storyToTests).length,
      unmappedTests: [],
      storyCoverage: {}
    };

    // Calculate coverage per story
    Object.entries(this.mapping.storyToTests).forEach(([storyKey, testIds]) => {
      report.storyCoverage[storyKey] = {
        testCount: testIds.length,
        tests: testIds
      };
    });

    return report;
  }
}

module.exports = JiraTestMapper;
