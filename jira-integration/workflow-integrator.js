const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class WorkflowIntegrator {
  constructor(config) {
    this.config = config;
    this.projectRoot = process.cwd();
  }

  async runPlaywrightTests(options = {}) {
    console.log('\n🎭 Running Playwright tests...\n');
    
    const testDir = options.testDir || 'tests/jira-generated';
    const fullTestPath = path.join(this.projectRoot, testDir);
    
    if (!fs.existsSync(fullTestPath)) {
      console.log(`⚠️  Test directory not found: ${fullTestPath}`);
      return {
        success: false,
        error: 'Test directory not found'
      };
    }

    try {
      const command = `npx playwright test ${testDir} --reporter=json,html,list`;
      console.log(`Executing: ${command}\n`);
      
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'inherit'
      });

      return {
        success: true,
        output
      };
    } catch (error) {
      console.error('❌ Tests failed:', error.message);
      return {
        success: false,
        error: error.message,
        exitCode: error.status
      };
    }
  }

  async triggerExistingWorkflow(changes) {
    console.log('\n🔄 Triggering existing AI workflow...\n');
    
    try {
      // Run the existing workflow script
      const workflowScript = path.join(this.projectRoot, 'scripts', 'run-complete-workflow.js');
      
      if (!fs.existsSync(workflowScript)) {
        console.log('⚠️  Workflow script not found, running tests only');
        return await this.runPlaywrightTests();
      }

      console.log('Executing complete workflow...\n');
      
      const command = 'node scripts/run-complete-workflow.js';
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'inherit'
      });

      return {
        success: true,
        output,
        workflowExecuted: true
      };
    } catch (error) {
      console.error('❌ Workflow execution failed:', error.message);
      return {
        success: false,
        error: error.message,
        exitCode: error.status
      };
    }
  }

  async runAIAgent(testResults) {
    console.log('\n🤖 Running AI Agent for error analysis and fixes...\n');
    
    try {
      const aiAgentScript = path.join(this.projectRoot, 'ai-agent', 'index.js');
      
      if (!fs.existsSync(aiAgentScript)) {
        console.log('⚠️  AI Agent not found');
        return {
          success: false,
          error: 'AI Agent script not found'
        };
      }

      const command = 'node ai-agent/index.js';
      console.log(`Executing: ${command}\n`);
      
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'inherit'
      });

      return {
        success: true,
        output,
        aiAgentExecuted: true
      };
    } catch (error) {
      console.error('❌ AI Agent execution failed:', error.message);
      return {
        success: false,
        error: error.message,
        exitCode: error.status
      };
    }
  }

  async buildDashboard() {
    console.log('\n📊 Building test dashboard...\n');
    
    try {
      const dashboardScript = path.join(this.projectRoot, 'scripts', 'build-dashboard.js');
      
      if (!fs.existsSync(dashboardScript)) {
        console.log('⚠️  Dashboard script not found');
        return {
          success: false,
          error: 'Dashboard script not found'
        };
      }

      const command = 'node scripts/build-dashboard.js';
      console.log(`Executing: ${command}\n`);
      
      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        stdio: 'inherit'
      });

      return {
        success: true,
        output
      };
    } catch (error) {
      console.error('❌ Dashboard build failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async executeFullRegressionCycle(changes) {
    console.log('\n🚀 Starting Full Regression Cycle\n');
    console.log('═'.repeat(60));
    
    const results = {
      timestamp: new Date().toISOString(),
      changes,
      steps: []
    };

    // Step 1: Run Playwright tests
    console.log('\n📍 Step 1: Running Playwright Tests');
    const testResults = await this.runPlaywrightTests({ testDir: 'tests' });
    results.steps.push({
      step: 'playwright_tests',
      success: testResults.success,
      details: testResults
    });

    // Step 2: Run AI Agent if tests failed
    if (!testResults.success && this.config.runAIAgentOnFailure) {
      console.log('\n📍 Step 2: Running AI Agent for Error Analysis');
      const aiResults = await this.runAIAgent(testResults);
      results.steps.push({
        step: 'ai_agent',
        success: aiResults.success,
        details: aiResults
      });

      // Step 3: Re-run tests after AI fixes
      if (aiResults.success && this.config.retestAfterAIFixes) {
        console.log('\n📍 Step 3: Re-running Tests After AI Fixes');
        const retestResults = await this.runPlaywrightTests({ testDir: 'tests' });
        results.steps.push({
          step: 'retest',
          success: retestResults.success,
          details: retestResults
        });
      }
    }

    // Step 4: Build dashboard
    if (this.config.buildDashboard) {
      console.log('\n📍 Step 4: Building Dashboard');
      const dashboardResults = await this.buildDashboard();
      results.steps.push({
        step: 'dashboard',
        success: dashboardResults.success,
        details: dashboardResults
      });
    }

    // Save results
    await this.saveRegressionResults(results);

    console.log('\n═'.repeat(60));
    console.log('✅ Regression Cycle Complete\n');

    return results;
  }

  async saveRegressionResults(results) {
    const resultsDir = path.join(this.projectRoot, 'jira-integration', 'regression-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `regression-${timestamp}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n💾 Regression results saved: ${filepath}`);

    // Also save as latest
    const latestPath = path.join(resultsDir, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(results, null, 2), 'utf-8');
  }

  async schedulePeriodicCheck(intervalMinutes = 30) {
    console.log(`\n⏰ Scheduling periodic Jira checks every ${intervalMinutes} minutes`);
    
    const JiraClient = require('./jira-client');
    const TestGenerator = require('./test-generator');
    const ChangeDetector = require('./change-detector');
    
    const jiraClient = new JiraClient(this.config);
    const testGenerator = new TestGenerator(this.config);
    const changeDetector = new ChangeDetector(jiraClient, testGenerator, this.config);

    const checkAndRun = async () => {
      console.log(`\n🔔 [${new Date().toISOString()}] Running scheduled Jira check...`);
      
      try {
        const changes = await changeDetector.detectAndProcessChanges();
        
        const hasChanges = changes.new.length > 0 || 
                          changes.updated.length > 0 || 
                          changes.deleted.length > 0;

        if (hasChanges) {
          console.log('\n✨ Changes detected, triggering regression cycle...');
          await this.executeFullRegressionCycle(changes);
        } else {
          console.log('\n✅ No changes detected');
        }
      } catch (error) {
        console.error('\n❌ Scheduled check failed:', error.message);
      }
    };

    // Run immediately
    await checkAndRun();

    // Schedule periodic checks
    setInterval(checkAndRun, intervalMinutes * 60 * 1000);
  }
}

module.exports = WorkflowIntegrator;
