const fs = require('fs');

const aiData = JSON.parse(fs.readFileSync('custom-report/ai-analysis.json', 'utf-8'));
const testData = JSON.parse(fs.readFileSync('custom-report/test-results.json', 'utf-8'));

console.log('=== AI Analysis IDs ===');
const aiIds = Object.keys(aiData.analyses);
aiIds.slice(0, 5).forEach(id => {
  const analysis = aiData.analyses[id];
  console.log(`ID: ${id}`);
  console.log(`  File: ${analysis.file}`);
  console.log(`  Test: ${analysis.testName}`);
  console.log('');
});

console.log('=== Test Data IDs (how dashboard generates them) ===');
let count = 0;
for (const suite of testData.suites) {
  if (!suite.specs) continue;
  for (const spec of suite.specs) {
    if (!spec.tests) continue;
    for (const test of spec.tests) {
      const testId = `${spec.file}-${test.title || spec.title}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
      console.log(`ID: ${testId}`);
      console.log(`  File: ${spec.file}`);
      console.log(`  Test: ${test.title || spec.title}`);
      console.log('');
      count++;
      if (count >= 5) break;
    }
    if (count >= 5) break;
  }
  if (count >= 5) break;
}

console.log('=== Checking for matches ===');
const testIds = new Set();
for (const suite of testData.suites) {
  if (!suite.specs) continue;
  for (const spec of suite.specs) {
    if (!spec.tests) continue;
    for (const test of spec.tests) {
      const testId = `${spec.file}-${test.title || spec.title}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
      testIds.add(testId);
    }
  }
}

let matchCount = 0;
aiIds.forEach(aiId => {
  if (testIds.has(aiId)) {
    matchCount++;
    console.log(`✓ Match found: ${aiId}`);
  } else {
    console.log(`✗ No match: ${aiId}`);
  }
});

console.log(`\nTotal AI analyses: ${aiIds.length}`);
console.log(`Total test IDs: ${testIds.size}`);
console.log(`Matches: ${matchCount}`);
