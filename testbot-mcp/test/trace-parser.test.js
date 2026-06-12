'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const {
  parseTrace,
  resolveTracePath,
  _parseTraceEvents,
  _summariseEvents,
  _extractBodyText,
  _extractByTag,
} = require('../src/failure-triage/trace-parser');

// ---------------------------------------------------------------------------
// resolveTracePath
// ---------------------------------------------------------------------------

test('resolveTracePath returns null for null artifacts', () => {
  assert.equal(resolveTracePath(null, '/project'), null);
  assert.equal(resolveTracePath(undefined, '/project'), null);
});

test('resolveTracePath returns null for empty traces array', () => {
  assert.equal(resolveTracePath({ traces: [] }, '/project'), null);
});

test('resolveTracePath returns null when candidate paths do not exist on disk', () => {
  const artifacts = {
    traces: [
      { path: 'traces/nonexistent-test-trace.zip' },
    ],
  };
  assert.equal(resolveTracePath(artifacts, '/nonexistent/project'), null);
});

test('resolveTracePath returns null when trace entry has no path fields', () => {
  const artifacts = {
    traces: [{ somethingElse: 'irrelevant' }],
  };
  assert.equal(resolveTracePath(artifacts, '/project'), null);
});

test('resolveTracePath handles non-array traces gracefully', () => {
  assert.equal(resolveTracePath({ traces: null }, '/project'), null);
  assert.equal(resolveTracePath({ traces: 'not-an-array' }, '/project'), null);
});

// ---------------------------------------------------------------------------
// parseTrace — error paths (no actual zip needed)
// ---------------------------------------------------------------------------

test('parseTrace returns parseError for null path', async () => {
  const result = await parseTrace(null);
  assert.ok(result.parseError, 'expected parseError to be set');
  assert.equal(result.failedAction, null);
  assert.ok(Array.isArray(result.networkAtFailure));
  assert.ok(Array.isArray(result.consoleAtFailure));
});

test('parseTrace returns parseError for undefined path', async () => {
  const result = await parseTrace(undefined);
  assert.ok(result.parseError);
});

test('parseTrace returns parseError for non-existent file path', async () => {
  const result = await parseTrace('/totally/nonexistent/trace-file-xyz.zip');
  assert.ok(result.parseError);
  assert.equal(result.failedAction, null);
});

test('parseTrace returns empty-evidence shape on missing file', async () => {
  const result = await parseTrace('/no/such/file.zip');
  assert.ok('failedAction' in result);
  assert.ok('domAtFailure' in result);
  assert.ok('networkAtFailure' in result);
  assert.ok('consoleAtFailure' in result);
  assert.equal(result.failedAction, null);
  assert.deepEqual(result.networkAtFailure, []);
  assert.deepEqual(result.consoleAtFailure, []);
});

test('parseTrace never throws — always returns an object', async () => {
  let threw = false;
  let result;
  try {
    result = await parseTrace('/bad/path/trace.zip');
  } catch {
    threw = true;
  }
  assert.equal(threw, false, 'parseTrace should never throw');
  assert.ok(result && typeof result === 'object');
});

test('parseTrace returns parseError trace_missing for empty string path', async () => {
  const result = await parseTrace('');
  assert.ok(result.parseError);
});

// ---------------------------------------------------------------------------
// Structural contract tests — the returned object shape
// ---------------------------------------------------------------------------

test('parseTrace result always has required shape keys', async () => {
  const result = await parseTrace('/nonexistent.zip');
  const requiredKeys = ['failedAction', 'domAtFailure', 'networkAtFailure', 'consoleAtFailure', 'preFailureScreenshot'];
  for (const key of requiredKeys) {
    assert.ok(key in result, `Expected key '${key}' in parseTrace result`);
  }
});

test('parseTrace domAtFailure shape is consistent', async () => {
  const result = await parseTrace('/nonexistent.zip');
  assert.ok(typeof result.domAtFailure === 'object');
  assert.ok('bodyTextSample' in result.domAtFailure);
  assert.ok('visibleButtons' in result.domAtFailure);
  assert.ok('visibleInputs' in result.domAtFailure);
  assert.ok(Array.isArray(result.domAtFailure.visibleButtons));
  assert.ok(Array.isArray(result.domAtFailure.visibleInputs));
});

// ---------------------------------------------------------------------------
// _parseTraceEvents — pure NDJSON parser
// ---------------------------------------------------------------------------

test('_parseTraceEvents returns empty array for null input', () => {
  assert.deepEqual(_parseTraceEvents(null), []);
});

test('_parseTraceEvents returns empty array for empty string', () => {
  assert.deepEqual(_parseTraceEvents(''), []);
});

test('_parseTraceEvents returns empty array for non-string input', () => {
  assert.deepEqual(_parseTraceEvents(42), []);
  assert.deepEqual(_parseTraceEvents({}), []);
});

test('_parseTraceEvents parses a single NDJSON line', () => {
  const events = _parseTraceEvents('{"type":"action","method":"click"}\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'action');
  assert.equal(events[0].method, 'click');
});

test('_parseTraceEvents parses multiple NDJSON lines', () => {
  const text = '{"type":"action"}\n{"type":"after","error":"locator not found"}\n{"type":"resource"}';
  const events = _parseTraceEvents(text);
  assert.equal(events.length, 3);
});

test('_parseTraceEvents tolerates malformed lines (skips them)', () => {
  const text = '{"type":"action"}\nNOT_VALID_JSON\n{"type":"console"}';
  const events = _parseTraceEvents(text);
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'action');
  assert.equal(events[1].type, 'console');
});

test('_parseTraceEvents skips blank lines', () => {
  const text = '{"type":"a"}\n\n\n{"type":"b"}';
  const events = _parseTraceEvents(text);
  assert.equal(events.length, 2);
});

test('_parseTraceEvents handles Windows line endings (CRLF)', () => {
  const text = '{"type":"a"}\r\n{"type":"b"}\r\n';
  const events = _parseTraceEvents(text);
  assert.equal(events.length, 2);
});

// ---------------------------------------------------------------------------
// _summariseEvents — event stream analyser
// ---------------------------------------------------------------------------

test('_summariseEvents returns empty summary for null input', () => {
  const s = _summariseEvents(null);
  assert.equal(s.failedAction, null);
  assert.deepEqual(s.networkAtFailure, []);
  assert.deepEqual(s.consoleAtFailure, []);
});

test('_summariseEvents returns empty summary for empty array', () => {
  const s = _summariseEvents([]);
  assert.equal(s.failedAction, null);
});

test('_summariseEvents finds failedAction from "after" event with error', () => {
  const events = [
    { type: 'before', method: 'click' },
    { type: 'after', method: 'click', error: { message: 'Element not found' } },
  ];
  const s = _summariseEvents(events);
  assert.ok(s.failedAction !== null);
  assert.equal(s.failedAction.name, 'click');
  assert.ok(s.failedAction.errorText.includes('Element not found'));
});

test('_summariseEvents finds failedAction from "action" event with error', () => {
  const events = [
    { type: 'action', apiName: 'locator.fill', error: 'timeout exceeded' },
  ];
  const s = _summariseEvents(events);
  assert.ok(s.failedAction !== null);
  assert.ok(s.failedAction.errorText.includes('timeout exceeded'));
});

test('_summariseEvents captures selector from failed action', () => {
  const events = [
    { type: 'after', method: 'click', params: { selector: '#submit-btn' }, error: { message: 'timeout' } },
  ];
  const s = _summariseEvents(events);
  assert.equal(s.failedAction.selector, '#submit-btn');
});

test('_summariseEvents captures url from failed action', () => {
  const events = [
    { type: 'after', method: 'goto', params: { url: 'https://example.com/login' }, error: { message: 'net::ERR_CONNECTION_REFUSED' } },
  ];
  const s = _summariseEvents(events);
  assert.equal(s.failedAction.url, 'https://example.com/login');
});

test('_summariseEvents collects network events before failure', () => {
  const events = [
    { type: 'resource', metadata: { request: { url: 'https://api.example.com/users', method: 'GET' }, response: { status: 200 } } },
    { type: 'resource', metadata: { request: { url: 'https://api.example.com/items', method: 'POST' }, response: { status: 404 } } },
    { type: 'after', method: 'click', error: { message: 'fail' } },
  ];
  const s = _summariseEvents(events);
  assert.equal(s.networkAtFailure.length, 2);
  assert.equal(s.networkAtFailure[0].url, 'https://api.example.com/users');
  assert.equal(s.networkAtFailure[1].status, 404);
});

test('_summariseEvents collects console events before failure', () => {
  const events = [
    { type: 'console', text: 'Error: undefined is not a function' },
    { type: 'console', text: 'Warning: deprecated API' },
    { type: 'after', method: 'click', error: { message: 'fail' } },
  ];
  const s = _summariseEvents(events);
  assert.equal(s.consoleAtFailure.length, 2);
  assert.ok(s.consoleAtFailure[0].includes('undefined is not a function'));
});

test('_summariseEvents caps networkAtFailure at 10 entries', () => {
  const events = [];
  for (let i = 0; i < 15; i++) {
    events.push({ type: 'resource', metadata: { request: { url: `https://api.example.com/r${i}`, method: 'GET' }, response: { status: 200 } } });
  }
  events.push({ type: 'after', method: 'click', error: { message: 'fail' } });
  const s = _summariseEvents(events);
  assert.ok(s.networkAtFailure.length <= 10);
});

test('_summariseEvents caps consoleAtFailure at 10 entries', () => {
  const events = [];
  for (let i = 0; i < 15; i++) {
    events.push({ type: 'console', text: `log line ${i}` });
  }
  events.push({ type: 'after', method: 'click', error: { message: 'fail' } });
  const s = _summariseEvents(events);
  assert.ok(s.consoleAtFailure.length <= 10);
});

test('_summariseEvents extracts DOM from frame-snapshot before failure', () => {
  const events = [
    { type: 'frame-snapshot', snapshot: { html: '<html><body><button>Submit</button></body></html>' } },
    { type: 'after', method: 'click', error: { message: 'fail' } },
  ];
  const s = _summariseEvents(events);
  assert.ok(s.domAtFailure.bodyTextSample.includes('Submit'));
});

test('_summariseEvents extracts visibleButtons from frame-snapshot HTML', () => {
  const events = [
    { type: 'frame-snapshot', snapshot: { html: '<body><button>Login</button><button>Cancel</button></body>' } },
    { type: 'after', error: 'fail' },
  ];
  const s = _summariseEvents(events);
  assert.ok(s.domAtFailure.visibleButtons.includes('Login'));
  assert.ok(s.domAtFailure.visibleButtons.includes('Cancel'));
});

test('_summariseEvents clamps error text to 600 chars', () => {
  const longError = 'x'.repeat(1000);
  const events = [
    { type: 'after', error: longError },
  ];
  const s = _summariseEvents(events);
  assert.ok(s.failedAction !== null);
  assert.ok(s.failedAction.errorText.length <= 600);
});

// ---------------------------------------------------------------------------
// _extractBodyText — HTML body text extractor
// ---------------------------------------------------------------------------

test('_extractBodyText extracts inner text from <body>', () => {
  const html = '<html><body>  Hello   World  </body></html>';
  const text = _extractBodyText(html);
  assert.equal(text, 'Hello World');
});

test('_extractBodyText strips HTML tags', () => {
  const html = '<body><h1>Title</h1><p>Some <strong>bold</strong> text</p></body>';
  const text = _extractBodyText(html);
  assert.ok(text.includes('Title'));
  assert.ok(text.includes('Some'));
  assert.ok(text.includes('bold'));
  assert.ok(text.includes('text'));
  assert.ok(!text.includes('<'));
});

test('_extractBodyText falls back to stripping all tags when no body tag', () => {
  const html = '<div><p>Content here</p></div>';
  const text = _extractBodyText(html);
  assert.ok(text.includes('Content here'));
});

test('_extractBodyText returns empty string for null input', () => {
  assert.equal(_extractBodyText(null), '');
});

test('_extractBodyText returns empty string for empty string', () => {
  assert.equal(_extractBodyText(''), '');
});

test('_extractBodyText collapses multiple whitespace to single space', () => {
  const html = '<body>A    B\t\tC\n\nD</body>';
  const text = _extractBodyText(html);
  assert.equal(text, 'A B C D');
});

// ---------------------------------------------------------------------------
// _extractByTag — HTML tag content extractor
// ---------------------------------------------------------------------------

test('_extractByTag extracts button text', () => {
  const html = '<div><button>Click me</button><button>Cancel</button></div>';
  const buttons = _extractByTag(html, 'button', 10);
  assert.equal(buttons.length, 2);
  assert.ok(buttons.includes('Click me'));
  assert.ok(buttons.includes('Cancel'));
});

test('_extractByTag returns empty array when tag not found', () => {
  assert.deepEqual(_extractByTag('<div>no buttons</div>', 'button', 5), []);
});

test('_extractByTag respects the limit parameter', () => {
  const html = '<button>A</button><button>B</button><button>C</button>';
  const result = _extractByTag(html, 'button', 2);
  assert.equal(result.length, 2);
});

test('_extractByTag applies transform function when provided', () => {
  // _extractByTag uses <tag>...</tag> pattern — use non-void tags (label, not input)
  const html = '<label for="email">Email</label><label for="password">Password</label>';
  const labels = _extractByTag(html, 'label', 10, (match) => {
    const m = /for=["']?([^"'\s>]+)/i.exec(match);
    return m ? m[1] : 'unnamed';
  });
  assert.ok(labels.includes('email'));
  assert.ok(labels.includes('password'));
});

test('_extractByTag strips inner tags from button content', () => {
  const html = '<button><span>Submit</span></button>';
  const buttons = _extractByTag(html, 'button', 5);
  assert.equal(buttons[0], 'Submit');
});

test('_extractByTag skips entries with empty inner text (without transform)', () => {
  const html = '<button>   </button><button>Real</button>';
  const buttons = _extractByTag(html, 'button', 10);
  assert.ok(buttons.length === 1 && buttons[0] === 'Real', `Expected ['Real'], got ${JSON.stringify(buttons)}`);
});

test('_extractByTag handles nested same-tag gracefully (outer content is captured)', () => {
  const html = '<button>Outer <span>inner</span></button>';
  const buttons = _extractByTag(html, 'button', 5);
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0].includes('Outer'));
});
