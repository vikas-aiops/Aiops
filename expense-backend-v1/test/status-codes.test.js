'use strict';

// Status codes the app returns without touching the database: 404 vs 405,
// 401, 400/413, the session-ended mapping, and the metrics server.
// Run with: npm test

Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_NAME: 'expense_test',
  DB_USER: 'test',
  DB_PASSWORD: 'test',
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildApp } = require('../src/app');
const { errorHandler, forbidden } = require('../src/middleware/errors');
const { startMetricsServer } = require('../src/metrics/server');
const { register } = require('../src/metrics/registry');
const { pool } = require('../src/db');

let base;
let server;
let metricsServer;
let metricsBase;

test.before(async () => {
  server = buildApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;

  metricsServer = startMetricsServer(0);
  await new Promise((r) => metricsServer.once('listening', r));
  metricsBase = `http://127.0.0.1:${metricsServer.address().port}`;
});

test.after(async () => {
  server.close();
  metricsServer.close();
  await pool.end();
});

async function call(method, path, { body, headers = {}, url = base } = {}) {
  const res = await fetch(url + path, {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, headers: res.headers, json, text };
}

async function requestsTotal(labels) {
  const metric = await register.getSingleMetric('http_requests_total').get();
  const hit = metric.values.find((v) => Object.entries(labels).every(([k, val]) => v.labels[k] === val));
  return hit ? hit.value : 0;
}

// ---- 404 vs 405 ----------------------------------------------------------------

test('unknown path: 404 not_found, labelled "unmatched"', async () => {
  const before = await requestsTotal({ method: 'GET', route: 'unmatched', status_code: '404' });
  const r = await call('GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, 'not_found');
  assert.equal(await requestsTotal({ method: 'GET', route: 'unmatched', status_code: '404' }), before + 1);
});

test('known path, wrong method: 405 with Allow, labelled with the route template', async () => {
  const r = await call('GET', '/api/auth/signup');
  assert.equal(r.status, 405);
  assert.equal(r.json.error.code, 'method_not_allowed');
  assert.equal(r.headers.get('allow'), 'POST');
  assert.equal(await requestsTotal({ method: 'GET', route: '/api/auth/signup', status_code: '405' }), 1);
});

test('405 Allow lists every method of a parameterised route', async () => {
  const r = await call('POST', '/api/expenses/42');
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'DELETE, PUT');
});

test('405 Allow includes HEAD wherever GET is allowed', async () => {
  const r = await call('DELETE', '/api/categories');
  assert.equal(r.status, 405);
  assert.equal(r.headers.get('allow'), 'GET, HEAD, POST');
});

test('debug API is not mounted by default: 404, not 405', async () => {
  const r = await call('GET', '/api/debug/state');
  assert.equal(r.status, 404);
});

// ---- 401 / 400 / 413 ------------------------------------------------------------

test('no session cookie: 401 unauthenticated', async () => {
  const r = await call('GET', '/api/expenses');
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, 'unauthenticated');
});

test('malformed JSON: 400 bad_request', async () => {
  const r = await call('POST', '/api/auth/signin', { body: '{bad' });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'bad_request');
});

test('invalid input: 400 validation_error', async () => {
  const r = await call('POST', '/api/auth/signin', { body: JSON.stringify({ email: 'x' }) });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, 'validation_error');
});

test('body over 100 kb: 413', async () => {
  const r = await call('POST', '/api/auth/signin', { body: JSON.stringify({ email: 'a'.repeat(120_000) }) });
  assert.equal(r.status, 413);
});

// ---- error handler mappings ---------------------------------------------------------

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    cleared: [],
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    clearCookie(name) {
      this.cleared.push(name);
      return this;
    },
  };
}

test('user_id foreign key failure: 401 session_ended and the cookie is cleared', () => {
  const err = Object.assign(new Error('fk'), {
    code: 'ER_NO_REFERENCED_ROW_2',
    sqlMessage:
      'Cannot add or update a child row: a foreign key constraint fails (`expense`.`expenses`, CONSTRAINT `fk_expenses_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE)',
  });
  const res = fakeRes();
  errorHandler(err, { method: 'POST', originalUrl: '/api/expenses' }, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'session_ended');
  assert.deepEqual(res.cleared, ['expense_token']);
});

test('other foreign key failures stay 500', () => {
  const err = Object.assign(new Error('fk'), {
    code: 'ER_NO_REFERENCED_ROW_2',
    sqlMessage: 'a foreign key constraint fails (CONSTRAINT `fk_expenses_category` FOREIGN KEY (`category_id`) ...)',
  });
  const res = fakeRes();
  const origError = console.error;
  console.error = () => {};
  try {
    errorHandler(err, { method: 'POST', originalUrl: '/api/expenses' }, res, () => {});
  } finally {
    console.error = origError;
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.cleared, []);
});

test('forbidden() is a 403 with the given code', () => {
  const res = fakeRes();
  errorHandler(forbidden('Default categories cannot be changed', 'default_category'), {}, res, () => {});
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'default_category');
});

// ---- metrics server -----------------------------------------------------------------

test('metrics server: GET /metrics 200, HEAD 200 with no body', async () => {
  const get = await call('GET', '/metrics', { url: metricsBase });
  assert.equal(get.status, 200);
  assert.match(get.text, /http_requests_total/);
  const head = await call('HEAD', '/metrics', { url: metricsBase });
  assert.equal(head.status, 200);
  assert.equal(head.text, '');
});

test('metrics server: other method on /metrics is 405, other path is 404', async () => {
  const post = await call('POST', '/metrics', { url: metricsBase });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  assert.equal((await call('GET', '/', { url: metricsBase })).status, 404);
});

test('scrapes are not counted in http_requests_total', async () => {
  await call('GET', '/metrics', { url: metricsBase });
  const metric = await register.getSingleMetric('http_requests_total').get();
  assert.equal(metric.values.some((v) => v.labels.route === '/metrics'), false);
});
