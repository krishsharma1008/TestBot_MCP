#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const JiraClient = require('./jira-client');
const TestGenerator = require('./test-generator');
const ChangeDetector = require('./change-detector');
const WorkflowIntegrator = require('./workflow-integrator');
const fs = require('fs');
const path = require('path');

class JiraIntegration {
  constructor(config) {
    this.config = this.loadConfig(config);
    this.jiraClient = new JiraClient(this.config);
    this.testGenerator = new TestGenerator(this.config);
    this.changeDetector = new ChangeDetector(
      this.jiraClient,
      this.testGenerator,
      this.config
    );
    this.workflowIntegrator = new WorkflowIntegrator(this.config);
  }

  loadConfig(customConfig = {}) {
    const configPath = path.join(process.cwd(), 'jira-integration.config.js');
    let fileConfig = {};

    if (fs.existsSync(configPath)) {
      fileConfig = require(configPath);
      console.log('✅ Loaded Jira integration configuration');
    }

    return {
      jiraBaseUrl: process.env.JIRA_BASE_URL || fileConfig.jiraBaseUrl,
      jiraEmail: process.env.JIRA_EMAIL || fileConfig.jiraEmail,
      jiraApiToken: process.env.JIRA_API_TOKEN || fileConfig.jiraApiToken,
      jiraProjectKey: process.env.JIRA_PROJECT_KEY || fileConfig.jiraProjectKey,
      useAI: fileConfig.useAI !== undefined ? fileConfig.useAI : false,
      alwaysUpdateTests: fileConfig.alwaysUpdateTests !== undefined ? fileConfig.alwaysUpdateTests : false,
      deleteTestsForDeletedStories: fileConfig.deleteTestsForDeletedStories !== undefined ? fileConfig.deleteTestsForDeletedStories : false,
      archiveCompletedTests: fileConfig.archiveCompletedTests !== undefined ? fileConfig.archiveCompletedTests : true,
      ensureTestsForActiveStories: fileConfig.ensureTestsForActiveStories !== undefined ? fileConfig.ensureTestsForActiveStories : true,
      runAIAgentOnFailure: fileConfig.runAIAgentOnFailure !== undefined ? fileConfig.runAIAgentOnFailure : true,
      retestAfterAIFixes: fileConfig.retestAfterAIFixes !== undefined ? fileConfig.retestAfterAIFixes : true,
      buildDashboard: fileConfig.buildDashboard !== undefined ? fileConfig.buildDashboard : true,
      ...customConfig
    };
  }

  async run(options = {}) {
    console.log('\n🎯 Jira Integration - Regression Testing Automation\n');
    console.log('═'.repeat(60));

    try {
      this.validateConfig();

      if (options.init) {
        return await this.initialize();
      }

      if (options.sync) {
        return await this.syncAllStories();
      }

      if (options.watch) {
        return await this.watchMode(options.interval);
      }

      if (options.story) {
        return await this.processSpecificStory(options.story);
      }

      // Default: detect changes and run regression
      return await this.detectAndRun();

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      throw error;
    }
  }

  validateConfig() {
    const required = ['jiraBaseUrl', 'jiraEmail', 'jiraApiToken', 'jiraProjectKey'];
    const missing = required.filter(key => !this.config[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}\nPlease set environment variables or create jira-integration.config.js`);
    }
  }

  async initialize() {
    console.log('\n🔧 Initializing Jira Integration...\n');

    // Test Jira connection
    console.log('Testing Jira connection...');
    const project = await this.jiraClient.getProject();
    console.log(`✅ Connected to project: ${project.name} (${project.key})`);

    // Fetch initial stories
    console.log('\nFetching user stories...');
    const stories = await this.jiraClient.getUserStories();
    console.log(`✅ Found ${stories.length} user stories`);

    // Cache initial state
    await this.jiraClient.saveCache(stories, 'issues-cache.json');
    console.log('✅ Cached initial state');

    console.log('\n✨ Initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run jira:sync - to generate tests for all stories');
    console.log('2. Run: npm run jira:detect - to detect changes and run regression');
    console.log('3. Run: npm run jira:watch - to continuously monitor for changes');

    return { success: true, storiesFound: stories.length };
  }

  async syncAllStories() {
    console.log('\n🔄 Syncing all user stories...\n');

    const stories = await this.jiraClient.getUserStories();
    console.log(`Found ${stories.length} user stories\n`);

    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const story of stories) {
      try {
        console.log(`\nProcessing: ${story.key} - ${story.fields.summary}`);
        const storyDetails = await this.jiraClient.getStoryDetails(story.key);

        if (storyDetails.acceptanceCriteria.length === 0) {
          console.log('  ⚠️  No acceptance criteria, skipping');
          skipped++;
          continue;
        }

        await this.testGenerator.generateTestsFromStory(storyDetails);
        generated++;

      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }

    console.log('\n═'.repeat(60));
    console.log('📊 Sync Summary:');
    console.log(`  ✅ Generated: ${generated}`);
    console.log(`  ⚠️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    
    // Cleanup test files for Done stories
    console.log('\n🧹 Cleaning up test files for Done stories...');
    try {
      const { cleanupDoneTests } = require('../scripts/cleanup-done-tests');
      await cleanupDoneTests();
    } catch (error) {
      console.log('  ⚠️  Cleanup skipped:', error.message);
    }

    return { success: true, generated, skipped, errors };
  }

  async detectAndRun() {
    console.log('\n🔍 Detecting changes and running regression...\n');

    // Detect changes
    const changes = await this.changeDetector.detectAndProcessChanges();

    const hasChanges = changes.new.length > 0 || 
                      changes.updated.length > 0 || 
                      changes.deleted.length > 0;

    if (!hasChanges) {
      console.log('\n✅ No changes detected. All tests are up to date.');
      return { success: true, changes, testsRun: false };
    }

    console.log('\n📊 Change Summary:');
    console.log(`  ➕ New stories: ${changes.new.length}`);
    console.log(`  🔄 Updated stories: ${changes.updated.length}`);
    console.log(`  📊 Status changes: ${changes.statusChanged.length}`);
    console.log(`  🗑️  Deleted stories: ${changes.deleted.length}`);
    console.log(`  📝 Tests generated: ${changes.testsGenerated}`);
    console.log(`  🔄 Tests updated: ${changes.testsUpdated}`);
    console.log(`  🗑️  Tests deleted: ${changes.testsDeleted}`);

    // Run regression cycle
    const regressionResults = await this.workflowIntegrator.executeFullRegressionCycle(changes);

    return {
      success: true,
      changes,
      regressionResults,
      testsRun: true
    };
  }

  async processSpecificStory(storyKey) {
    console.log(`\n📝 Processing specific story: ${storyKey}\n`);

    const storyDetails = await this.jiraClient.getStoryDetails(storyKey);
    console.log(`Story: ${storyDetails.summary}`);
    console.log(`Status: ${storyDetails.status}`);
    console.log(`Acceptance Criteria: ${storyDetails.acceptanceCriteria.length}`);

    if (storyDetails.acceptanceCriteria.length === 0) {
      console.log('\n⚠️  No acceptance criteria found');
      return { success: false, reason: 'No acceptance criteria' };
    }

    const result = await this.testGenerator.generateTestsFromStory(storyDetails);

    console.log(`\n✅ Test generated: ${result.filepath}`);
    console.log(`Scenarios: ${result.scenarios}`);

    return { success: true, result };
  }

  async watchMode(intervalMinutes = 30) {
    console.log(`\n👁️  Watch mode: Monitoring Jira every ${intervalMinutes} minutes\n`);
    console.log('Press Ctrl+C to stop\n');

    await this.workflowIntegrator.schedulePeriodicCheck(intervalMinutes);

    // Keep process alive
    return new Promise(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const integration = new JiraIntegration();

  try {
    const result = await integration.run(options);
    
    if (result.success) {
      console.log('\n✅ Completed successfully');
      process.exit(0);
    } else {
      console.log('\n⚠️  Completed with warnings');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--init':
        options.init = true;
        break;
      case '--sync':
        options.sync = true;
        break;
      case '--watch':
        options.watch = true;
        break;
      case '--interval':
        options.interval = parseInt(args[++i]);
        break;
      case '--story':
        options.story = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🎯 Jira Integration - Automated Regression Testing

USAGE:
  node jira-integration/index.js [options]

OPTIONS:
  --init                     Initialize Jira integration and test connection
  --sync                     Sync all user stories and generate tests
  --watch                    Watch mode - continuously monitor for changes
  --interval <minutes>       Check interval for watch mode (default: 30)
  --story <key>              Process a specific story (e.g., PROJ-123)
  --help, -h                 Show this help message

ENVIRONMENT VARIABLES:
  JIRA_BASE_URL              Jira instance URL (e.g., https://yourcompany.atlassian.net)
  JIRA_EMAIL                 Your Jira email
  JIRA_API_TOKEN             Jira API token
  JIRA_PROJECT_KEY           Project key (e.g., PROJ)

EXAMPLES:
  # Initialize and test connection
  npm run jira:init

  # Sync all stories and generate tests
  npm run jira:sync

  # Detect changes and run regression
  npm run jira:detect

  # Watch mode (check every 15 minutes)
  npm run jira:watch -- --interval 15

  # Process specific story
  npm run jira:story -- --story PROJ-123

CONFIGURATION:
  Create a jira-integration.config.js file for advanced settings.
  See jira-integration.config.example.js for details.

For more information, see JIRA_INTEGRATION_README.md
`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = JiraIntegration;
