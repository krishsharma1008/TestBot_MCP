# Jira Integration - Automated Regression Testing

This integration automatically detects changes in your Jira board and generates/updates Playwright tests based on user stories and acceptance criteria.

## 🎯 Features

- **Automatic Test Generation**: Converts Jira user stories with acceptance criteria into Playwright tests
- **Change Detection**: Monitors Jira board for new, updated, or deleted stories
- **Smart Updates**: Only regenerates tests when acceptance criteria changes
- **Workflow Integration**: Seamlessly integrates with your existing AI agent and testing workflow
- **Watch Mode**: Continuously monitors Jira for changes and triggers regression tests
- **Status-Based Actions**: Automatically handles tests based on story status changes
- **Gherkin Support**: Parses Given-When-Then acceptance criteria into test steps

## 📋 Prerequisites

1. **Jira Account** with API access
2. **Jira API Token** - Generate from [Atlassian Account Security](https://id.atlassian.com/manage-profile/security/api-tokens)
3. **Project Key** - Your Jira project identifier (e.g., PROJ, SHIP, etc.)

## 🚀 Quick Start

### 1. Configuration

Create a `.env` file or set environment variables:

```bash
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your_jira_api_token_here
JIRA_PROJECT_KEY=PROJ
```

Or create `jira-integration.config.js`:

```javascript
module.exports = {
  jiraBaseUrl: 'https://yourcompany.atlassian.net',
  jiraEmail: 'your-email@company.com',
  jiraApiToken: 'your-api-token',
  jiraProjectKey: 'PROJ',
  
  // Optional settings
  useAI: false,
  alwaysUpdateTests: false,
  deleteTestsForDeletedStories: false,
  archiveCompletedTests: true,
  ensureTestsForActiveStories: true,
  runAIAgentOnFailure: true,
  retestAfterAIFixes: true,
  buildDashboard: true
};
```

### 2. Initialize

Test your Jira connection and cache initial state:

```bash
npm run jira:init
```

### 3. Sync All Stories

Generate tests for all existing user stories:

```bash
npm run jira:sync
```

### 4. Detect Changes & Run Regression

Detect changes since last run and execute regression cycle:

```bash
npm run jira:detect
```

### 5. Watch Mode (Continuous Monitoring)

Monitor Jira continuously and auto-trigger regression on changes:

```bash
npm run jira:watch
```

Or with custom interval (in minutes):

```bash
npm run jira:watch -- --interval 15
```

## 📝 How It Works

### 1. Story Detection

The integration monitors your Jira board for:
- **New Stories**: Creates new test files
- **Updated Stories**: Regenerates tests if acceptance criteria changed
- **Status Changes**: Takes action based on story lifecycle
- **Deleted Stories**: Optionally removes or archives tests

### 2. Test Generation

For each user story with acceptance criteria:

```
Story: PROJ-123 - User Login Feature
Acceptance Criteria:
- Given user is on login page
- When user enters valid credentials
- Then user should be logged in successfully
```

Generates:

```javascript
const { test, expect } = require('@playwright/test');
const { loginViaUI } = require('../utils/auth');

test.describe('PROJ-123: User Login Feature', () => {
  test('user can login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
  });
});
```

### 3. Regression Cycle

When changes are detected:

1. **Generate/Update Tests** - Creates or updates test files
2. **Run Playwright Tests** - Executes all tests
3. **AI Agent Analysis** (if tests fail) - Analyzes failures and suggests fixes
4. **Retest** (optional) - Re-runs tests after AI fixes
5. **Build Dashboard** - Creates visual test report

## 🎨 Acceptance Criteria Formats

The integration supports multiple formats:

### Gherkin Style (Recommended)

```
Given user is logged in
When user clicks on "Cruises" menu
Then user should see list of available cruises
And user should be able to filter by port
```

### Bullet Points

```
- User must be able to search cruises by destination
- Search results should display within 2 seconds
- User can filter results by date range
```

### Numbered List

```
1. Display cruise details when card is clicked
2. Show pricing information
3. Include booking button
```

## 🔧 Advanced Configuration

### Custom Field Mapping

If your Jira uses custom fields for acceptance criteria:

```javascript
module.exports = {
  customFields: {
    acceptanceCriteria: 'customfield_10001',
    testCases: 'customfield_10002'
  }
};
```

### Status-Based Actions

Customize behavior based on story status:

```javascript
module.exports = {
  activeStates: ['In Progress', 'Testing', 'Ready for Testing'],
  completedStates: ['Done', 'Closed', 'Resolved'],
  
  archiveCompletedTests: true, // Archive tests when story is done
  ensureTestsForActiveStories: true // Auto-generate for active stories
};
```

### AI-Enhanced Generation

Enable AI for smarter test generation:

```javascript
module.exports = {
  useAI: true, // Requires AI_PROVIDER and AI_API_KEY in .env
};
```

## 📊 Commands Reference

| Command | Description |
|---------|-------------|
| `npm run jira:init` | Initialize and test Jira connection |
| `npm run jira:sync` | Sync all stories and generate tests |
| `npm run jira:detect` | Detect changes and run regression |
| `npm run jira:watch` | Continuous monitoring mode |
| `npm run jira:story -- --story PROJ-123` | Process specific story |

## 📁 Generated Files Structure

```
tests/
  jira-generated/          # Auto-generated test files
    proj_123.spec.js
    proj_124.spec.js
    archived/              # Archived tests for completed stories
      proj_100.spec.js

.jira-cache/
  issues-cache.json        # Cached Jira issues for change detection
  change-log.json          # History of detected changes

jira-integration/
  regression-results/      # Regression cycle results
    latest.json
    regression-2024-01-11.json
```

## 🔄 Integration with Existing Workflow

The Jira integration works seamlessly with your existing setup:

1. **Detects Jira changes** → Generates/updates tests
2. **Runs Playwright tests** → Uses your existing test configuration
3. **On failure** → Triggers your AI agent for analysis
4. **Applies fixes** → Uses existing fix application workflow
5. **Builds dashboard** → Uses your custom dashboard builder

## 🎯 Best Practices

### 1. Write Clear Acceptance Criteria

Use Gherkin format for best results:
```
Given [initial context]
When [action is performed]
Then [expected outcome]
```

### 2. Use Descriptive Story Titles

Good: "User can filter cruises by departure port"
Bad: "Filter feature"

### 3. Keep Stories Atomic

One feature per story = one focused test file

### 4. Regular Syncing

Run `npm run jira:sync` after major sprint planning

### 5. Watch Mode for Active Development

Use watch mode during active sprints:
```bash
npm run jira:watch -- --interval 15
```

## 🐛 Troubleshooting

### Connection Issues

```bash
# Test connection
npm run jira:init
```

Check:
- JIRA_BASE_URL is correct (include https://)
- JIRA_API_TOKEN is valid
- JIRA_EMAIL matches your Atlassian account

### No Tests Generated

Check if stories have acceptance criteria:
- View story in Jira
- Look for "Acceptance Criteria" field
- Ensure it's not empty

### Tests Not Updating

Set `alwaysUpdateTests: true` in config to force updates

### Permission Errors

Ensure your API token has:
- Read access to project
- View issues permission

## 📈 Monitoring & Reports

### Change Log

View history of detected changes:
```bash
cat .jira-cache/change-log.json
```

### Regression Results

View latest regression cycle results:
```bash
cat jira-integration/regression-results/latest.json
```

### Dashboard

After running tests, view the dashboard:
```bash
npm run test:report
```

## 🔗 Integration Examples

### CI/CD Pipeline

```yaml
# .github/workflows/jira-regression.yml
name: Jira Regression Tests

on:
  schedule:
    - cron: '0 */2 * * *'  # Every 2 hours
  workflow_dispatch:

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run jira:detect
        env:
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_PROJECT_KEY: ${{ secrets.JIRA_PROJECT_KEY }}
```

### Webhook Integration

Set up Jira webhook to trigger on story updates:

```javascript
// webhook-handler.js
const JiraIntegration = require('./jira-integration');

app.post('/jira-webhook', async (req, res) => {
  const { issue } = req.body;
  
  if (issue.fields.issuetype.name === 'Story') {
    const integration = new JiraIntegration();
    await integration.run({ story: issue.key });
  }
  
  res.status(200).send('OK');
});
```

## 🤝 Contributing

To extend the integration:

1. **Custom Test Templates**: Modify `jira-integration/test-generator.js`
2. **Custom Parsers**: Extend `jira-client.js` parsing methods
3. **Workflow Steps**: Add steps in `workflow-integrator.js`

## 📚 Additional Resources

- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Playwright Documentation](https://playwright.dev/)
- [Gherkin Syntax Reference](https://cucumber.io/docs/gherkin/reference/)

## 🆘 Support

For issues or questions:
1. Check troubleshooting section above
2. Review generated test files in `tests/jira-generated/`
3. Check logs in `.jira-cache/change-log.json`
4. Review your Jira story acceptance criteria format

---

**Happy Testing! 🚀**
