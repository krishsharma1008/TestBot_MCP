# 🎯 Jira-First Automated Workflow

## Overview

The workflow now **starts with Jira** - scanning your board, generating tests from stories, then running the complete automated cycle.

## 🚀 Quick Start

```bash
npm start
```

This single command now:
1. **📋 Scans Jira board** for all stories
2. **🧪 Generates Playwright tests** from acceptance criteria
3. **🚀 Starts project server**
4. **▶️ Runs all tests** (existing + Jira-generated)
5. **🤖 AI analyzes failures**
6. **🔧 AI applies fixes**
7. **✅ Verifies fixes**
8. **📊 Enriches dashboard** with Jira data
9. **🔄 Updates Jira board** based on results
10. **🌐 Opens dashboard** with integrated Jira board
11. **📝 Creates GitHub PR**

## 📋 Complete Workflow Steps

### **Step 1: Scan Jira & Generate Tests** 🎯

```
📋 Step 1: Scanning Jira stories and generating tests...
────────────────────────────────────────────────────────

🔍 Scanning Jira board for stories...
📊 Connecting to Jira: https://shreyespd12.atlassian.net
✅ Found 5 stories in project MSCSHIP

📝 Generating tests from stories:
   ✅ MSCSHIP-1: User Login Feature
      Generated: tests/jira-generated/mscship-1-user-login.spec.js
      
   ✅ MSCSHIP-2: Cruise Search Functionality
      Generated: tests/jira-generated/mscship-2-cruise-search.spec.js
      
   ✅ MSCSHIP-3: Booking Reservation
      Generated: tests/jira-generated/mscship-3-booking-reservation.spec.js
      
   ✅ MSCSHIP-4: Contact Form Submission
      Generated: tests/jira-generated/mscship-4-contact-form.spec.js
      
   ✅ MSCSHIP-5: User Profile Management
      Generated: tests/jira-generated/mscship-5-user-profile.spec.js

✅ Jira stories scanned and tests generated
   Total: 5 stories → 5 test files
```

### **Step 2: Start Project Server** 🚀

```
📋 Step 2: Starting the project...
────────────────────────────────────────────────────────

Starting PHP server on port 8000...
✅ Project server started
✅ Server is ready
🌐 Opening website in browser...
   → http://localhost:8000
```

### **Step 3: Run All Tests** 🧪

```
📋 Step 3: Running all tests (existing + Jira-generated)...
────────────────────────────────────────────────────────

Running Playwright tests...

Existing Tests:
  ✅ tests/frontend/authenticated.spec.js (4 tests)
  ✅ tests/frontend/contact.spec.js (5 tests)
  ✅ tests/frontend/cruises.spec.js (3 tests)
  ✅ tests/backend/api.spec.js (8 tests)

Jira-Generated Tests:
  ✅ tests/jira-generated/mscship-1-user-login.spec.js (3 tests)
  ✅ tests/jira-generated/mscship-2-cruise-search.spec.js (4 tests)
  ❌ tests/jira-generated/mscship-3-booking-reservation.spec.js (2 failed)
  ✅ tests/jira-generated/mscship-4-contact-form.spec.js (2 tests)
  ❌ tests/jira-generated/mscship-5-user-profile.spec.js (1 failed)

Total: 31 tests
  ✅ Passed: 28
  ❌ Failed: 3
```

### **Step 4: AI Analysis** 🤖

```
📋 Step 4: Analyzing errors with AI...
────────────────────────────────────────────────────────

Running AI Agent for error analysis...
📦 Processing test results with artifacts...
   ✅ Found 3 screenshots
   ✅ Found 3 videos
   ✅ Found 3 trace files

🔍 Analyzing 3 test failure(s):
   1. MSCSHIP-3: Booking reservation form validation
   2. MSCSHIP-3: Booking confirmation page
   3. MSCSHIP-5: Profile update functionality

✅ Analyzed 3 error(s)
```

### **Step 5: Apply Fixes** 🔧

```
📋 Step 5: Applying AI-suggested fixes...
────────────────────────────────────────────────────────

Applying fixes...
   ✅ Fixed: Booking form selector
   ✅ Fixed: Confirmation page navigation
   ✅ Fixed: Profile update endpoint

✅ Applied 3 fix(es)
```

### **Step 6: Verify Fixes** ✅

```
📋 Step 6: Verifying fixes...
────────────────────────────────────────────────────────

Running tests...
✅ All tests now passing!
   Total: 31 tests
   Passed: 31
   Failed: 0
```

### **Step 7: Generate Dashboard** 📊

```
📋 Step 7: Generating test dashboard with AI analysis...
────────────────────────────────────────────────────────

Building custom dashboard...
✅ Dashboard generated with AI insights
```

### **Step 7.5: Enrich with Jira** 🎯

```
📋 Step 7.5: Enriching dashboard with Jira data...
────────────────────────────────────────────────────────

📊 Analyzing test results for Jira board update...
   Mapped 31 tests to 5 Jira stories

🔄 Updating Jira board based on test results...
   ✅ MSCSHIP-1: Moved from "To Do" → "Done" (3/3 tests passing)
   ✅ MSCSHIP-2: Moved from "To Do" → "Done" (4/4 tests passing)
   ✅ MSCSHIP-3: Moved from "In Progress" → "Done" (2/2 tests passing)
   ✅ MSCSHIP-4: Moved from "To Do" → "Done" (2/2 tests passing)
   ✅ MSCSHIP-5: Moved from "In Progress" → "Done" (1/1 tests passing)

═══════════════════════════════════════════════════════
📊 JIRA BOARD UPDATE SUMMARY
═══════════════════════════════════════════════════════
✅ Updated: 5
⏭️  Skipped: 0
❌ Failed: 0
═══════════════════════════════════════════════════════

✅ Dashboard enriched with Jira board integration
✅ Dashboard rebuilt with Jira integration
```

### **Step 8: Create PR** 📝

```
📋 Step 8: Creating GitHub Pull Request...
────────────────────────────────────────────────────────

✅ Pull Request created: https://github.com/your-repo/pull/130
```

### **Final Summary** 🎉

```
═══════════════════════════════════════════════════════
✅ Complete Workflow Finished!
═══════════════════════════════════════════════════════

Summary:
  Jira Stories Scanned: 5
  Tests Generated: 5 new test files
  Total Tests Run: 31 (20 existing + 11 generated)
  Initial Failures: 3
  Fixes Applied: 3
  Final Status: ✅ All Passing
  Jira Stories Updated: 5
  Pull Request: https://github.com/your-repo/pull/130

📊 Servers Running:
   🌐 Website: http://localhost:8000
   📊 Dashboard: http://localhost:3000

📊 View dashboard: http://localhost:3000
   - Jira board with all stories
   - Test results mapped to stories
   - AI analysis and fixes

─────────────────────────────────────────────────────────
⏸️  Servers are running. Press ENTER to stop servers and exit...
─────────────────────────────────────────────────────────
```

## 🎯 How It Works

### **1. Jira Story Scanning**

The workflow connects to your Jira board and:
- Fetches all stories from project `MSCSHIP`
- Reads acceptance criteria (Given-When-Then format)
- Identifies new or updated stories

### **2. Test Generation**

For each story, it:
- Parses acceptance criteria
- Generates Playwright test file
- Creates test cases for each scenario
- Saves to `tests/jira-generated/`

**Example Generated Test:**

```javascript
// tests/jira-generated/mscship-1-user-login.spec.js
import { test, expect } from '@playwright/test';

test.describe('MSCSHIP-1: User Login Feature', () => {
  
  test('should display login form', async ({ page }) => {
    // Generated from: Given user is on login page
    await page.goto('/login');
    await expect(page.locator('#login-form')).toBeVisible();
  });
  
  test('should login with valid credentials', async ({ page }) => {
    // Generated from: When user enters valid credentials
    await page.goto('/login');
    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    
    // Then user should be redirected to dashboard
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### **3. Test Execution**

Runs **both**:
- ✅ Existing manual tests (`tests/frontend/`, `tests/backend/`)
- ✅ Jira-generated tests (`tests/jira-generated/`)

### **4. Results Mapping**

After tests run:
- Maps test results back to Jira stories
- Calculates pass rate per story
- Determines recommended Jira status

### **5. Jira Board Update**

Automatically moves stories:
- **To Done**: All tests passing (100%)
- **To In Progress**: Some tests failing (< 100%)
- **To To Do**: No tests yet

### **6. Dashboard Integration**

Shows:
- Jira board with story cards
- Test results per story
- Pass/fail rates
- AI analysis for failures

## 🎨 Dashboard Features

### **Jira Board View**

```
┌─────────────────┬─────────────────┬─────────────────┐
│    To Do        │  In Progress    │      Done       │
├─────────────────┼─────────────────┼─────────────────┤
│                 │                 │  MSCSHIP-1      │
│                 │                 │  User Login     │
│                 │                 │  3/3 tests ✅   │
│                 │                 │  100% pass      │
│                 │                 │                 │
│                 │                 │  MSCSHIP-2      │
│                 │                 │  Cruise Search  │
│                 │                 │  4/4 tests ✅   │
│                 │                 │  100% pass      │
│                 │                 │                 │
│                 │                 │  MSCSHIP-3      │
│                 │                 │  Booking        │
│                 │                 │  2/2 tests ✅   │
│                 │                 │  100% pass      │
│                 │                 │                 │
│                 │                 │  MSCSHIP-4      │
│                 │                 │  Contact Form   │
│                 │                 │  2/2 tests ✅   │
│                 │                 │  100% pass      │
│                 │                 │                 │
│                 │                 │  MSCSHIP-5      │
│                 │                 │  User Profile   │
│                 │                 │  1/1 tests ✅   │
│                 │                 │  100% pass      │
└─────────────────┴─────────────────┴─────────────────┘
```

### **Test Results Table**

| Test Name | Suite | Jira Story | Status | Duration |
|-----------|-------|------------|--------|----------|
| should display login form | User Login | MSCSHIP-1 | ✅ Passed | 1.2s |
| should login with valid credentials | User Login | MSCSHIP-1 | ✅ Passed | 2.5s |
| should search cruises by port | Cruise Search | MSCSHIP-2 | ✅ Passed | 3.1s |
| should book reservation | Booking | MSCSHIP-3 | ✅ Passed | 4.2s |

## 🔄 Continuous Workflow

### **Daily Use**

```bash
# Morning: Run complete workflow
npm start
```

**What happens:**
1. Scans Jira for new/updated stories
2. Generates tests for new stories
3. Runs all tests
4. AI fixes any failures
5. Updates Jira board
6. Shows dashboard

### **When Stories Change**

If you update a story in Jira:
1. Next `npm start` detects the change
2. Regenerates tests for that story
3. Runs updated tests
4. Updates results

## 🛠️ Configuration

### **Jira Settings** (Already Configured)

Your `.env`:
```env
JIRA_BASE_URL=https://shreyespd12.atlassian.net
JIRA_EMAIL=shreyespd12@gmail.com
JIRA_API_TOKEN=ATATT3xFfGF0V8DlJGNOz-00-...
JIRA_PROJECT_KEY=MSCSHIP
```

### **Test Generation Settings**

Create `jira-integration.config.js`:
```javascript
module.exports = {
  // Test generation options
  testDirectory: 'tests/jira-generated',
  testTemplate: 'playwright', // or 'custom'
  
  // Story filtering
  includeStatuses: ['To Do', 'In Progress', 'Done'],
  excludeLabels: ['no-automation'],
  
  // Test naming
  fileNamePattern: '{key}-{summary-slug}.spec.js'
};
```

## 📁 Generated Files

```
tests/jira-generated/
├── mscship-1-user-login.spec.js
├── mscship-2-cruise-search.spec.js
├── mscship-3-booking-reservation.spec.js
├── mscship-4-contact-form.spec.js
└── mscship-5-user-profile.spec.js

.jira-cache/
├── stories.json                  # Cached Jira stories
├── test-story-mapping.json       # Test-to-story mapping
└── last-sync.json                # Last sync timestamp
```

## 🎯 Benefits

1. **Automated Test Creation**: Tests generated from Jira stories
2. **Always Up-to-Date**: Detects story changes automatically
3. **Bidirectional Sync**: Tests → Jira, Jira → Tests
4. **Complete Traceability**: Every test linked to a story
5. **AI-Powered**: Automatic error fixing
6. **Single Command**: Everything with `npm start`

## 📚 Related Documentation

- [Jira Integration Details](./JIRA_INTEGRATION_README.md)
- [Dashboard Features](./JIRA_DASHBOARD_README.md)
- [Test Generation](./JIRA_INTEGRATION_ARCHITECTURE.md)
- [AI Agent](./AI_AGENT_README.md)

---

## 🚀 Get Started

```bash
npm start
```

**The workflow now starts with Jira!** 🎉
