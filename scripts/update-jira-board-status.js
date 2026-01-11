#!/usr/bin/env node

/**
 * Update Jira Board Status Based on Test Results
 * 
 * Logic:
 * - All tests pass → Move to "Done"
 * - Any tests fail → Move to "In Progress"
 * - No tests generated → Keep in "To Do"
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;

// Jira status IDs (these may vary by project - adjust if needed)
const STATUS_TRANSITIONS = {
  'To Do': '11',      // Transition ID to move to "To Do"
  'In Progress': '21', // Transition ID to move to "In Progress"
  'Done': '31'        // Transition ID to move to "Done"
};

class JiraBoardUpdater {
  constructor() {
    this.baseUrl = JIRA_BASE_URL;
    this.email = JIRA_EMAIL;
    this.apiToken = JIRA_API_TOKEN;
    this.projectKey = JIRA_PROJECT_KEY;
  }

  getAuthHeader() {
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');
    return `Basic ${auth}`;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}/rest/api/3/${endpoint}`;
    const headers = {
      'Authorization': this.getAuthHeader(),
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error (${response.status}): ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true };
    }

    return await response.json();
  }

  /**
   * Analyze test results and group by Jira story
   */
  analyzeTestResults() {
    const testResultsPath = path.join(process.cwd(), 'test-results.json');
    
    if (!fs.existsSync(testResultsPath)) {
      console.log('⚠️  No test results found');
      return {};
    }

    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
    const storyResults = {};

    // Parse all test suites
    if (testResults.suites) {
      this.parseSuites(testResults.suites, storyResults);
    }

    return storyResults;
  }

  parseSuites(suites, storyResults) {
    suites.forEach(suite => {
      // Parse specs in this suite
      if (suite.specs) {
        suite.specs.forEach(spec => {
          // Extract Jira story key from file path
          // e.g., tests/jira-generated/mscship_15.spec.js -> MSCSHIP-15
          const match = spec.file.match(/mscship[_-]?(\d+)/i);
          if (match) {
            const storyKey = `MSCSHIP-${match[1]}`;
            
            if (!storyResults[storyKey]) {
              storyResults[storyKey] = {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0
              };
            }

            // Analyze test results
            if (spec.tests) {
              spec.tests.forEach(test => {
                const results = test.results || [];
                const lastResult = results[results.length - 1];
                
                if (lastResult) {
                  storyResults[storyKey].total++;
                  
                  const status = lastResult.status;
                  if (status === 'passed' || status === 'expected') {
                    storyResults[storyKey].passed++;
                  } else if (status === 'failed' || status === 'unexpected') {
                    storyResults[storyKey].failed++;
                  } else if (status === 'skipped' || status === 'pending') {
                    storyResults[storyKey].skipped++;
                  }
                }
              });
            }
          }
        });
      }

      // Parse nested suites
      if (suite.suites) {
        this.parseSuites(suite.suites, storyResults);
      }
    });
  }

  /**
   * Determine target status based on test results
   */
  determineTargetStatus(storyKey, results) {
    if (!results || results.total === 0) {
      // No tests generated
      return 'To Do';
    }

    if (results.failed > 0) {
      // Any tests failed
      return 'In Progress';
    }

    if (results.passed === results.total) {
      // All tests passed
      return 'Done';
    }

    // Default: some tests skipped but none failed
    return 'In Progress';
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey) {
    try {
      const data = await this.makeRequest(`issue/${issueKey}/transitions`);
      return data.transitions || [];
    } catch (error) {
      console.error(`Failed to get transitions for ${issueKey}:`, error.message);
      return [];
    }
  }

  /**
   * Get current issue status
   */
  async getIssueStatus(issueKey) {
    try {
      const data = await this.makeRequest(`issue/${issueKey}?fields=status`);
      return data.fields.status.name;
    } catch (error) {
      console.error(`Failed to get status for ${issueKey}:`, error.message);
      return null;
    }
  }

  /**
   * Transition issue to target status
   */
  async transitionIssue(issueKey, targetStatus) {
    try {
      // Get current status
      const currentStatus = await this.getIssueStatus(issueKey);
      
      if (currentStatus === targetStatus) {
        console.log(`  ℹ️  ${issueKey} already in "${targetStatus}"`);
        return true;
      }

      // Get available transitions
      const transitions = await this.getTransitions(issueKey);
      
      // Find transition to target status
      const transition = transitions.find(t => t.to.name === targetStatus);
      
      if (!transition) {
        console.log(`  ⚠️  No transition available from "${currentStatus}" to "${targetStatus}" for ${issueKey}`);
        console.log(`     Available transitions: ${transitions.map(t => t.to.name).join(', ')}`);
        return false;
      }

      // Execute transition
      await this.makeRequest(`issue/${issueKey}/transitions`, {
        method: 'POST',
        body: JSON.stringify({
          transition: {
            id: transition.id
          }
        })
      });

      console.log(`  ✅ ${issueKey}: "${currentStatus}" → "${targetStatus}"`);
      return true;
    } catch (error) {
      console.error(`  ❌ Failed to transition ${issueKey}:`, error.message);
      return false;
    }
  }

  /**
   * Update all Jira stories based on test results
   */
  async updateJiraBoard() {
    console.log('\n📊 Analyzing test results...\n');
    
    const storyResults = this.analyzeTestResults();
    const storyKeys = Object.keys(storyResults);

    if (storyKeys.length === 0) {
      console.log('⚠️  No Jira stories found in test results');
      return;
    }

    console.log(`Found ${storyKeys.length} stories with test results\n`);

    const updates = {
      'To Do': [],
      'In Progress': [],
      'Done': []
    };

    // Determine target status for each story
    for (const storyKey of storyKeys) {
      const results = storyResults[storyKey];
      const targetStatus = this.determineTargetStatus(storyKey, results);
      
      updates[targetStatus].push({
        key: storyKey,
        results
      });
    }

    // Display summary
    console.log('📋 Update Summary:\n');
    console.log(`  To Do: ${updates['To Do'].length} stories (no tests generated)`);
    console.log(`  In Progress: ${updates['In Progress'].length} stories (tests failing)`);
    console.log(`  Done: ${updates['Done'].length} stories (all tests passing)`);
    console.log('');

    // Update each story
    let successCount = 0;
    let failCount = 0;

    for (const [targetStatus, stories] of Object.entries(updates)) {
      if (stories.length === 0) continue;

      console.log(`\n🔄 Moving to "${targetStatus}":\n`);
      
      for (const story of stories) {
        const { key, results } = story;
        console.log(`  ${key} (${results.passed}/${results.total} passed)`);
        
        const success = await this.transitionIssue(key, targetStatus);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Updated: ${successCount} stories`);
    if (failCount > 0) {
      console.log(`⚠️  Failed: ${failCount} stories`);
    }
    console.log('');
  }
}

// Run if called directly
if (require.main === module) {
  const updater = new JiraBoardUpdater();
  updater.updateJiraBoard()
    .then(() => {
      console.log('✅ Jira board update complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error updating Jira board:', error);
      process.exit(1);
    });
}

module.exports = { JiraBoardUpdater };
