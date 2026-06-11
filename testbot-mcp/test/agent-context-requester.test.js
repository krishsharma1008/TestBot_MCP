'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const AgentContextRequester = require('../src/agent-context-requester');

// ---------------------------------------------------------------------------
// formatPagesList
// ---------------------------------------------------------------------------

test('formatPagesList returns "None detected" for null', () => {
  const req = new AgentContextRequester();
  assert.equal(req.formatPagesList(null), 'None detected');
});

test('formatPagesList returns "None detected" for empty array', () => {
  const req = new AgentContextRequester();
  assert.equal(req.formatPagesList([]), 'None detected');
});

test('formatPagesList formats each page with path and description', () => {
  const req = new AgentContextRequester();
  const pages = [
    { path: '/dashboard', description: 'Main dashboard' },
    { path: '/settings', description: 'User settings' },
  ];
  const result = req.formatPagesList(pages);
  assert.ok(result.includes('/dashboard'));
  assert.ok(result.includes('Main dashboard'));
  assert.ok(result.includes('/settings'));
  assert.ok(result.includes('User settings'));
});

test('formatPagesList uses "No description" fallback when description is missing', () => {
  const req = new AgentContextRequester();
  const result = req.formatPagesList([{ path: '/about' }]);
  assert.ok(result.includes('/about'));
  assert.ok(result.includes('No description'));
});

test('formatPagesList caps output at 15 pages', () => {
  const req = new AgentContextRequester();
  const pages = Array.from({ length: 20 }, (_, i) => ({ path: `/page${i}`, description: `Page ${i}` }));
  const result = req.formatPagesList(pages);
  const lineCount = result.split('\n').length;
  assert.equal(lineCount, 15);
});

// ---------------------------------------------------------------------------
// formatEndpointsList
// ---------------------------------------------------------------------------

test('formatEndpointsList returns "None detected" for null', () => {
  const req = new AgentContextRequester();
  assert.equal(req.formatEndpointsList(null), 'None detected');
});

test('formatEndpointsList returns "None detected" for empty array', () => {
  const req = new AgentContextRequester();
  assert.equal(req.formatEndpointsList([]), 'None detected');
});

test('formatEndpointsList formats method and path', () => {
  const req = new AgentContextRequester();
  const endpoints = [
    { method: 'GET', path: '/api/users' },
    { method: 'POST', path: '/api/users', requiresAuth: true },
  ];
  const result = req.formatEndpointsList(endpoints);
  assert.ok(result.includes('GET /api/users'));
  assert.ok(result.includes('POST /api/users'));
  assert.ok(result.includes('(auth required)'));
});

test('formatEndpointsList does not append auth tag when requiresAuth is false', () => {
  const req = new AgentContextRequester();
  const result = req.formatEndpointsList([{ method: 'GET', path: '/api/open', requiresAuth: false }]);
  assert.ok(!result.includes('auth required'));
});

test('formatEndpointsList caps output at 15 endpoints', () => {
  const req = new AgentContextRequester();
  const endpoints = Array.from({ length: 20 }, (_, i) => ({ method: 'GET', path: `/api/route${i}` }));
  const result = req.formatEndpointsList(endpoints);
  const lineCount = result.split('\n').length;
  assert.equal(lineCount, 15);
});

// ---------------------------------------------------------------------------
// generateContextPrompt
// ---------------------------------------------------------------------------

test('generateContextPrompt returns a non-empty string', () => {
  const req = new AgentContextRequester({ projectPath: '/myproject' });
  const prompt = req.generateContextPrompt({});
  assert.ok(typeof prompt === 'string');
  assert.ok(prompt.length > 0);
});

test('generateContextPrompt includes project name from autoContext', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({ projectStructure: { name: 'ShopApp' } });
  assert.ok(prompt.includes('ShopApp'));
});

test('generateContextPrompt falls back to basename of projectPath for project name', () => {
  const req = new AgentContextRequester({ projectPath: '/projects/my-cool-app' });
  const prompt = req.generateContextPrompt({});
  assert.ok(prompt.includes('my-cool-app'));
});

test('generateContextPrompt includes framework info', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({ projectStructure: { framework: 'Next.js' } });
  assert.ok(prompt.includes('Next.js'));
});

test('generateContextPrompt includes TypeScript flag when true', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({ projectStructure: { hasTypeScript: true } });
  assert.ok(prompt.includes('Yes'));
});

test('generateContextPrompt includes TypeScript flag as No when false', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({ projectStructure: { hasTypeScript: false } });
  assert.ok(prompt.includes('No'));
});

test('generateContextPrompt includes page count', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({
    pages: [{ path: '/home' }, { path: '/about' }],
  });
  assert.ok(prompt.includes('(2)'));
});

test('generateContextPrompt includes endpoint count', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({
    apiEndpoints: [{ method: 'GET', path: '/api/users' }],
  });
  assert.ok(prompt.includes('(1)'));
});

test('generateContextPrompt includes auth patterns', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({
    authPatterns: [{ type: 'session', description: 'Session cookie auth' }],
  });
  assert.ok(prompt.includes('session'));
  assert.ok(prompt.includes('Session cookie auth'));
});

test('generateContextPrompt shows None detected for missing auth patterns', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({});
  assert.ok(prompt.includes('None detected'));
});

test('generateContextPrompt contains JSON schema template', () => {
  const req = new AgentContextRequester();
  const prompt = req.generateContextPrompt({});
  assert.ok(prompt.includes('mainUserWorkflows'));
  assert.ok(prompt.includes('criticalBusinessLogic'));
  assert.ok(prompt.includes('apiContractsToTest'));
});

// ---------------------------------------------------------------------------
// summarizeContext
// ---------------------------------------------------------------------------

test('summarizeContext returns zero counts for empty context', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({});
  assert.equal(summary.pagesCount, 0);
  assert.equal(summary.endpointsCount, 0);
  assert.equal(summary.workflowsCount, 0);
  assert.equal(summary.formsCount, 0);
  assert.equal(summary.modelsCount, 0);
  assert.equal(summary.authPatternsCount, 0);
});

test('summarizeContext counts pages correctly', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({ pages: [{ path: '/a' }, { path: '/b' }] });
  assert.equal(summary.pagesCount, 2);
});

test('summarizeContext counts apiEndpoints correctly', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({ apiEndpoints: [{ method: 'GET', path: '/x' }] });
  assert.equal(summary.endpointsCount, 1);
});

test('summarizeContext hasAgentContext is true when criticalBusinessLogic present', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({ criticalBusinessLogic: [{ feature: 'auth' }] });
  assert.equal(summary.hasAgentContext, true);
  assert.equal(summary.hasCriticalLogic, true);
});

test('summarizeContext hasAgentContext is true when frontendInteractions present', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({ frontendInteractions: [{ page: '/' }] });
  assert.equal(summary.hasAgentContext, true);
});

test('summarizeContext hasAgentContext is false when neither field present', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({});
  assert.equal(summary.hasAgentContext, false);
});

test('summarizeContext hasErrorScenarios is true when errorScenarios present', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({ errorScenarios: [{ scenario: 'bad password' }] });
  assert.equal(summary.hasErrorScenarios, true);
});

test('summarizeContext hasTestData is true when testDataSuggestions present', () => {
  const req = new AgentContextRequester();
  const summary = req.summarizeContext({ testDataSuggestions: { validUser: { email: 'test@example.com' } } });
  assert.equal(summary.hasTestData, true);
});

// ---------------------------------------------------------------------------
// mergeContexts
// ---------------------------------------------------------------------------

test('mergeContexts returns autoContext unchanged when agentContext is null', () => {
  const req = new AgentContextRequester();
  const auto = { pages: [{ path: '/home' }] };
  const result = req.mergeContexts(auto, null);
  assert.deepEqual(result, auto);
});

test('mergeContexts returns autoContext unchanged when agentContext is undefined', () => {
  const req = new AgentContextRequester();
  const auto = { foo: 'bar' };
  assert.deepEqual(req.mergeContexts(auto, undefined), auto);
});

test('mergeContexts adds mainUserWorkflows from agentContext', () => {
  const req = new AgentContextRequester();
  const result = req.mergeContexts(
    {},
    { mainUserWorkflows: [{ name: 'Login flow', description: 'User logs in', steps: [], criticalAssertions: [] }] },
  );
  assert.equal(result.workflows.length, 1);
  assert.equal(result.workflows[0].name, 'Login flow');
  assert.equal(result.workflows[0].source, 'agent');
});

test('mergeContexts deduplicates workflows by name (case-insensitive)', () => {
  const req = new AgentContextRequester();
  const result = req.mergeContexts(
    { workflows: [{ name: 'Login Flow' }] },
    { mainUserWorkflows: [{ name: 'login flow', description: 'dup' }] },
  );
  assert.equal(result.workflows.length, 1);
});

test('mergeContexts merges new API endpoints from agentContext', () => {
  const req = new AgentContextRequester();
  const result = req.mergeContexts(
    { apiEndpoints: [{ method: 'GET', path: '/existing' }] },
    { apiContractsToTest: [{ method: 'POST', endpoint: '/new-endpoint', authRequired: true }] },
  );
  assert.equal(result.apiEndpoints.length, 2);
  const newEp = result.apiEndpoints.find((e) => e.path === '/new-endpoint');
  assert.ok(newEp);
  assert.equal(newEp.requiresAuth, true);
  assert.equal(newEp.source, 'agent');
});

test('mergeContexts enhances existing API endpoint with schema info', () => {
  const req = new AgentContextRequester();
  const result = req.mergeContexts(
    { apiEndpoints: [{ method: 'GET', path: '/api/users' }] },
    {
      apiContractsToTest: [{
        method: 'GET',
        endpoint: '/api/users',
        requestSchema: {},
        responseSchema: { users: 'array' },
        errorScenarios: ['unauthorized'],
      }],
    },
  );
  assert.equal(result.apiEndpoints.length, 1);
  assert.deepEqual(result.apiEndpoints[0].responseSchema, { users: 'array' });
  assert.deepEqual(result.apiEndpoints[0].errorScenarios, ['unauthorized']);
});

test('mergeContexts sets criticalBusinessLogic from agentContext', () => {
  const req = new AgentContextRequester();
  const logic = [{ feature: 'checkout', location: 'src/checkout.ts', testPriority: 'high' }];
  const result = req.mergeContexts({}, { criticalBusinessLogic: logic });
  assert.deepEqual(result.criticalBusinessLogic, logic);
});

test('mergeContexts sets frontendInteractions from agentContext', () => {
  const req = new AgentContextRequester();
  const interactions = [{ page: '/cart', component: 'Cart', interactions: ['click'] }];
  const result = req.mergeContexts({}, { frontendInteractions: interactions });
  assert.deepEqual(result.frontendInteractions, interactions);
});

test('mergeContexts sets errorScenarios from agentContext.errorScenariosToTest', () => {
  const req = new AgentContextRequester();
  const errors = [{ scenario: 'invalid email', trigger: 'submit form', expectedError: 'Invalid email' }];
  const result = req.mergeContexts({}, { errorScenariosToTest: errors });
  assert.deepEqual(result.errorScenarios, errors);
});

test('mergeContexts sets testDataSuggestions from agentContext', () => {
  const req = new AgentContextRequester();
  const data = { validUser: { email: 'test@example.com' } };
  const result = req.mergeContexts({}, { testDataSuggestions: data });
  assert.deepEqual(result.testDataSuggestions, data);
});
