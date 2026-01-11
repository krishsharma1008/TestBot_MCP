const fs = require('fs');

const testData = JSON.parse(fs.readFileSync('custom-report/test-results.json', 'utf-8'));
const aiData = JSON.parse(fs.readFileSync('custom-report/ai-analysis.json', 'utf-8'));

console.log('=== FAILED TESTS ===');
let failedTests = [];

for (const suite of testData.suites) {
    for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
            const lastResult = test.results[test.results.length - 1];
            if (lastResult.status === 'failed') {
                failedTests.push({
                    title: test.title || spec.title,
                    file: spec.file
                });
            }
        }
    }
}

console.log(`Total failed: ${failedTests.length}`);
if (failedTests.length > 0) {
    console.log('\nFirst 3 failed tests:');
    failedTests.slice(0, 3).forEach((t, i) => {
        console.log(`${i + 1}. ${t.title}`);
        console.log(`   File: ${t.file}`);
    });
}

console.log('\n=== AI ANALYSES ===');
const aiKeys = Object.keys(aiData.analyses);
console.log(`Total analyses: ${aiKeys.length}`);

if (aiKeys.length > 0) {
    console.log('\nFirst 3 AI analyses:');
    aiKeys.slice(0, 3).forEach((key, i) => {
        const analysis = aiData.analyses[key];
        console.log(`${i + 1}. ${analysis.testName}`);
        console.log(`   File: ${analysis.file}`);
        console.log(`   Key: ${key}`);
    });
}

console.log('\n=== MATCHING TEST ===');
if (failedTests.length > 0 && aiKeys.length > 0) {
    const testFile = failedTests[0].file;
    const testTitle = failedTests[0].title;
    const firstAnalysis = aiData.analyses[aiKeys[0]];
    
    console.log('\nTest:');
    console.log(`  Title: "${testTitle}"`);
    console.log(`  File: "${testFile}"`);
    console.log(`  Normalized: "${testFile.replace(/\\/g, '/').toLowerCase()}"`);
    
    console.log('\nAI Analysis:');
    console.log(`  Title: "${firstAnalysis.testName}"`);
    console.log(`  File: "${firstAnalysis.file}"`);
    console.log(`  Normalized: "${firstAnalysis.file.replace(/\\/g, '/').toLowerCase()}"`);
    
    const normalizedTestFile = testFile.replace(/\\/g, '/').toLowerCase();
    const normalizedAnalysisFile = firstAnalysis.file.replace(/\\/g, '/').toLowerCase();
    const normalizedTestTitle = testTitle.toLowerCase().trim();
    const normalizedAnalysisTitle = firstAnalysis.testName.toLowerCase().trim();
    
    console.log('\nMatching Results:');
    console.log(`  Test file ends with analysis file: ${normalizedTestFile.endsWith(normalizedAnalysisFile)}`);
    console.log(`  Analysis file ends with test file: ${normalizedAnalysisFile.endsWith(normalizedTestFile)}`);
    console.log(`  Titles match: ${normalizedTestTitle === normalizedAnalysisTitle}`);
    
    // Try to find any match
    let matchFound = false;
    for (const key of aiKeys) {
        const analysis = aiData.analyses[key];
        const normTestFile = testFile.replace(/\\/g, '/').toLowerCase();
        const normAnaFile = analysis.file.replace(/\\/g, '/').toLowerCase();
        const normTestTitle = testTitle.toLowerCase().trim();
        const normAnaTitle = analysis.testName.toLowerCase().trim();
        
        if ((normTestFile.endsWith(normAnaFile) || normAnaFile.endsWith(normTestFile)) &&
            normTestTitle === normAnaTitle) {
            console.log(`\n✓ MATCH FOUND!`);
            console.log(`  Test: ${testTitle}`);
            console.log(`  Analysis: ${analysis.testName}`);
            matchFound = true;
            break;
        }
    }
    
    if (!matchFound) {
        console.log(`\n✗ NO MATCH FOUND`);
        console.log(`\nThis means the AI analysis section will be hidden.`);
    }
}
