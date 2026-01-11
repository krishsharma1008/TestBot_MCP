#!/usr/bin/env node

/**
 * Enrich Dashboard with Jira Data
 * 
 * This script:
 * 1. Maps tests to Jira stories
 * 2. Fetches Jira story details
 * 3. Analyzes test results by story
 * 4. Updates Jira board based on test results
 * 5. Generates enriched data for dashboard
 */

const DashboardEnricher = require('../jira-integration/dashboard-enricher');
const JiraBoardUpdater = require('../jira-integration/jira-board-updater');
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const options = {
    updateJira: !args.includes('--no-update'),
    dryRun: args.includes('--dry-run')
  };

  console.log('\n🎯 Jira Dashboard Enrichment\n');
  console.log('═'.repeat(60));

  // Load configuration
  const config = {
    jiraBaseUrl: process.env.JIRA_BASE_URL,
    jiraEmail: process.env.JIRA_EMAIL,
    jiraApiToken: process.env.JIRA_API_TOKEN,
    jiraProjectKey: process.env.JIRA_PROJECT_KEY,
    addCommentOnTransition: true
  };

  // Validate configuration
  if (!config.jiraBaseUrl || !config.jiraEmail || !config.jiraApiToken || !config.jiraProjectKey) {
    console.error('\n❌ Missing Jira configuration. Please set environment variables:');
    console.error('   JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY\n');
    process.exit(1);
  }

  const testResultsPath = path.join(process.cwd(), 'test-results.json');
  const enrichedDataPath = path.join(process.cwd(), 'custom-report', 'jira-enriched-data.json');

  // Check if test results exist
  if (!fs.existsSync(testResultsPath)) {
    console.error('\n❌ test-results.json not found. Please run tests first.\n');
    process.exit(1);
  }

  try {
    // Step 1: Enrich dashboard data
    console.log('\n📊 Step 1: Enriching dashboard data...');
    const enricher = new DashboardEnricher(config);
    const enrichedData = await enricher.enrichDashboardData(testResultsPath, enrichedDataPath);

    console.log(`\n✅ Enriched ${enrichedData.stories.length} stories with test data`);

    // Step 2: Generate board view
    console.log('\n📋 Step 2: Generating Jira board view...');
    const boardView = enricher.generateJiraBoardView(enrichedData);
    
    console.log(`\n📊 Board Status:`);
    console.log(`   To Do: ${boardView.todo.length} stories`);
    console.log(`   In Progress: ${boardView.inProgress.length} stories`);
    console.log(`   Done: ${boardView.done.length} stories`);

    // Save board view
    const boardViewPath = path.join(process.cwd(), 'custom-report', 'jira-board-view.json');
    fs.writeFileSync(boardViewPath, JSON.stringify(boardView, null, 2), 'utf-8');
    console.log(`\n✅ Saved board view to ${boardViewPath}`);

    // Step 3: Update Jira board (if enabled)
    if (options.updateJira) {
      console.log('\n🔄 Step 3: Updating Jira board...');
      const boardUpdater = new JiraBoardUpdater(config);
      
      // Analyze test results
      const storyResults = await boardUpdater.analyzeTestResults(testResultsPath);
      
      // Update board
      const updates = await boardUpdater.updateJiraBoard(storyResults, { dryRun: options.dryRun });
      
      boardUpdater.printSummary(updates);
    } else {
      console.log('\n⏭️  Step 3: Skipped Jira board update (--no-update flag)');
    }

    // Step 4: Print summary
    console.log('\n═'.repeat(60));
    console.log('✨ Dashboard enrichment complete!');
    console.log('\n📂 Generated files:');
    console.log(`   - ${enrichedDataPath}`);
    console.log(`   - ${boardViewPath}`);
    console.log('\n💡 Run "npm run dashboard:build" to rebuild the dashboard');
    console.log('═'.repeat(60));
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = main;
