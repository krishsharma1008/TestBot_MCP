module.exports = {
  // Jira Configuration
  jiraBaseUrl: process.env.JIRA_BASE_URL || 'https://yourcompany.atlassian.net',
  jiraEmail: process.env.JIRA_EMAIL || 'your-email@company.com',
  jiraApiToken: process.env.JIRA_API_TOKEN || 'your-api-token',
  jiraProjectKey: process.env.JIRA_PROJECT_KEY || 'PROJ',

  // Test Generation Settings
  usePlaywrightMCP: true, // Use Playwright MCP for intelligent test generation (RECOMMENDED)
  mcpHeadless: true, // Run browser in headless mode during test generation
  mcpRecordVideo: false, // Record video during test generation (for debugging)
  baseURL: process.env.BASE_URL || 'http://localhost:8000', // Base URL for test generation
  
  useAI: false, // Use AI to generate enhanced test code (requires AI provider setup)
  alwaysUpdateTests: false, // Update tests even if acceptance criteria hasn't changed
  
  // Test Lifecycle Management
  deleteTestsForDeletedStories: false, // Delete test files when stories are deleted
  archiveCompletedTests: true, // Archive tests when stories move to Done/Closed
  ensureTestsForActiveStories: true, // Auto-generate tests for stories in active states
  
  // Workflow Integration
  runAIAgentOnFailure: true, // Run AI agent when tests fail
  retestAfterAIFixes: true, // Re-run tests after AI applies fixes
  buildDashboard: true, // Build test dashboard after test runs
  
  // Active Story States (customize based on your workflow)
  activeStates: ['In Progress', 'Testing', 'Ready for Testing', 'In Review'],
  
  // Completed Story States
  completedStates: ['Done', 'Closed', 'Resolved'],
  
  // Watch Mode Settings
  defaultWatchInterval: 30, // Minutes between checks in watch mode
  
  // Custom Field Mapping (if your Jira uses custom fields)
  customFields: {
    acceptanceCriteria: 'customfield_10001', // Replace with your field ID
    testCases: 'customfield_10002'
  }
};
