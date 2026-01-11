#!/usr/bin/env node

/**
 * Complete Jira-based Regression Workflow
 * 
 * This script orchestrates the full regression cycle:
 * 1. Detect Jira changes
 * 2. Generate/update tests
 * 3. Run Playwright tests
 * 4. Analyze failures with AI
 * 5. Apply fixes
 * 6. Re-run tests
 * 7. Build dashboard
 */

const JiraIntegration = require('../jira-integration');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class JiraRegressionWorkflow {
  constructor(options = {}) {
    this.options = {
      skipAI: options.skipAI || false,
      noPR: options.noPR || false,
      dryRun: options.dryRun || false,
      ...options
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      steps: [],
      success: false
    };
  }

  async run() {
    console.log('\n🚀 Jira Regression Workflow Starting...\n');
    console.log('═'.repeat(70));
    
    try {
      // Step 1: Detect Jira Changes
      await this.detectJiraChanges();
      
      // Step 2: Run Tests
      await this.runTests();
      
      // Step 3: Analyze and Fix (if needed)
      if (!this.results.steps[1].success && !this.options.skipAI) {
        await this.runAIAnalysis();
        await this.retestAfterFixes();
      }
      
      // Step 4: Build Dashboard
      await this.buildDashboard();
      
      // Step 5: Generate Report
      await this.generateReport();
      
      this.results.success = true;
      console.log('\n✅ Workflow completed successfully!\n');
      
    } catch (error) {
      console.error('\n❌ Workflow failed:', error.message);
      this.results.error = error.message;
      this.results.success = false;
    }
    
    return this.results;
  }

  async detectJiraChanges() {
    console.log('\n📍 Step 1: Detecting Jira Changes');
    console.log('─'.repeat(70));
    
    const stepResult = {
      step: 'jira_detection',
      startTime: new Date().toISOString(),
      success: false
    };
    
    try {
      const integration = new JiraIntegration();
      const result = await integration.run({});
      
      stepResult.success = true;
      stepResult.changes = result.changes;
      stepResult.testsGenerated = result.changes?.testsGenerated || 0;
      stepResult.testsUpdated = result.changes?.testsUpdated || 0;
      
      console.log('\n✅ Jira changes detected and processed');
      console.log(`   New stories: ${result.changes?.new?.length || 0}`);
      console.log(`   Updated stories: ${result.changes?.updated?.length || 0}`);
      console.log(`   Tests generated: ${stepResult.testsGenerated}`);
      console.log(`   Tests updated: ${stepResult.testsUpdated}`);
      
    } catch (error) {
      console.error('\n❌ Jira detection failed:', error.message);
      stepResult.error = error.message;
      stepResult.success = false;
    }
    
    stepResult.endTime = new Date().toISOString();
    this.results.steps.push(stepResult);
  }

  async runTests() {
    console.log('\n📍 Step 2: Running Playwright Tests');
    console.log('─'.repeat(70));
    
    const stepResult = {
      step: 'playwright_tests',
      startTime: new Date().toISOString(),
      success: false
    };
    
    try {
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN: Skipping test execution');
        stepResult.success = true;
        stepResult.dryRun = true;
      } else {
        console.log('\nExecuting: npx playwright test\n');
        
        try {
          execSync('npx playwright test', {
            cwd: process.cwd(),
            stdio: 'inherit'
          });
          
          stepResult.success = true;
          console.log('\n✅ All tests passed');
          
        } catch (error) {
          stepResult.success = false;
          stepResult.exitCode = error.status;
          console.log('\n⚠️  Some tests failed');
        }
        
        // Parse test results
        const resultsPath = path.join(process.cwd(), 'test-results.json');
        if (fs.existsSync(resultsPath)) {
          const testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
          stepResult.testResults = {
            total: testResults.suites?.reduce((sum, s) => sum + (s.specs?.length || 0), 0) || 0,
            passed: testResults.suites?.reduce((sum, s) => 
              sum + (s.specs?.filter(spec => spec.ok).length || 0), 0) || 0,
            failed: testResults.suites?.reduce((sum, s) => 
              sum + (s.specs?.filter(spec => !spec.ok).length || 0), 0) || 0
          };
        }
      }
      
    } catch (error) {
      console.error('\n❌ Test execution failed:', error.message);
      stepResult.error = error.message;
      stepResult.success = false;
    }
    
    stepResult.endTime = new Date().toISOString();
    this.results.steps.push(stepResult);
  }

  async runAIAnalysis() {
    console.log('\n📍 Step 3: AI Analysis and Fixes');
    console.log('─'.repeat(70));
    
    const stepResult = {
      step: 'ai_analysis',
      startTime: new Date().toISOString(),
      success: false
    };
    
    try {
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN: Skipping AI analysis');
        stepResult.success = true;
        stepResult.dryRun = true;
      } else {
        const command = this.options.noPR 
          ? 'node ai-agent/index.js --no-pr'
          : 'node ai-agent/index.js';
        
        console.log(`\nExecuting: ${command}\n`);
        
        execSync(command, {
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        
        stepResult.success = true;
        console.log('\n✅ AI analysis completed');
      }
      
    } catch (error) {
      console.error('\n❌ AI analysis failed:', error.message);
      stepResult.error = error.message;
      stepResult.success = false;
    }
    
    stepResult.endTime = new Date().toISOString();
    this.results.steps.push(stepResult);
  }

  async retestAfterFixes() {
    console.log('\n📍 Step 4: Re-testing After AI Fixes');
    console.log('─'.repeat(70));
    
    const stepResult = {
      step: 'retest',
      startTime: new Date().toISOString(),
      success: false
    };
    
    try {
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN: Skipping retest');
        stepResult.success = true;
        stepResult.dryRun = true;
      } else {
        console.log('\nExecuting: npx playwright test\n');
        
        try {
          execSync('npx playwright test', {
            cwd: process.cwd(),
            stdio: 'inherit'
          });
          
          stepResult.success = true;
          console.log('\n✅ All tests passed after fixes');
          
        } catch (error) {
          stepResult.success = false;
          stepResult.exitCode = error.status;
          console.log('\n⚠️  Some tests still failing');
        }
      }
      
    } catch (error) {
      console.error('\n❌ Retest failed:', error.message);
      stepResult.error = error.message;
      stepResult.success = false;
    }
    
    stepResult.endTime = new Date().toISOString();
    this.results.steps.push(stepResult);
  }

  async buildDashboard() {
    console.log('\n📍 Step 5: Building Dashboard');
    console.log('─'.repeat(70));
    
    const stepResult = {
      step: 'dashboard',
      startTime: new Date().toISOString(),
      success: false
    };
    
    try {
      if (this.options.dryRun) {
        console.log('🔍 DRY RUN: Skipping dashboard build');
        stepResult.success = true;
        stepResult.dryRun = true;
      } else {
        const dashboardScript = path.join(process.cwd(), 'scripts', 'build-dashboard.js');
        
        if (fs.existsSync(dashboardScript)) {
          console.log('\nExecuting: node scripts/build-dashboard.js\n');
          
          execSync('node scripts/build-dashboard.js', {
            cwd: process.cwd(),
            stdio: 'inherit'
          });
          
          stepResult.success = true;
          console.log('\n✅ Dashboard built successfully');
        } else {
          console.log('⚠️  Dashboard script not found, skipping');
          stepResult.success = true;
          stepResult.skipped = true;
        }
      }
      
    } catch (error) {
      console.error('\n❌ Dashboard build failed:', error.message);
      stepResult.error = error.message;
      stepResult.success = false;
    }
    
    stepResult.endTime = new Date().toISOString();
    this.results.steps.push(stepResult);
  }

  async generateReport() {
    console.log('\n📍 Step 6: Generating Workflow Report');
    console.log('─'.repeat(70));
    
    const reportDir = path.join(process.cwd(), 'jira-integration', 'workflow-reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `workflow-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2), 'utf-8');
    
    const latestPath = path.join(reportDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(this.results, null, 2), 'utf-8');
    
    console.log(`\n💾 Report saved: ${reportPath}`);
    
    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n═'.repeat(70));
    console.log('📊 WORKFLOW SUMMARY');
    console.log('═'.repeat(70));
    
    for (const step of this.results.steps) {
      const icon = step.success ? '✅' : '❌';
      const status = step.success ? 'SUCCESS' : 'FAILED';
      console.log(`${icon} ${step.step.toUpperCase()}: ${status}`);
      
      if (step.changes) {
        console.log(`   - New stories: ${step.changes.new?.length || 0}`);
        console.log(`   - Updated stories: ${step.changes.updated?.length || 0}`);
        console.log(`   - Tests generated: ${step.testsGenerated || 0}`);
        console.log(`   - Tests updated: ${step.testsUpdated || 0}`);
      }
      
      if (step.testResults) {
        console.log(`   - Total tests: ${step.testResults.total}`);
        console.log(`   - Passed: ${step.testResults.passed}`);
        console.log(`   - Failed: ${step.testResults.failed}`);
      }
      
      if (step.error) {
        console.log(`   - Error: ${step.error}`);
      }
    }
    
    console.log('═'.repeat(70));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    skipAI: args.includes('--skip-ai'),
    noPR: args.includes('--no-pr'),
    dryRun: args.includes('--dry-run')
  };
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const workflow = new JiraRegressionWorkflow(options);
  const results = await workflow.run();
  
  process.exit(results.success ? 0 : 1);
}

function showHelp() {
  console.log(`
🚀 Jira Regression Workflow

USAGE:
  node scripts/jira-regression-workflow.js [options]

OPTIONS:
  --skip-ai      Skip AI analysis even if tests fail
  --no-pr        Don't create Pull Request for fixes
  --dry-run      Run without making actual changes
  --help, -h     Show this help message

WORKFLOW STEPS:
  1. Detect Jira changes and update tests
  2. Run Playwright tests
  3. Analyze failures with AI (if tests fail)
  4. Re-run tests after fixes
  5. Build test dashboard
  6. Generate workflow report

EXAMPLES:
  # Full workflow
  node scripts/jira-regression-workflow.js

  # Skip AI analysis
  node scripts/jira-regression-workflow.js --skip-ai

  # Dry run (no changes)
  node scripts/jira-regression-workflow.js --dry-run

  # No PR creation
  node scripts/jira-regression-workflow.js --no-pr
`);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = JiraRegressionWorkflow;
