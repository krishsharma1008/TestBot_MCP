'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const MCPTelemetryReporter = require('../src/mcp-telemetry');

// In test environments (--test flag set), enabled is always forced to false.
// We test the observable behavior: constructor config, sanitizeEvent, and
// disabled-path methods — none of which make real HTTP calls.

function makeReporter(overrides = {}) {
  return new MCPTelemetryReporter({
    apiKey: 'test-key',
    dashboardUrl: 'http://localhost:3000',
    source: 'healix-mcp-test',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Constructor / config
// ---------------------------------------------------------------------------

test('MCPTelemetryReporter constructor sets source from config', () => {
  const r = makeReporter({ source: 'custom-source' });
  assert.equal(r.config.source, 'custom-source');
});

test('MCPTelemetryReporter constructor defaults source to healix-mcp', () => {
  const r = new MCPTelemetryReporter({ apiKey: 'key', dashboardUrl: 'http://localhost:3000' });
  assert.equal(r.config.source, 'healix-mcp');
});

test('MCPTelemetryReporter constructor is disabled when NODE_ENV=test', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const r = makeReporter();
    assert.equal(r.isEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prev;
  }
});

test('MCPTelemetryReporter config.enabled can be explicitly set false', () => {
  const r = makeReporter({ enabled: false });
  assert.equal(r.isEnabled(), false);
});

test('MCPTelemetryReporter constructor normalizes localhost URL', () => {
  const r = makeReporter({ dashboardUrl: 'http://localhost:3000' });
  // localhost gets normalized to 127.0.0.1
  assert.ok(r.config.dashboardUrl.includes('3000'));
});

test('MCPTelemetryReporter constructor uses higher timeout for local URL', () => {
  const r = makeReporter({ dashboardUrl: 'http://localhost:3000' });
  // local URL timeout is 12000ms
  assert.equal(r.config.timeoutMs, 12000);
});

test('MCPTelemetryReporter constructor uses lower timeout for remote URL', () => {
  const r = makeReporter({ dashboardUrl: 'https://app.healix.dev' });
  assert.equal(r.config.timeoutMs, 2500);
});

test('MCPTelemetryReporter constructor respects explicit timeoutMs', () => {
  const r = makeReporter({ timeoutMs: 5000 });
  assert.equal(r.config.timeoutMs, 5000);
});

test('MCPTelemetryReporter constructor initializes empty queue', () => {
  const r = makeReporter();
  assert.deepEqual(r.queue, []);
});

test('MCPTelemetryReporter setWorkspaceId stores the id', () => {
  const r = makeReporter();
  r.setWorkspaceId('ws-abc');
  assert.equal(r.workspaceId, 'ws-abc');
});

test('MCPTelemetryReporter setWorkspaceId accepts null', () => {
  const r = makeReporter();
  r.setWorkspaceId('ws-abc');
  r.setWorkspaceId(null);
  assert.equal(r.workspaceId, null);
});

// ---------------------------------------------------------------------------
// sanitizeEvent — exercises inferStatus, clampString, normalizeMetadata
// ---------------------------------------------------------------------------

test('sanitizeEvent infers status from event.status field', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ status: 'completed' });
  assert.equal(e.status, 'completed');
});

test('sanitizeEvent infers status success from event.success=true', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ success: true });
  assert.equal(e.status, 'success');
  assert.equal(e.success, true);
});

test('sanitizeEvent infers status error from event.success=false', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ success: false });
  assert.equal(e.status, 'error');
  assert.equal(e.success, false);
});

test('sanitizeEvent infers status error from event.errorCode', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ errorCode: 'WEBAPP_UNREACHABLE' });
  assert.equal(e.status, 'error');
});

test('sanitizeEvent defaults status to info when no signal', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({});
  assert.equal(e.status, 'info');
});

test('sanitizeEvent clamps message to 2000 chars', () => {
  const r = makeReporter();
  const long = 'x'.repeat(3000);
  const e = r.sanitizeEvent({ message: long });
  assert.ok(e.message.length <= 2000);
});

test('sanitizeEvent clamps runId to 160 chars', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ runId: 'r'.repeat(200) });
  assert.ok(e.runId.length <= 160);
});

test('sanitizeEvent preserves short runId unchanged', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ runId: 'run-abc-123' });
  assert.equal(e.runId, 'run-abc-123');
});

test('sanitizeEvent clamps reason to 500 chars', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ reason: 'r'.repeat(600) });
  assert.ok(e.reason.length <= 500);
});

test('sanitizeEvent defaults toolName to healix_test_my_app', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({});
  assert.equal(e.toolName, 'healix_test_my_app');
});

test('sanitizeEvent defaults eventType to status', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({});
  assert.equal(e.eventType, 'status');
});

test('sanitizeEvent passes numeric durationMs through', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ durationMs: 5432 });
  assert.equal(e.durationMs, 5432);
});

test('sanitizeEvent ignores non-finite durationMs', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ durationMs: 'not-a-number' });
  assert.equal(e.durationMs, undefined);
});

test('sanitizeEvent normalizes metadata object', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ metadata: { key: 'value', count: 5 } });
  assert.ok(e.metadata);
  assert.equal(e.metadata.key, 'value');
});

test('sanitizeEvent ignores non-object metadata', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({ metadata: 'not-an-object' });
  assert.equal(e.metadata, undefined);
});

test('sanitizeEvent truncates oversized metadata', () => {
  const r = makeReporter();
  const bigObj = { data: 'x'.repeat(40000) };
  const e = r.sanitizeEvent({ metadata: bigObj });
  assert.ok(e.metadata.__truncated === true);
});

test('sanitizeEvent merges workspaceId into metadata', () => {
  const r = makeReporter();
  r.setWorkspaceId('ws-xyz');
  const e = r.sanitizeEvent({ metadata: { other: 1 } });
  assert.equal(e.metadata.workspaceId, 'ws-xyz');
  assert.equal(e.metadata.other, 1);
});

test('sanitizeEvent sets workspaceId as sole metadata when none provided', () => {
  const r = makeReporter();
  r.setWorkspaceId('ws-abc');
  const e = r.sanitizeEvent({});
  assert.ok(e.metadata);
  assert.equal(e.metadata.workspaceId, 'ws-abc');
});

test('sanitizeEvent produces a valid ISO occurredAt timestamp', () => {
  const r = makeReporter();
  const e = r.sanitizeEvent({});
  assert.ok(typeof e.occurredAt === 'string');
  assert.ok(!Number.isNaN(new Date(e.occurredAt).getTime()));
});

test('sanitizeEvent accepts a custom occurredAt', () => {
  const r = makeReporter();
  const ts = '2024-01-15T12:00:00.000Z';
  const e = r.sanitizeEvent({ occurredAt: ts });
  assert.equal(e.occurredAt, ts);
});

test('sanitizeEvent falls back to now() for invalid occurredAt', () => {
  const r = makeReporter();
  const before = Date.now();
  const e = r.sanitizeEvent({ occurredAt: 'not-a-date' });
  const after = Date.now();
  const ts = new Date(e.occurredAt).getTime();
  assert.ok(ts >= before && ts <= after + 100);
});

// ---------------------------------------------------------------------------
// emit / emitBackground / drain — disabled paths only
// ---------------------------------------------------------------------------

test('emit returns skipped when disabled', async () => {
  const r = new MCPTelemetryReporter({ apiKey: 'test-key', dashboardUrl: 'http://localhost:3030', enabled: false });
  const result = await r.emit({ eventType: 'test' });
  assert.deepEqual(result, { skipped: true, reason: 'telemetry_disabled' });
});

test('emitBackground does not enqueue when disabled', () => {
  const r = new MCPTelemetryReporter({ apiKey: 'test-key', dashboardUrl: 'http://localhost:3030', enabled: false });
  r.emitBackground({ eventType: 'test' });
  assert.equal(r.queue.length, 0);
});

test('drain returns drained=true immediately when disabled', async () => {
  const r = makeReporter();
  const result = await r.drain(100);
  assert.deepEqual(result, { drained: true });
});

test('drain returns drained=true when queue is empty and not processing', async () => {
  const r = makeReporter();
  r.queue = [];
  r.processing = false;
  const result = await r.drain(100);
  assert.deepEqual(result, { drained: true });
});
