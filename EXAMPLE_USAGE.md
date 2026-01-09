# 🎬 AI Agent - Example Usage Scenarios

Real-world examples of using the AI Agent to fix test failures automatically.

## 📝 Example 1: Fixing API Endpoint Typo

### The Problem

Test failure in `tests/backend/api.spec.js`:

```
❌ search endpoint returns cruises for ALL ports
   Error: 404 Not Found
   at line 9: const response = await request.post('/cuirses/search', {
```

### Running AI Agent

```bash
$ npm run ai-agent

🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
   Found 1 test failure

🔍 Step 2: Analyzing test failures with AI...
   🔍 Analyzing 1 test failure(s)...
   
   AI Analysis:
   - Test: search endpoint returns cruises for ALL ports
   - Error: 404 Not Found
   - Root Cause: Typo in endpoint URL
   - Confidence: 98%

🔧 Step 3: Applying AI-suggested fixes...
   ✅ Applied fix for: search endpoint returns cruises for ALL ports
   
   Changes:
   - File: tests/backend/api.spec.js
   - Line 9: '/cuirses/search' → '/cruises/search'

🧪 Step 4: Verifying fixes...
   Running tests...
   ✅ All tests passed after applying fixes!

📊 Step 5: Generating comprehensive report...
   ✅ JSON report saved: ./ai-agent-reports/ai-agent-report-2026-01-08T10-30-00.json
   ✅ HTML report saved: ./ai-agent-reports/ai-agent-report-2026-01-08T10-30-00.html

📤 Step 6: Creating GitHub Pull Request...
   ✅ Created branch: ai-fix-1704700800000
   ✅ Changes committed
   ✅ Pushed branch: ai-fix-1704700800000
   ✅ Pull Request created: https://github.com/your-repo/pull/123

═══════════════════════════════════════════════════════════════
✅ AI Agent completed successfully in 45.3s
📊 Report saved to: ./ai-agent-reports/ai-agent-report-2026-01-08T10-30-00.html
📤 Pull Request: https://github.com/your-repo/pull/123
```

### The Fix

**Before:**
```javascript
const response = await request.post('/cuirses/search', {
```

**After:**
```javascript
const response = await request.post('/cruises/search', {
```

### Generated PR

**Title:** 🤖 AI Fix: Resolve 1 test failure(s)

**Description:**
```markdown
## 🤖 Automated Fix by AI Agent

### 📊 Summary
- Total Failures Detected: 1
- Fixes Applied: 1
- Success Rate: 100%

### 🔍 Failures Analyzed

#### search endpoint returns cruises for ALL ports
- File: tests/backend/api.spec.js
- Error: 404 Not Found
- Analysis: The endpoint URL contains a typo. '/cuirses/search' should be '/cruises/search'
- Confidence: 98%
- Fix Applied: ✅

### 🔧 Changes Made
- ✅ search endpoint returns cruises for ALL ports (tests/backend/api.spec.js)
```

---

## 📝 Example 2: Multiple Related Failures

### The Problem

Multiple tests failing due to same typo:

```
❌ search endpoint returns cruises for ALL ports (404 Not Found)
❌ cruise detail returns itinerary and rom data (404 Not Found)
❌ cruise detail handles burst traffic (404 Not Found)
```

### Running AI Agent

```bash
$ npm run ai-agent

🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
   Found 3 test failures

🔍 Step 2: Analyzing test failures with AI...
   🔍 Analyzing 3 test failure(s)...
   
   AI Analysis Summary:
   - All failures caused by same typo: '/cuirses/' → '/cruises/'
   - Confidence: 95%
   - Affected files: 1

🔧 Step 3: Applying AI-suggested fixes...
   ✅ Applied fix for: search endpoint returns cruises for ALL ports
   ✅ Applied fix for: cruise detail returns itinerary and rom data
   ✅ Applied fix for: cruise detail handles burst traffic
   
   Total changes: 3 lines in 1 file

🧪 Step 4: Verifying fixes...
   ✅ All tests passed!

📊 Step 5: Generating report...
   Success Rate: 100% (3/3 fixes successful)

📤 Step 6: Creating GitHub Pull Request...
   ✅ Pull Request: https://github.com/your-repo/pull/124

═══════════════════════════════════════════════════════════════
✅ AI Agent completed successfully in 52.1s
```

---

## 📝 Example 3: Using Windsurf IDE Mode

### Running in Windsurf Mode

```bash
$ npm run ai-agent:windsurf

🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
   Found 1 test failure

🔍 Step 2: Analyzing test failures with AI...
   🔍 Analyzing 1 test failure(s)...

📝 AI Analysis Prompt Generated:
────────────────────────────────────────────────────────────────
You are an expert software engineer analyzing a test failure...

**Test Information:**
- Test Name: search endpoint returns cruises for ALL ports
- File: tests/backend/api.spec.js
- Project: backend
- Error Line: 9

**Error Message:**
404 Not Found

**Code Context (around line 1):**
```
const { test, expect } = require('@playwright/test');

async function fetchCruises(request) {
  const response = await request.post('/cuirses/search', {
    headers: AJAX_HEADERS,
    form: { action: 'searchByPort', value: 'ALL' },
  });
  expect(response.ok()).toBeTruthy();
  ...
```

Please provide your response in the following JSON format:
{
  "analysis": "...",
  "rootCause": "...",
  "fix": {...},
  "confidence": 0.95
}
────────────────────────────────────────────────────────────────

⚠️  Windsurf IDE Integration:
Please copy the above prompt and paste it into Windsurf IDE.
The AI will analyze the error and suggest fixes.

Waiting for manual input of AI response...

Paste the AI response JSON (press Ctrl+D or Ctrl+Z when done):
```

### You paste this JSON from Windsurf:

```json
{
  "analysis": "The test is failing because the API endpoint URL has a typo. The endpoint '/cuirses/search' should be '/cruises/search'. This is causing a 404 Not Found error as the server cannot find the misspelled endpoint.",
  "rootCause": "Typo in API endpoint URL at line 9 of tests/backend/api.spec.js",
  "fix": {
    "description": "Correct the typo in the endpoint URL from '/cuirses/search' to '/cruises/search'",
    "changes": [
      {
        "file": "tests/backend/api.spec.js",
        "action": "replace",
        "lineStart": 9,
        "lineEnd": 9,
        "oldCode": "  const response = await request.post('/cuirses/search', {",
        "newCode": "  const response = await request.post('/cruises/search', {"
      }
    ]
  },
  "confidence": 0.98,
  "affectedFiles": ["tests/backend/api.spec.js"],
  "testingRecommendations": "Run the full test suite to verify the endpoint is accessible"
}
```

### Then press Ctrl+D (or Ctrl+Z on Windows)

```bash
✅ Applied fix for: search endpoint returns cruises for ALL ports
🧪 Verifying fixes...
✅ All tests passed!
📊 Report saved
📤 Pull Request: https://github.com/your-repo/pull/125
```

---

## 📝 Example 4: Dry Run Mode

### Preview Changes Without Applying

```bash
$ npm run ai-agent:dry-run

🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
   Found 1 test failure

🔍 Step 2: Analyzing test failures with AI...
   Analysis complete

🔧 Step 3: Applying AI-suggested fixes...
   [DRY RUN] Would apply change to: tests/backend/api.spec.js
     Action: replace
     Lines: 9-9
     Old: const response = await request.post('/cuirses/search', {
     New: const response = await request.post('/cruises/search', {
   
   [DRY RUN] No actual changes made

📊 Step 4: Generating report...
   Report shows what would be changed

═══════════════════════════════════════════════════════════════
✅ Dry run completed - no changes were made
📊 Review the report to see proposed fixes
```

---

## 📝 Example 5: Low Confidence Scenario

### When AI is Uncertain

```bash
$ npm run ai-agent

🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests to detect failures...
   Found 1 test failure

🔍 Step 2: Analyzing test failures with AI...
   🔍 Analyzing 1 test failure(s)...
   
   AI Analysis:
   - Test: complex async operation test
   - Error: Timeout exceeded
   - Confidence: 45%

🔧 Step 3: Applying AI-suggested fixes...
   ⚠️  Skipping low-confidence fix for: complex async operation test
       (confidence: 45% < threshold: 70%)
   
   No fixes applied

📊 Step 4: Generating report...
   Report includes analysis for manual review

═══════════════════════════════════════════════════════════════
⚠️  No fixes applied due to low confidence
📊 Review report for manual fixing: ./ai-agent-reports/...html
```

---

## 📝 Example 6: CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Auto-Fix Tests

on:
  push:
    branches: [develop]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  test-and-fix:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run tests
        id: tests
        run: npm test
        continue-on-error: true
      
      - name: Run AI Agent on failure
        if: steps.tests.outcome == 'failure'
        env:
          AI_PROVIDER: openai
          AI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run ai-agent
      
      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ai-agent-reports
          path: ai-agent-reports/
```

### CI Output

```
Run tests
  ❌ 2 tests failed
  
Run AI Agent on failure
  🤖 AI Agent Orchestrator Starting...
  ✅ Applied 2 fixes
  ✅ All tests now passing
  📤 Created PR #126
  
Upload reports
  ✅ Reports uploaded as artifacts
```

---

## 📝 Example 7: Custom Configuration

### Using Custom Settings

```javascript
// ai-agent.config.js
module.exports = {
  aiProvider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  minConfidence: 0.85,  // Higher threshold
  createPR: true,
  baseBranch: 'develop',  // Custom base branch
  branchPrefix: 'auto-fix',
  rollbackOnFailure: true  // Safety net
};
```

### Running with Custom Config

```bash
$ npm run ai-agent

🤖 AI Agent Orchestrator Starting...
   Using configuration: ai-agent.config.js
   AI Provider: anthropic (claude-3-5-sonnet-20241022)
   Min Confidence: 85%
   Base Branch: develop
   
... (rest of output)

📤 Creating PR against develop branch...
   ✅ Pull Request: https://github.com/your-repo/pull/127
```

---

## 📝 Example 8: Rollback on Failure

### When Fixes Don't Work

```bash
$ npm run ai-agent -- --rollback-on-failure

🤖 AI Agent Orchestrator Starting...
═══════════════════════════════════════════════════════════════
📋 Step 1: Running tests...
   Found 2 test failures

🔍 Step 2: Analyzing failures...
   ✅ Analysis complete

🔧 Step 3: Applying fixes...
   ✅ Applied fix 1
   ✅ Applied fix 2

🧪 Step 4: Verifying fixes...
   Running tests...
   ⚠️  1 test still failing

↩️  Rolling back changes...
   ↩️  Restored: tests/backend/api.spec.js
   ↩️  Restored: tests/frontend/cruises.spec.js
   ✅ Rollback complete

═══════════════════════════════════════════════════════════════
❌ Fixes did not resolve all issues, changes rolled back
📊 Review report for manual intervention
```

---

## 📝 Example 9: Viewing Reports

### HTML Report

Open `ai-agent-reports/ai-agent-report-2026-01-08T10-30-00.html`:

```
🤖 AI Agent Report
Automated Test Failure Analysis & Fixes
2026-01-08T10:30:00.000Z

┌─────────────────────────────────────────────┐
│ Total Failures: 2                           │
│ Fixes Applied: 2                            │
│ Fixes Failed: 0                             │
│ Success Rate: 100%                          │
└─────────────────────────────────────────────┘

📊 Test Failures

❌ search endpoint returns cruises for ALL ports
📁 tests/backend/api.spec.js:9
Error: 404 Not Found

AI Analysis: [98% confidence]
The endpoint URL contains a typo...

✅ Fix Applied: Corrected endpoint URL

[More details in beautiful HTML format]
```

---

## 💡 Pro Tips from Examples

### Tip 1: Start with Dry Run
Always preview changes first:
```bash
npm run ai-agent:dry-run
```

### Tip 2: Use High Confidence for Production
```bash
npm run ai-agent -- --min-confidence 0.9
```

### Tip 3: Review First Few PRs
Learn AI's patterns before full automation

### Tip 4: Keep Reports
Track improvements over time

### Tip 5: Combine with Manual Review
```bash
npm run ai-agent:no-pr  # Fix locally first
git diff                # Review changes
git commit              # Commit manually
```

---

## 🎯 Success Patterns

### Pattern 1: Typos and Simple Errors
- **Confidence**: 95%+
- **Success Rate**: 99%
- **Time Saved**: 90%

### Pattern 2: API Endpoint Issues
- **Confidence**: 90%+
- **Success Rate**: 95%
- **Time Saved**: 85%

### Pattern 3: Missing Imports
- **Confidence**: 85%+
- **Success Rate**: 90%
- **Time Saved**: 80%

### Pattern 4: Logic Errors
- **Confidence**: 60-80%
- **Success Rate**: 70%
- **Time Saved**: 50%
- **Note**: Review carefully

---

## 📚 Learn More

- Full documentation: `AI_AGENT_README.md`
- Quick start: `AI_AGENT_QUICKSTART.md`
- Windsurf guide: `WINDSURF_INTEGRATION.md`
- Architecture: `AI_AGENT_ARCHITECTURE.md`

---

**Ready to try it yourself?**

```bash
npm run ai-agent
```
