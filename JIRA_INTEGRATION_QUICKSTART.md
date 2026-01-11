# Jira Integration - Quick Start Guide

Get up and running with Jira-based regression testing in 5 minutes!

## ⚡ Quick Setup

### Step 1: Get Your Jira Credentials

1. **Jira URL**: Your Atlassian URL (e.g., `https://yourcompany.atlassian.net`)
2. **Email**: Your Jira account email
3. **API Token**: Generate from [here](https://id.atlassian.com/manage-profile/security/api-tokens)
4. **Project Key**: Find in your Jira project (e.g., PROJ, SHIP)

### Step 2: Configure Environment

Copy `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Edit `.env`:
```env
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT_KEY=PROJ
```

### Step 3: Initialize

```bash
npm run jira:init
```

This will:
- Test your Jira connection
- Fetch all user stories
- Cache the current state

### Step 4: Generate Tests

```bash
npm run jira:sync
```

This generates Playwright tests for all stories with acceptance criteria.

### Step 5: Run Regression

```bash
npm run jira:detect
```

This will:
1. Detect changes since last run
2. Update/generate tests as needed
3. Run all Playwright tests
4. Trigger AI agent if tests fail
5. Build test dashboard

## 🎯 Daily Workflow

### Option A: Manual Trigger
Run when you want to check for changes:
```bash
npm run jira:detect
```

### Option B: Watch Mode
Continuous monitoring (checks every 30 minutes):
```bash
npm run jira:watch
```

### Option C: Custom Interval
Check every 15 minutes:
```bash
npm run jira:watch -- --interval 15
```

## 📝 Writing Acceptance Criteria in Jira

For best results, use Gherkin format in your Jira stories:

```
Acceptance Criteria:
- Given user is on the home page
- When user clicks on "Cruises" menu
- Then user should see list of available cruises
- And user should be able to filter by departure port
```

Or simple bullet points:
```
Acceptance Criteria:
- User can search cruises by destination
- Search results display within 2 seconds
- User can filter by date range
- User can sort by price
```

## 🔄 What Happens Automatically

### When You Create a New Story
✅ Test file is auto-generated in `tests/jira-generated/`

### When You Update Acceptance Criteria
✅ Test file is regenerated with new scenarios

### When Story Status Changes
✅ Tests are ensured for "In Progress" stories
✅ Tests are archived for "Done" stories

### When You Delete a Story
✅ Test file is optionally removed (configurable)

## 📊 View Results

### Test Reports
```bash
npm run test:report
```

### Dashboard
```bash
npm run dashboard:build
```

### Change Log
```bash
cat .jira-cache/change-log.json
```

## 🎨 Example Story → Test

**Jira Story:**
```
Title: User Login Feature
Key: PROJ-123

Acceptance Criteria:
- Given user is on login page
- When user enters valid credentials
- Then user should be logged in successfully
- And user should see their name in header
```

**Generated Test:**
```javascript
// tests/jira-generated/proj_123.spec.js
const { test, expect } = require('@playwright/test');
const { loginViaUI } = require('../utils/auth');

test.describe('PROJ-123: User Login Feature', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('text=Welcome')).toBeVisible();
  });
});
```

## 🛠️ Common Commands

| Command | What It Does |
|---------|--------------|
| `npm run jira:init` | Test connection & initialize |
| `npm run jira:sync` | Generate tests for ALL stories |
| `npm run jira:detect` | Detect changes & run regression |
| `npm run jira:watch` | Monitor continuously |
| `npm run jira:story -- --story PROJ-123` | Process one story |

## ⚙️ Configuration (Optional)

Create `jira-integration.config.js` for advanced settings:

```javascript
module.exports = {
  // Auto-run AI agent when tests fail
  runAIAgentOnFailure: true,
  
  // Re-run tests after AI applies fixes
  retestAfterAIFixes: true,
  
  // Archive tests for completed stories
  archiveCompletedTests: true,
  
  // Build dashboard after test runs
  buildDashboard: true
};
```

## 🐛 Troubleshooting

**Connection Failed?**
- Check JIRA_BASE_URL includes `https://`
- Verify API token is valid
- Ensure email matches Atlassian account

**No Tests Generated?**
- Check stories have "Acceptance Criteria" field
- Ensure field is not empty
- Try running `npm run jira:sync` again

**Tests Not Updating?**
- Set `alwaysUpdateTests: true` in config
- Or manually delete test file and re-sync

## 🚀 Next Steps

1. ✅ Set up Jira credentials
2. ✅ Run `npm run jira:init`
3. ✅ Run `npm run jira:sync`
4. ✅ Start watch mode: `npm run jira:watch`
5. 📝 Write acceptance criteria in Jira
6. 🎉 Tests auto-generate and run!

## 📚 More Information

- Full documentation: `JIRA_INTEGRATION_README.md`
- Configuration examples: `jira-integration.config.example.js`
- Existing workflow: `AI_AGENT_README.md`

---

**Need Help?** Check the full README or review the example configuration file.
