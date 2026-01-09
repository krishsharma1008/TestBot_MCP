#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Complete Workflow Starting...\n');
console.log('═'.repeat(80));

const steps = {
  startProject: false,
  runTests: false,
  generateDashboard: false,
  analyzeErrors: false,
  applyFixes: false,
  createPR: false
};

async function runWorkflow() {
  try {
    // Step 1: Start the project
    console.log('\n📋 Step 1: Starting the project...');
    console.log('─'.repeat(80));
    
    const serverProcess = startProjectServer();
    steps.startProject = true;
    console.log('✅ Project server started');
    
    // Wait for server to be ready
    await waitForServer('http://localhost:8000', 30000);
    console.log('✅ Server is ready');
    
    // Auto-launch website in browser
    console.log('🌐 Opening website in browser...');
    await openInBrowser('http://localhost:8000');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for browser to open
    
    // Step 2: Run tests
    console.log('\n📋 Step 2: Running tests...');
    console.log('─'.repeat(80));
    
    const testResults = runTests();
    steps.runTests = true;
    
    if (testResults.allPassed) {
      console.log('✅ All tests passed! No fixes needed.');
      
      // Generate dashboard anyway
      console.log('\n📋 Step 3: Generating test dashboard...');
      console.log('─'.repeat(80));
      execSync('node scripts/build-dashboard.js', { stdio: 'inherit' });
      console.log('✅ Dashboard generated');
      
      // Start dashboard server
      dashboardServer = await startDashboardServer();
      console.log('📊 Opening test dashboard in browser...');
      await openInBrowser('http://localhost:3000');
      
      // Summary
      console.log('\n' + '═'.repeat(80));
      console.log('✅ All Tests Passed!');
      console.log('═'.repeat(80));
      console.log('\n📊 Servers Running:');
      console.log('   🌐 Website: http://localhost:8000');
      console.log('   📊 Dashboard: http://localhost:3000');
      console.log('\n' + '─'.repeat(80));
      console.log('⏸️  Servers are running. Press ENTER to stop servers and exit...');
      console.log('─'.repeat(80));
      
      await waitForUserInput();
      
      console.log('\n📋 Cleaning up...');
      serverProcess.kill();
      if (dashboardServer) {
        dashboardServer.kill();
      }
      console.log('✅ Servers stopped');
      
      return { success: true, message: 'All tests passed' };
    }
    
    console.log(`⚠️  Found ${testResults.failureCount} test failure(s)`);
    
    // Step 3: Analyze errors with AI (BEFORE dashboard generation)
    console.log('\n📋 Step 3: Analyzing errors with AI...');
    console.log('─'.repeat(80));
    
    const analysisResults = await analyzeWithAI();
    steps.analyzeErrors = true;
    
    if (!analysisResults || !analysisResults.hasErrors) {
      console.log('✅ No actionable errors found');
      serverProcess.kill();
      return { success: true, message: 'No errors to fix' };
    }
    
    console.log(`✅ Analyzed ${analysisResults.analysisResults?.length || 0} error(s)`);
    
    // Step 4: Generate dashboard (AFTER AI analysis)
    console.log('\n📋 Step 4: Generating test dashboard with AI analysis...');
    console.log('─'.repeat(80));
    
    execSync('node scripts/build-dashboard.js', { stdio: 'inherit' });
    steps.generateDashboard = true;
    console.log('✅ Dashboard generated with AI insights');
    
    // Start live server for dashboard
    dashboardServer = await startDashboardServer();
    console.log('📊 Opening test dashboard in browser...');
    await openInBrowser('http://localhost:3000');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for browser to open
    
    // Start fix application server
    console.log('\n📋 Step 5: Starting Fix Application Server...');
    console.log('─'.repeat(80));
    
    const fixServerProcess = startFixApplicationServer();
    console.log('✅ Fix Application Server started on http://localhost:3001');
    console.log('   Ready to receive fix requests from dashboard');
    
    // NOTE: Steps 5-7 are now triggered manually from the dashboard
    // by clicking "Apply Fix" button on each AI analysis card
    
    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Workflow Part 1 Complete - Ready for Manual Fix Application');
    console.log('═'.repeat(80));
    console.log('\nSummary:');
    console.log(`  Tests Run: ${testResults.totalTests}`);
    console.log(`  Failures Found: ${testResults.failureCount}`);
    console.log(`  AI Analyses Generated: ${analysisResults.analysisResults?.length || 0}`);
    console.log('\n📊 Servers Running:');
    console.log('   🌐 Website: http://localhost:8000');
    console.log('   📊 Dashboard: http://localhost:3000');
    console.log('   🔧 Fix Application Server: http://localhost:3001');
    console.log('\n💡 Next Steps:');
    console.log('   1. Review AI analysis on the dashboard');
    console.log('   2. Click "Apply Fix" button on any test to trigger fix application');
    console.log('   3. The fix will be applied, verified, and a PR will be created');
    console.log('\n' + '─'.repeat(80));
    console.log('⏸️  Servers are running. Press ENTER to stop all servers and exit...');
    console.log('─'.repeat(80));
    
    await waitForUserInput();
    
    // Cleanup
    console.log('\n📋 Cleaning up...');
    serverProcess.kill();
    if (dashboardServer) {
      dashboardServer.kill();
    }
    console.log('✅ Servers stopped');
    
    return { success: true, results: { testResults, analysisResults, fixResults, prResults } };
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

function waitForUserInput() {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.on('line', () => {
      rl.close();
      resolve();
    });
  });
}

async function openInBrowser(url) {
  const { exec } = require('child_process');
  const command = process.platform === 'win32' ? 'start' : 
                  process.platform === 'darwin' ? 'open' : 'xdg-open';
  
  exec(`${command} ${url}`, (error) => {
    if (error) {
      console.log(`   ℹ️  Could not auto-open browser. Please visit: ${url}`);
    }
  });
}

async function startDashboardServer() {
  console.log('Starting dashboard server on port 3000...');
  
  const http = require('http');
  const dashboardDir = path.join(process.cwd(), 'custom-report');
  
  const server = http.createServer((req, res) => {
    let filePath = path.join(dashboardDir, req.url === '/' ? 'index.html' : req.url);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(dashboardDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    const extname = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    const contentType = contentTypes[extname] || 'text/plain';
    
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error: ' + error.code);
        }
      } else {
        res.writeHead(200, { 
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content, 'utf-8');
      }
    });
  });
  
  server.listen(3000);
  
  // Return a mock process object with kill method
  return {
    kill: () => {
      server.close();
      console.log('✅ Dashboard server stopped');
    }
  };
}

function startProjectServer() {
  console.log('Starting PHP server on port 8000...');
  
  const isWindows = process.platform === 'win32';
  const phpPath = 'php';
  const docRoot = path.join(process.cwd(), 'website', 'public');
  
  const serverProcess = spawn(phpPath, ['-S', 'localhost:8000', '-t', docRoot], {
    detached: false,
    stdio: 'ignore'
  });
  
  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error.message);
  });
  
  return serverProcess;
}

function startFixApplicationServer() {
  console.log('Starting Fix Application Server on port 3001...');
  
  const serverPath = path.join(__dirname, 'fix-application-server.js');
  
  const serverProcess = spawn('node', [serverPath], {
    detached: false,
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  serverProcess.on('error', (error) => {
    console.error('Failed to start Fix Application Server:', error.message);
  });
  
  return serverProcess;
}

async function waitForServer(url, timeout = 30000) {
  const startTime = Date.now();
  const fetch = (await import('node-fetch')).default;
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Server failed to start within timeout');
}

function runTests() {
  console.log('Running Playwright tests...');
  
  try {
    execSync('npx playwright test', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    // Even if tests pass, check the results file
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const counts = countTestResults(results);
      return {
        allPassed: counts.failureCount === 0,
        failureCount: counts.failureCount,
        totalTests: counts.totalTests
      };
    }
    
    return {
      allPassed: true,
      failureCount: 0,
      totalTests: 0
    };
  } catch (error) {
    // Tests failed, parse results
    const resultsPath = path.join(process.cwd(), 'test-results.json');
    
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const counts = countTestResults(results);
      
      return {
        allPassed: false,
        failureCount: counts.failureCount,
        totalTests: counts.totalTests
      };
    }
    
    return {
      allPassed: false,
      failureCount: 1,
      totalTests: 1
    };
  }
}

function countTestResults(results) {
  // Use the stats object which has accurate counts
  if (results.stats) {
    return {
      totalTests: results.stats.expected + results.stats.unexpected + results.stats.skipped,
      failureCount: results.stats.unexpected + results.stats.flaky
    };
  }
  
  // Fallback to manual counting if stats not available
  let totalTests = 0;
  let failureCount = 0;
  
  const countTests = (suites) => {
    for (const suite of suites) {
      if (suite.tests) {
        for (const test of suite.tests) {
          totalTests++;
          // Check test status - "unexpected" means failed
          if (test.status === 'unexpected' || test.status === 'flaky') {
            failureCount++;
          }
          // Also check results array
          else if (test.results && test.results.length > 0) {
            const hasFailure = test.results.some(result => 
              result.status === 'failed' || 
              result.status === 'timedOut' ||
              result.status === 'interrupted'
            );
            if (hasFailure) {
              failureCount++;
            }
          }
        }
      }
      if (suite.suites) {
        countTests(suite.suites);
      }
    }
  };
  
  if (results.suites) {
    countTests(results.suites);
  }
  
  return { totalTests, failureCount };
}

function generateDashboard() {
  console.log('Building custom dashboard...');
  
  try {
    execSync('node scripts/build-dashboard.js', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.warn('Dashboard generation failed:', error.message);
  }
}

async function analyzeWithAI() {
  console.log('Running AI Agent for error analysis...');
  
  const AIAgentOrchestrator = require('../ai-agent/orchestrator');
  const config = loadConfig();
  
  const orchestrator = new AIAgentOrchestrator({
    ...config,
    createPR: false, // We'll create PR separately
    autoCommit: false
  });
  
  // Run just the analysis part
  const testResults = orchestrator.loadTestResults();
  if (!testResults) {
    return { hasErrors: false };
  }
  
  const analysisResults = await orchestrator.errorAnalyzer.analyzeTestFailures(testResults);
  
  // Save analysis for dashboard consumption
  if (analysisResults && analysisResults.hasErrors) {
    orchestrator.errorAnalyzer.saveAnalysisForDashboard(analysisResults);
  }
  
  return analysisResults;
}

async function applyFixes(analysisResults) {
  console.log('Applying fixes...');
  
  const CodeFixer = require('../ai-agent/code-fixer');
  const config = loadConfig();
  
  const fixer = new CodeFixer({
    dryRun: false,
    createBackup: true,
    autoCommit: false
  });
  
  const fixResults = await fixer.applyFixes(analysisResults);
  
  return fixResults;
}

async function createPR(analysisResults, fixResults) {
  console.log('Creating Pull Request...');
  
  const GitHubPRCreator = require('../ai-agent/github-pr-creator');
  const config = loadConfig();
  
  if (!config.githubToken) {
    console.log('⚠️  No GitHub token configured, skipping PR creation');
    return { success: false, message: 'No GitHub token' };
  }
  
  const prCreator = new GitHubPRCreator(config);
  
  try {
    const prResults = await prCreator.createPR(analysisResults, fixResults);
    return prResults;
  } catch (error) {
    console.error('Failed to create PR:', error.message);
    return { success: false, error: error.message };
  }
}

function loadConfig() {
  const configPath = path.join(process.cwd(), 'ai-agent.config.js');
  
  if (fs.existsSync(configPath)) {
    return require(configPath);
  }
  
  return {
    aiProvider: process.env.AI_PROVIDER || 'sarvam',
    autoAnalyze: true, // Enable automated AI analysis
    apiKey: process.env.SARVAM_API_KEY || process.env.AI_API_KEY,
    model: process.env.AI_MODEL || 'sarvam-m',
    githubToken: process.env.GITHUB_TOKEN
  };
}

// Run the workflow
if (require.main === module) {
  runWorkflow()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ Workflow completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Workflow failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runWorkflow };
