const assert = require('node:assert/strict');
const test = require('node:test');

const { parseCliArgs, runTestMyAppFromCli, usage } = require('../src/cli');

test('parseCliArgs parses supported Healix test-my-app flags', () => {
  assert.deepEqual(parseCliArgs([
    '--projectPath', '.',
    '--baseURL=http://localhost:3000',
    '--port', '3000',
    '--testType', 'frontend',
    '--headless', 'false',
    '--browserMode', 'chromium',
    '--coverageProfile', 'balanced',
    '--generateTests', 'true',
    '--aiFailureAnalysis', 'yes',
    '--openDashboard', '0',
    '--force',
  ]), {
    projectPath: '.',
    baseURL: 'http://localhost:3000',
    port: 3000,
    testType: 'frontend',
    headless: false,
    browserMode: 'chromium',
    coverageProfile: 'balanced',
    generateTests: true,
    aiFailureAnalysis: true,
    openDashboard: false,
    force: true,
  });
});

test('parseCliArgs rejects unknown flags and invalid enum values', () => {
  assert.throws(() => parseCliArgs(['--unknown', 'value']), /Unknown flag/);
  assert.throws(() => parseCliArgs(['--testType', 'mobile']), /Invalid value/);
  assert.throws(() => parseCliArgs(['--port', 'abc']), /Invalid number/);
});

test('runTestMyAppFromCli validates and delegates to handleTestMyApp', async () => {
  const calls = [];
  class FakeServer {
    async validateApiKey() {
      calls.push(['validateApiKey']);
    }

    async handleTestMyApp(args) {
      calls.push(['handleTestMyApp', args]);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, runId: 'run-1' }) }] };
    }
  }

  let stdout = '';
  const result = await runTestMyAppFromCli(FakeServer, ['--projectPath', '.', '--port', '3000'], {
    stdout: { write: (value) => { stdout += value; } },
  });

  assert.equal(result.content[0].type, 'text');
  assert.deepEqual(calls, [
    ['validateApiKey'],
    ['handleTestMyApp', { projectPath: '.', port: 3000 }],
  ]);
  assert.match(stdout, /run-1/);
});

test('usage documents the direct terminal command', () => {
  assert.match(usage(), /healix-mcp test-my-app/);
});
