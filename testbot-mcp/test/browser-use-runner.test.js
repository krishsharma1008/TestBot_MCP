const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const runnerPath = path.join(__dirname, '..', 'scripts', 'browser_use_runner.py');
const driverPath = path.join(__dirname, '..', 'src', 'browser-use-driver.js');

function pythonCmd() {
  for (const cmd of ['python3', 'python']) {
    const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (res.status === 0) return cmd;
  }
  return null;
}

function buildTask({ preauthVerified = false, withCredentials = true, knownRoutes = null, prdFeatures = null } = {}) {
  const cmd = pythonCmd();
  if (!cmd) return null;
  const knownRoutesArg = knownRoutes ? JSON.stringify(knownRoutes) : 'None';
  const prdFeaturesArg = prdFeatures ? JSON.stringify(prdFeatures) : 'None';
  const script = `
import importlib.util, json
spec = importlib.util.spec_from_file_location("browser_use_runner", ${JSON.stringify(runnerPath)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
task = mod._build_task(
  "http://localhost:8080",
  "user@example.test" if ${withCredentials ? 'True' : 'False'} else None,
  "Password123!" if ${withCredentials ? 'True' : 'False'} else None,
  preauth_verified=${preauthVerified ? 'True' : 'False'},
  known_routes=${knownRoutesArg},
  prd_features=${prdFeaturesArg},
)
print(json.dumps(task))
`;
  const res = spawnSync(cmd, ['-c', script], { encoding: 'utf-8' });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout);
}

test('browser-use task skips credential resubmission when pre-auth storageState exists', (t) => {
  const task = buildTask({ preauthVerified: true, withCredentials: true });
  if (!task) {
    t.skip('python not available');
    return;
  }

  assert.match(task, /already verified at least one role/i);
  assert.match(task, /Do NOT submit the login form/i);
  assert.match(task, /Playwright storageState pass/i);
});

test('browser-use task bounds login retries for async auth chrome apps', (t) => {
  const task = buildTask({ preauthVerified: false, withCredentials: true });
  if (!task) {
    t.skip('python not available');
    return;
  }

  assert.match(task, /Submit the login form at most ONE time/i);
  assert.match(task, /do\s+NOT retry login just because the navbar still shows Login\/Sign up/i);
  assert.match(task, /repaint auth chrome asynchronously/i);
});

test('browser-use defaults to gpt-5.5-mini for JSON-stable exploration', () => {
  const runnerSource = fs.readFileSync(runnerPath, 'utf-8');
  const driverSource = fs.readFileSync(driverPath, 'utf-8');

  assert.match(runnerSource, /HEALIX_BROWSER_USE_MODEL",\s*"gpt-5\.5-mini"/);
  assert.match(runnerSource, /"gpt-5\.5-mini":\s*"gpt-5-mini"/);
  assert.match(runnerSource, /_provider_model\(model\)/);
  assert.match(driverSource, /HEALIX_BROWSER_USE_MODEL:\s*process\.env\.HEALIX_BROWSER_USE_MODEL\s*\|\|\s*'gpt-5\.5-mini'/);
});

test('browser-use gap-fill prompt includes already-mapped routes list when known_routes provided', (t) => {
  const task = buildTask({
    withCredentials: false,
    knownRoutes: ['/dashboard', '/settings', '/reports'],
  });
  if (!task) {
    t.skip('python not available');
    return;
  }
  assert.match(task, /ALREADY MAPPED/i);
  assert.match(task, /\/dashboard/);
  assert.match(task, /\/settings/);
  assert.match(task, /\/reports/);
  assert.match(task, /GAP-FILL/i);
  assert.match(task, /routes NOT in that list/i);
});

test('browser-use gap-fill prompt includes PRD features when prd_features provided', (t) => {
  const task = buildTask({
    withCredentials: false,
    knownRoutes: ['/dashboard'],
    prdFeatures: ['User Dashboard', 'Report Builder'],
  });
  if (!task) {
    t.skip('python not available');
    return;
  }
  assert.match(task, /PRD features to cover/i);
  assert.match(task, /User Dashboard/);
  assert.match(task, /Report Builder/);
});

test('browser-use task falls back to full navigation prompt when no known_routes', (t) => {
  const task = buildTask({ withCredentials: false, knownRoutes: null });
  if (!task) {
    t.skip('python not available');
    return;
  }
  // Legacy mode: no gap-fill block, standard navigation instruction.
  assert.doesNotMatch(task, /ALREADY MAPPED/i);
  assert.match(task, /NAVIGATE.*visit up to 12 distinct routes/is);
});

test('browser-use max_steps default raised to 20 and ceiling raised to 30', () => {
  const runnerSource = fs.readFileSync(runnerPath, 'utf-8');
  // Default and fallback both set to 20.
  assert.match(runnerSource, /max_steps = 20/);
  // Ceiling raised to 30 in the min/max clamp.
  assert.match(runnerSource, /min\(30,/);
  // Env var default is also 20.
  assert.match(runnerSource, /HEALIX_BROWSER_USE_MAX_STEPS",\s*"20"/);
});

test('browser-use driver serializes knownRoutes and prdFeatures as env vars', () => {
  const driverSource = fs.readFileSync(driverPath, 'utf-8');
  assert.match(driverSource, /HEALIX_KNOWN_ROUTES/);
  assert.match(driverSource, /HEALIX_PRD_FEATURES/);
  // Cap at 60 paths.
  assert.match(driverSource, /slice\(0,\s*60\)/);
});
