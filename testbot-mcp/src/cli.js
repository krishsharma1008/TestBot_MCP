const BOOLEAN_FLAGS = new Set([
  'headless',
  'generateTests',
  'aiFailureAnalysis',
  'openDashboard',
  'force',
]);

const STRING_FLAGS = new Set([
  'projectPath',
  'baseURL',
  'testType',
  'browserMode',
  'coverageProfile',
]);

const NUMBER_FLAGS = new Set(['port']);

const ALLOWED_FLAGS = new Set([
  ...BOOLEAN_FLAGS,
  ...STRING_FLAGS,
  ...NUMBER_FLAGS,
]);

const ENUM_VALUES = {
  testType: new Set(['frontend', 'backend', 'both']),
  browserMode: new Set(['chromium', 'smoke-matrix', 'full-matrix']),
  coverageProfile: new Set(['balanced', 'qa-max', 'exhaustive']),
};

function parseBoolean(value, flagName) {
  if (value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid boolean value for --${flagName}: ${value}`);
}

function parseCliArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const withoutPrefix = token.slice(2);
    const separatorIndex = withoutPrefix.indexOf('=');
    const key = separatorIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? undefined : withoutPrefix.slice(separatorIndex + 1);

    if (!ALLOWED_FLAGS.has(key)) {
      throw new Error(`Unknown flag: --${key}`);
    }

    if (value === undefined && argv[i + 1] && !argv[i + 1].startsWith('--')) {
      value = argv[i + 1];
      i += 1;
    }

    if (BOOLEAN_FLAGS.has(key)) {
      args[key] = parseBoolean(value, key);
      continue;
    }

    if (value === undefined) {
      throw new Error(`Missing value for --${key}`);
    }

    if (NUMBER_FLAGS.has(key)) {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`Invalid number value for --${key}: ${value}`);
      }
      args[key] = parsed;
      continue;
    }

    if (ENUM_VALUES[key] && !ENUM_VALUES[key].has(value)) {
      throw new Error(`Invalid value for --${key}: ${value}`);
    }

    args[key] = value;
  }

  return args;
}

function formatToolResult(result) {
  if (!result || !Array.isArray(result.content)) {
    return JSON.stringify(result, null, 2);
  }

  return result.content
    .map((item) => (item && item.type === 'text' ? item.text : JSON.stringify(item)))
    .join('\n');
}

async function runTestMyAppFromCli(HealixMCPServer, argv, streams = process) {
  const args = parseCliArgs(argv);
  const server = new HealixMCPServer();

  if (typeof server.validateApiKey === 'function') {
    await server.validateApiKey();
  }

  const result = await server.handleTestMyApp(args);
  const output = formatToolResult(result);
  if (output) streams.stdout.write(`${output}\n`);
  return result;
}

function usage() {
  return [
    'Usage:',
    '  healix-mcp                         Start the MCP server (stdio)',
    '  healix-mcp test-my-app [options]   Start a Healix test run from the terminal',
    '',
    'Options:',
    '  --projectPath <path>',
    '  --baseURL <url>',
    '  --port <number>',
    '  --testType <frontend|backend|both>',
    '  --headless <true|false>',
    '  --browserMode <chromium|smoke-matrix|full-matrix>',
    '  --coverageProfile <balanced|qa-max|exhaustive>',
    '  --generateTests <true|false>',
    '  --aiFailureAnalysis <true|false>',
    '  --openDashboard <true|false>',
    '  --force <true|false>',
  ].join('\n');
}

module.exports = {
  parseCliArgs,
  runTestMyAppFromCli,
  usage,
};
