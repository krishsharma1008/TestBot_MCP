#!/usr/bin/env node

/**
 * Complete Jira-Integrated Testing Workflow
 * 
 * This script runs the complete workflow:
 * 1. Run Playwright tests
 * 2. Enrich dashboard with Jira data
 * 3. Update Jira board based on test results
 * 4. Build dashboard
 * 5. Run AI agent if tests fail (optional)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const options = {
    skipTests: args.includes('--skip-tests'),
    skipAI: args.includes('--skip-ai'),
    updateJira: !args.includes('--no-jira-update'),
    dryRun: args.includes('--dry-run')
  };

  console.log('\n🚀 Complete Jira-Integrated Testing Workflow\n');
  console.log('═'.repeat(70));

  const results = {
    timestamp: new Date().toISOString(),
    steps: [],
    success: false
  };

  try {
    // Step 1: Run Playwright tests
    if (!options.skipTests) {
      console.log('\n📍 Step 1: Running Playwright Tests');
      console.log('─'.repeat(70));
      
      try {
        execSync('npx playwright test', {
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        results.steps.push({ step: 'tests', success: true });
        console.log('\n✅ All tests passed');
      } catch (error) {
        results.steps.push({ step: 'tests', success: false, exitCode: error.status });
        console.log('\n⚠️  Some tests failed');
      }
    } else {
      console.log('\n⏭️  Step 1: Skipped (--skip-tests)');
    }

    // Step 2: Enrich dashboard with Jira data
    console.log('\n📍 Step 2: Enriching Dashboard with Jira Data');
    console.log('─'.repeat(70));
    
    try {
      const enrichCmd = options.updateJira 
        ? 'node scripts/enrich-dashboard-with-jira.js'
        : 'node scripts/enrich-dashboard-with-jira.js --no-update';
      
      execSync(enrichCmd, {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      results.steps.push({ step: 'jira_enrichment', success: true });
      console.log('\n✅ Dashboard enriched with Jira data');
    } catch (error) {
      results.steps.push({ step: 'jira_enrichment', success: false, error: error.message });
      console.error('\n❌ Failed to enrich dashboard:', error.message);
    }

    // Step 3: Build dashboard
    console.log('\n📍 Step 3: Building Dashboard');
    console.log('─'.repeat(70));
    
    try {
      execSync('node scripts/build-dashboard.js', {
        cwd: process.cwd(),
        stdio: 'inherit'
      });
      results.steps.push({ step: 'dashboard_build', success: true });
      console.log('\n✅ Dashboard built successfully');
    } catch (error) {
      results.steps.push({ step: 'dashboard_build', success: false, error: error.message });
      console.error('\n❌ Failed to build dashboard:', error.message);
    }

    // Step 4: Run AI agent if tests failed and not skipped
    const testsFailed = results.steps.find(s => s.step === 'tests' && !s.success);
    if (testsFailed && !options.skipAI) {
      console.log('\n📍 Step 4: Running AI Agent for Error Analysis');
      console.log('─'.repeat(70));
      
      try {
        execSync('node ai-agent/index.js', {
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        results.steps.push({ step: 'ai_agent', success: true });
        console.log('\n✅ AI agent completed');
      } catch (error) {
        results.steps.push({ step: 'ai_agent', success: false, error: error.message });
        console.error('\n❌ AI agent failed:', error.message);
      }
    } else if (options.skipAI) {
      console.log('\n⏭️  Step 4: Skipped AI agent (--skip-ai)');
    } else {
      console.log('\n⏭️  Step 4: Skipped AI agent (tests passed)');
    }

    // Print summary
    console.log('\n═'.repeat(70));
    console.log('📊 WORKFLOW SUMMARY');
    console.log('═'.repeat(70));
    
    results.steps.forEach(step => {
      const icon = step.success ? '✅' : '❌';
      const status = step.success ? 'SUCCESS' : 'FAILED';
      console.log(`${icon} ${step.step.toUpperCase()}: ${status}`);
    });

    console.log('═'.repeat(70));
    console.log('\n📂 Generated Files:');
    console.log('   - custom-report/index.html (Dashboard)');
    console.log('   - custom-report/jira-enriched-data.json (Jira data)');
    console.log('   - custom-report/jira-board-view.json (Board view)');
    console.log('\n💡 Open custom-report/index.html to view the dashboard');
    console.log('═'.repeat(70));
    console.log('');

    results.success = results.steps.every(s => s.success);
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
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
