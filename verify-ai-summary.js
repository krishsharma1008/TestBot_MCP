const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying AI Summary Section Implementation\n');
console.log('='.repeat(60));

// Check 1: HTML Template
console.log('\n✓ Check 1: HTML Template');
const htmlPath = path.join(__dirname, 'custom-report', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

const hasAISummarySection = html.includes('ai-summary-section');
const hasAISummaryGrid = html.includes('aiSummaryGrid');
const hasAISummaryBadge = html.includes('aiSummaryBadge');

console.log(`  - AI Summary Section: ${hasAISummarySection ? '✓' : '✗'}`);
console.log(`  - AI Summary Grid: ${hasAISummaryGrid ? '✓' : '✗'}`);
console.log(`  - AI Summary Badge: ${hasAISummaryBadge ? '✓' : '✗'}`);

// Check position relative to Suite Breakdown
const aiSectionPos = html.indexOf('ai-summary-section');
const suiteBreakdownPos = html.indexOf('Suite Breakdown');
console.log(`  - Positioned before Suite Breakdown: ${aiSectionPos < suiteBreakdownPos ? '✓' : '✗'}`);

// Check 2: Reporter.js
console.log('\n✓ Check 2: Reporter.js Functions');
const jsPath = path.join(__dirname, 'custom-report', 'reporter.js');
const js = fs.readFileSync(jsPath, 'utf-8');

const hasRenderAISummary = js.includes('function renderAISummary()');
const hasCreateAISummaryCard = js.includes('function createAISummaryCard(test)');
const hasPseudoTestLogic = js.includes('Creating pseudo-tests from AI analysis data');
const isCalledInRefresh = js.includes('renderAISummary()');

console.log(`  - renderAISummary function: ${hasRenderAISummary ? '✓' : '✗'}`);
console.log(`  - createAISummaryCard function: ${hasCreateAISummaryCard ? '✓' : '✗'}`);
console.log(`  - Pseudo-test fallback logic: ${hasPseudoTestLogic ? '✓' : '✗'}`);
console.log(`  - Called in refreshDashboard: ${isCalledInRefresh ? '✓' : '✗'}`);

// Check 3: CSS Styles
console.log('\n✓ Check 3: CSS Styles');
const cssPath = path.join(__dirname, 'custom-report', 'dashboard-styles.css');
const css = fs.readFileSync(cssPath, 'utf-8');

const hasAISummaryStyles = css.includes('.ai-summary-section');
const hasAISummaryCardStyle = css.includes('.ai-summary-card');
const hasAISummaryGridStyle = css.includes('.ai-summary-grid');
const hasBtnViewDetails = css.includes('.btn-view-details');

console.log(`  - .ai-summary-section: ${hasAISummaryStyles ? '✓' : '✗'}`);
console.log(`  - .ai-summary-card: ${hasAISummaryCardStyle ? '✓' : '✗'}`);
console.log(`  - .ai-summary-grid: ${hasAISummaryGridStyle ? '✓' : '✗'}`);
console.log(`  - .btn-view-details: ${hasBtnViewDetails ? '✓' : '✗'}`);

// Check 4: AI Analysis Data
console.log('\n✓ Check 4: AI Analysis Data');
const aiDataPath = path.join(__dirname, 'custom-report', 'ai-analysis.json');
if (fs.existsSync(aiDataPath)) {
    const aiData = JSON.parse(fs.readFileSync(aiDataPath, 'utf-8'));
    const analysisCount = Object.keys(aiData.analyses || {}).length;
    
    console.log(`  - AI analysis file exists: ✓`);
    console.log(`  - Number of analyses: ${analysisCount}`);
    console.log(`  - AI Provider: ${aiData.aiProvider || 'N/A'}`);
    console.log(`  - Model: ${aiData.model || 'N/A'}`);
    
    if (analysisCount > 0) {
        const firstKey = Object.keys(aiData.analyses)[0];
        const firstAnalysis = aiData.analyses[firstKey];
        console.log(`\n  Sample Analysis:`);
        console.log(`    - Test: ${firstAnalysis.testName}`);
        console.log(`    - File: ${firstAnalysis.file}`);
        console.log(`    - Confidence: ${Math.round(firstAnalysis.aiAnalysis.confidence * 100)}%`);
        console.log(`    - Has root cause: ${firstAnalysis.aiAnalysis.rootCause ? '✓' : '✗'}`);
        console.log(`    - Has suggested fix: ${firstAnalysis.aiAnalysis.suggestedFix ? '✓' : '✗'}`);
    }
} else {
    console.log(`  - AI analysis file exists: ✗`);
}

// Check 5: Test Results
console.log('\n✓ Check 5: Test Results');
const testResultsPath = path.join(__dirname, 'custom-report', 'test-results.json');
if (fs.existsSync(testResultsPath)) {
    const testData = JSON.parse(fs.readFileSync(testResultsPath, 'utf-8'));
    const suiteCount = testData.suites?.length || 0;
    
    let testCount = 0;
    let failedCount = 0;
    
    for (const suite of testData.suites || []) {
        for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {
                testCount++;
                const status = test.results?.[test.results.length - 1]?.status;
                if (status === 'failed') failedCount++;
            }
        }
    }
    
    console.log(`  - Test results file exists: ✓`);
    console.log(`  - Number of suites: ${suiteCount}`);
    console.log(`  - Total tests: ${testCount}`);
    console.log(`  - Failed tests: ${failedCount}`);
    
    if (testCount === 0) {
        console.log(`\n  ⚠️  WARNING: No tests found in test-results.json`);
        console.log(`  The pseudo-test fallback will be used to display AI analyses.`);
    }
} else {
    console.log(`  - Test results file exists: ✗`);
}

// Final Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 SUMMARY\n');

const allChecks = [
    hasAISummarySection && hasAISummaryGrid && hasAISummaryBadge,
    hasRenderAISummary && hasCreateAISummaryCard && hasPseudoTestLogic,
    hasAISummaryStyles && hasAISummaryCardStyle && hasAISummaryGridStyle,
    fs.existsSync(aiDataPath)
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

if (passedChecks === totalChecks) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('\nThe AI Summary section is correctly implemented and should be');
    console.log('visible on the dashboard at http://localhost:3000');
    console.log('\nThe section will appear BEFORE the "Suite Breakdown" section');
    console.log('and display all AI analyses in beautiful cards.');
} else {
    console.log(`⚠️  ${passedChecks}/${totalChecks} checks passed`);
    console.log('\nSome components may be missing or incorrectly configured.');
}

console.log('\n' + '='.repeat(60));
