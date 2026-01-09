const TestArtifactProcessor = require('./ai-agent/test-artifact-processor');
const fs = require('fs');

const processor = new TestArtifactProcessor();

console.log('Loading test results...');
const testResults = JSON.parse(fs.readFileSync('./test-results.json', 'utf-8'));

console.log('Stats:', testResults.stats);
console.log('Expected:', testResults.stats.expected);
console.log('Unexpected:', testResults.stats.unexpected);

console.log('\nInspecting structure...');
if (testResults.suites && testResults.suites.length > 0) {
  const firstSuite = testResults.suites[0];
  console.log('First suite has suites:', firstSuite.suites?.length);
  
  if (firstSuite.suites && firstSuite.suites.length > 0) {
    const firstInnerSuite = firstSuite.suites[0];
    console.log('First inner suite title:', firstInnerSuite.title);
    console.log('First inner suite has specs:', firstInnerSuite.specs?.length);
    
    if (firstInnerSuite.specs && firstInnerSuite.specs.length > 0) {
      const firstSpec = firstInnerSuite.specs[0];
      console.log('First spec title:', firstSpec.title);
      console.log('First spec ok:', firstSpec.ok);
      console.log('First spec has tests:', firstSpec.tests?.length);
      
      if (firstSpec.tests && firstSpec.tests.length > 0) {
        const firstTest = firstSpec.tests[0];
        console.log('First test status:', firstTest.status);
        console.log('First test has results:', firstTest.results?.length);
      }
    }
  }
}

console.log('\nExtracting failures...');
const failures = processor.extractFailuresWithArtifacts(testResults);

console.log(`\nFound ${failures.length} failures:`);
failures.forEach((f, i) => {
  console.log(`\n${i + 1}. ${f.testName}`);
  console.log(`   File: ${f.file}`);
  console.log(`   Status: ${f.status}`);
  console.log(`   Error: ${f.error.message?.substring(0, 100)}...`);
  console.log(`   Screenshots: ${f.artifacts.screenshots.length}`);
  console.log(`   Videos: ${f.artifacts.videos.length}`);
  console.log(`   Traces: ${f.artifacts.traces.length}`);
});
