# Jira Integration Architecture

## 🏗️ System Overview

The Jira Integration system provides automated regression testing based on Jira user stories and acceptance criteria. It consists of four main components that work together to detect changes, generate tests, and execute the complete testing workflow.

```
┌─────────────────────────────────────────────────────────────┐
│                    Jira Board (Source)                      │
│  User Stories → Acceptance Criteria → Status Changes        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   Jira Client Module                        │
│  • Fetches stories via REST API                             │
│  • Extracts acceptance criteria                             │
│  • Caches state for change detection                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Change Detector Module                      │
│  • Compares current vs cached state                         │
│  • Identifies new/updated/deleted stories                   │
│  • Triggers appropriate actions                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Test Generator Module                       │
│  • Parses acceptance criteria (Gherkin, bullets, etc.)      │
│  • Generates Playwright test files                          │
│  • Updates existing tests when criteria changes             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Workflow Integrator Module                     │
│  • Executes Playwright tests                                │
│  • Triggers AI agent on failures                            │
│  • Builds dashboard                                         │
│  • Generates reports                                        │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Component Details

### 1. Jira Client (`jira-client.js`)

**Responsibilities:**
- Connect to Jira REST API
- Fetch user stories and issues
- Extract acceptance criteria from various formats
- Cache state for change detection
- Handle Atlassian Document Format (ADF)

**Key Methods:**
```javascript
getProject()                    // Get project details
getIssues(jql)                 // Fetch issues with JQL
getUserStories(filters)        // Get user stories
getStoryDetails(issueKey)      // Get detailed story info
extractAcceptanceCriteria()    // Parse acceptance criteria
detectChanges()                // Compare current vs cached state
```

**Acceptance Criteria Parsing:**
- Searches description field
- Checks custom fields
- Parses Gherkin format (Given/When/Then)
- Extracts bullet points and numbered lists
- Handles ADF (Atlassian Document Format)

### 2. Test Generator (`test-generator.js`)

**Responsibilities:**
- Convert acceptance criteria to test scenarios
- Generate Playwright test code
- Update existing tests
- Support AI-enhanced generation
- Manage test lifecycle

**Key Methods:**
```javascript
generateTestsFromStory()       // Create new test file
updateExistingTest()           // Update test file
extractTestScenarios()         // Parse criteria into scenarios
buildTestCode()                // Generate Playwright code
convertToPlaywrightStep()      // Convert Gherkin to Playwright
```

**Test Generation Flow:**
```
Acceptance Criteria
    ↓
Parse Gherkin/Bullets
    ↓
Extract Scenarios
    ↓
Convert to Playwright Steps
    ↓
Generate Test File
```

**Supported Patterns:**
- Navigation: `goto()`, `click()`
- Input: `fill()`, `type()`
- Selection: `selectOption()`
- Assertions: `expect().toBeVisible()`, `toHaveURL()`

### 3. Change Detector (`change-detector.js`)

**Responsibilities:**
- Monitor Jira board for changes
- Compare current vs previous state
- Process different change types
- Log change history
- Trigger appropriate actions

**Change Types:**
- **New Stories**: Generate new tests
- **Updated Stories**: Regenerate if criteria changed
- **Status Changes**: Handle lifecycle transitions
- **Deleted Stories**: Archive or delete tests

**Status-Based Actions:**
```javascript
// Story moves to "In Progress"
→ Ensure tests exist

// Story moves to "Done"
→ Archive tests (optional)

// Story deleted
→ Delete/archive tests (configurable)
```

### 4. Workflow Integrator (`workflow-integrator.js`)

**Responsibilities:**
- Execute Playwright tests
- Integrate with existing AI agent
- Build test dashboard
- Schedule periodic checks
- Generate regression reports

**Regression Cycle:**
```
1. Run Playwright Tests
    ↓
2. Tests Failed? → Run AI Agent
    ↓
3. AI Applied Fixes? → Re-run Tests
    ↓
4. Build Dashboard
    ↓
5. Generate Report
```

## 🔄 Data Flow

### Initial Sync Flow
```
User runs: npm run jira:sync
    ↓
Fetch all user stories from Jira
    ↓
For each story with acceptance criteria:
    ↓
Generate Playwright test file
    ↓
Save to tests/jira-generated/
    ↓
Cache story state
```

### Change Detection Flow
```
User runs: npm run jira:detect
    ↓
Fetch current stories from Jira
    ↓
Load cached stories
    ↓
Compare and identify changes
    ↓
Process each change type:
  • New → Generate test
  • Updated → Update test (if criteria changed)
  • Status → Handle lifecycle
  • Deleted → Archive/delete test
    ↓
Run regression cycle
```

### Watch Mode Flow
```
User runs: npm run jira:watch
    ↓
Start periodic timer (default: 30 min)
    ↓
Every interval:
  ↓
  Detect changes
  ↓
  If changes found:
    ↓
    Process changes
    ↓
    Run regression cycle
```

## 📁 File Structure

```
jira-integration/
├── index.js                    # Main entry point
├── jira-client.js             # Jira API client
├── test-generator.js          # Test code generator
├── change-detector.js         # Change detection logic
├── workflow-integrator.js     # Workflow orchestration
├── regression-results/        # Regression cycle results
└── workflow-reports/          # Workflow execution reports

.jira-cache/
├── issues-cache.json          # Cached Jira issues
└── change-log.json            # Change history

tests/
└── jira-generated/            # Auto-generated tests
    ├── proj_123.spec.js
    ├── proj_124.spec.js
    └── archived/              # Archived tests
        └── proj_100.spec.js
```

## 🔌 Integration Points

### With Existing Workflow

The Jira integration seamlessly connects with your existing testing infrastructure:

```javascript
// Existing workflow
AI Agent → Error Analysis → Fix Application → PR Creation

// Jira integration adds
Jira Changes → Test Generation → [Existing Workflow]
```

### With Playwright

Generated tests use your existing Playwright configuration:
- Test directory structure
- Reporter configuration
- Browser settings
- Base URL and environment

### With AI Agent

When tests fail, the workflow automatically triggers your AI agent:
```javascript
Tests Failed
    ↓
Run: node ai-agent/index.js
    ↓
AI analyzes failures
    ↓
AI applies fixes
    ↓
Re-run tests
```

## 🎯 Configuration System

### Environment Variables
```bash
JIRA_BASE_URL      # Jira instance URL
JIRA_EMAIL         # User email
JIRA_API_TOKEN     # API token
JIRA_PROJECT_KEY   # Project key
```

### Configuration File
```javascript
// jira-integration.config.js
module.exports = {
  // API Configuration
  jiraBaseUrl: '...',
  jiraEmail: '...',
  jiraApiToken: '...',
  jiraProjectKey: '...',
  
  // Behavior Configuration
  useAI: false,
  alwaysUpdateTests: false,
  deleteTestsForDeletedStories: false,
  archiveCompletedTests: true,
  ensureTestsForActiveStories: true,
  
  // Workflow Configuration
  runAIAgentOnFailure: true,
  retestAfterAIFixes: true,
  buildDashboard: true
};
```

## 🔐 Security Considerations

1. **API Token Storage**: Stored in `.env` (gitignored)
2. **HTTPS Only**: All Jira API calls use HTTPS
3. **Token Permissions**: Requires read-only access to issues
4. **No Sensitive Data**: Test files don't include credentials

## 📊 Monitoring & Observability

### Change Log
```json
{
  "timestamp": "2024-01-11T10:30:00Z",
  "summary": {
    "new": 2,
    "updated": 3,
    "statusChanged": 1,
    "deleted": 0,
    "testsGenerated": 2,
    "testsUpdated": 3
  },
  "details": { ... }
}
```

### Regression Results
```json
{
  "timestamp": "2024-01-11T10:35:00Z",
  "changes": { ... },
  "steps": [
    {
      "step": "playwright_tests",
      "success": true,
      "testResults": {
        "total": 15,
        "passed": 15,
        "failed": 0
      }
    }
  ]
}
```

## 🚀 Performance Optimization

1. **Caching**: Stories cached to minimize API calls
2. **Incremental Updates**: Only changed tests regenerated
3. **Parallel Execution**: Tests run in parallel (Playwright)
4. **Smart Detection**: Only processes actual changes

## 🔮 Future Enhancements

Potential improvements:
- [ ] AI-powered test generation
- [ ] Custom test templates
- [ ] Multi-project support
- [ ] Webhook integration
- [ ] Real-time monitoring dashboard
- [ ] Test coverage analysis
- [ ] Automatic test data generation
- [ ] Integration with other issue trackers

## 🤝 Extension Points

### Custom Parsers
```javascript
// Extend jira-client.js
extractAcceptanceCriteria(issue) {
  // Add custom parsing logic
}
```

### Custom Test Templates
```javascript
// Extend test-generator.js
buildTestCode(storyDetails, scenarios) {
  // Add custom test structure
}
```

### Custom Workflow Steps
```javascript
// Extend workflow-integrator.js
async executeFullRegressionCycle(changes) {
  // Add custom steps
}
```

## 📚 Technical Stack

- **Node.js**: Runtime environment
- **Playwright**: Test framework
- **Jira REST API v3**: Issue tracking integration
- **node-fetch**: HTTP client
- **dotenv**: Environment configuration

## 🐛 Error Handling

The system includes comprehensive error handling:
- API connection failures → Retry with exponential backoff
- Invalid credentials → Clear error messages
- Missing acceptance criteria → Skip with warning
- Test generation errors → Log and continue
- Workflow failures → Rollback and report

---

**Architecture Version**: 1.0.0  
**Last Updated**: January 2024
