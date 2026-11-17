'use strict';

// Unit tests for the metrics helpers: route labels and DB wrapper labels.
// No database or network needed. Run with: npm test

// config.js validates env at load time; give it harmless values.
Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_NAME: 'expense_test',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { routeLabel, isExcludedPath, httpMetricsMiddleware, DURATION_BUCKETS } = require('../src/metrics/http');
const { dbLabels } = require('../src/metrics/db');
const { register } = require('../src/metrics/registry');
const { timedQuery, pool } = require('../src/db');

test.after(() => pool.end());

// ---- route label -------------------------------------------------------------

test('route label is baseUrl + route template', () => {
  assert.equal(routeLabel({ baseUrl: '', route: { path: '/api/expenses/:id' } }), '/api/expenses/:id');
  assert.equal(routeLabel({ baseUrl: '/api', route: { path: '/expenses/:id' } }), '/api/expenses/:id');
});

test('route label never uses the raw path', () => {
  const req = { baseUrl: '', path: '/api/expenses/123', originalUrl: '/api/expenses/123?x=1', route: { path: '/api/expenses/:id' } };
  assert.equal(routeLabel(req), '/api/expenses/:id');
});

test('unmatched requests are labelled "unmatched"', () => {
  assert.equal(routeLabel({ baseUrl: '', path: '/api/nope/42' }), 'unmatched');
  assert.equal(routeLabel({ baseUrl: '', path: '/favicon.ico', route: undefined }), 'unmatched');
});

test('a pre-routing answer can name its route via req.metricsRoute', () => {
  assert.equal(routeLabel({ baseUrl: '', path: '/api/expenses/7', metricsRoute: '/api/expenses/:id' }), '/api/expenses/:id');
});

test('health endpoints are excluded, nothing else is', () => {
  assert.equal(isExcludedPath('/api/health/live'), true);
  assert.equal(isExcludedPath('/api/health/ready'), true);
  assert.equal(isExcludedPath('/api/health/ready/'), true);
  assert.equal(isExcludedPath('/api/health'), false);
  assert.equal(isExcludedPath('/api/expenses'), false);
  assert.equal(isExcludedPath('/'), false);
});

test('histogram buckets include the 0.3 s latency SLO threshold', () => {
  assert.ok(DURATION_BUCKETS.includes(0.3));
});

// ---- middleware --------------------------------------------------------------

function fakeReqRes(path, method = 'GET') {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.writableFinished = false;
  return { req: { path, method, baseUrl: '' }, res };
}

async function sampleValue(name, labels = {}) {
  const metric = await register.getSingleMetric(name).get();
  const hit = metric.values.find((v) => Object.entries(labels).every(([k, val]) => v.labels[k] === val));
  return hit ? hit.value : 0;
}

test('middleware skips health checks entirely', async () => {
  const mw = httpMetricsMiddleware();
  const before = await sampleValue('http_requests_in_flight');
  let called = false;
  const { req, res } = fakeReqRes('/api/health/live');
  mw(req, res, () => {
    called = true;
  });
  assert.ok(called);
  assert.equal(await sampleValue('http_requests_in_flight'), before);
  assert.equal(res.listenerCount('finish'), 0);
});

test('middleware records template, status and decrements in-flight exactly once', async () => {
  const mw = httpMetricsMiddleware();
  const { req, res } = fakeReqRes('/api/expenses/42', 'put');
  mw(req, res, () => {});
  assert.equal(await sampleValue('http_requests_in_flight'), 1);
  req.route = { path: '/api/expenses/:id' }; // set by Express routing
  res.statusCode = 404;
  res.writableFinished = true;
  res.emit('finish');
  res.emit('close');
  assert.equal(await sampleValue('http_requests_in_flight'), 0);
  assert.equal(await sampleValue('http_requests_total', { method: 'PUT', route: '/api/expenses/:id', status_code: '404' }), 1);
});

test('aborted request decrements in-flight but records no status', async () => {
  const mw = httpMetricsMiddleware();
  const { req, res } = fakeReqRes('/api/budgets');
  mw(req, res, () => {});
  res.emit('close'); // client went away, no finish
  assert.equal(await sampleValue('http_requests_in_flight'), 0);
  assert.equal(await sampleValue('http_requests_total', { route: 'unmatched', method: 'GET' }), 0);
});

test('raw-path mode labels with the raw path (cardinality demo)', async () => {
  const mw = httpMetricsMiddleware({ rawPath: true });
  const { req, res } = fakeReqRes('/api/expenses/987');
  mw(req, res, () => {});
  req.route = { path: '/api/expenses/:id' };
  res.writableFinished = true;
  res.emit('finish');
  assert.equal(await sampleValue('http_requests_total', { route: '/api/expenses/987' }), 1);
});

// ---- DB wrapper labels -------------------------------------------------------

test('dbLabels keeps known values and maps everything else to "other"', () => {
  assert.deepEqual(dbLabels({ operation: 'select', table: 'expenses' }), { operation: 'select', table: 'expenses' });
  assert.deepEqual(dbLabels({ operation: 'insert', table: 'budgets' }), { operation: 'insert', table: 'budgets' });
  assert.deepEqual(dbLabels({ operation: 'SELECT', table: 'expenses e' }), { operation: 'other', table: 'other' });
  assert.deepEqual(dbLabels({ operation: 'drop', table: 'users; --' }), { operation: 'other', table: 'other' });
  assert.deepEqual(dbLabels(), { operation: 'other', table: 'other' });
});

test('timedQuery records duration under the caller-given labels', async () => {
  const executor = { query: async () => [[{ ok: 1 }]] };
  const rows = await timedQuery({ operation: 'update', table: 'categories' }, 'UPDATE whatever SET x = 1', [], executor);
  assert.deepEqual(rows, [{ ok: 1 }]);
  const metric = await register.getSingleMetric('expense_db_query_duration_seconds').get();
  const countSeries = metric.values.find(
    (v) => v.metricName === 'expense_db_query_duration_seconds_count' && v.labels.operation === 'update' && v.labels.table === 'categories',
  );
  assert.equal(countSeries.value, 1);
});

test('timedQuery counts errors under the same labels and rethrows', async () => {
  const executor = {
    query: async () => {
      throw new Error('boom');
    },
  };
  await assert.rejects(timedQuery({ operation: 'delete', table: 'expenses' }, 'DELETE ...', [], executor), /boom/);
  assert.equal(await sampleValue('expense_db_query_errors_total', { operation: 'delete', table: 'expenses' }), 1);
});

test('SQL text never leaks into DB labels', async () => {
  const executor = { query: async () => [[]] };
  await timedQuery({ operation: 'select', table: 'users' }, 'SELECT * FROM secret_table WHERE email = "a@b.c"', [], executor);
  const text = await register.metrics();
  assert.ok(!text.includes('secret_table'));
  assert.ok(!text.includes('a@b.c'));
});
