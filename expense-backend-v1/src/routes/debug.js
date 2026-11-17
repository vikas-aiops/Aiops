'use strict';

// Failure-injection hooks for the incident lessons (Session 7 onward).
// app.js mounts this router and middleware only when ENABLE_DEBUG_API=true;
// otherwise /api/debug/* does not exist (404) and no fault injection runs.
//
// Flags live in memory (src/lib/faults.js), per process, and change at runtime
// with no restart.

const crypto = require('node:crypto');
const express = require('express');
const config = require('../config');
const faults = require('../lib/faults');
const { AppError, validate, unauthenticated } = require('../middleware/errors');
const { z } = require('../lib/validation');
const { matches, templateFor } = require('../lib/routes');

const DEBUG_PREFIX = '/api/debug';
const { flags } = faults;

function lookup(map, path) {
  for (const [template, value] of map) {
    if (template !== '*' && matches(template, path)) return value;
  }
  return map.get('*');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs before every route (after the metrics middleware, so injected latency
// is inside the measured time). Debug endpoints themselves are never affected.
async function faultInjection(req, res, next) {
  if (req.path.startsWith(DEBUG_PREFIX)) return next();
  const delay = lookup(flags.latency, req.path);
  if (delay) await sleep(delay);
  const rate = lookup(flags.errors, req.path);
  if (rate && Math.random() < rate) {
    // Injected failures are answered before routing; label them with the
    // route the request was for.
    req.metricsRoute = templateFor(req) ?? 'unmatched';
    return next(new AppError(500, 'injected_failure', 'Injected failure (debug API)'));
  }
  return next();
}

function requireDebugToken(req, res, next) {
  const given = Buffer.from(String(req.get('X-Debug-Token') ?? ''));
  const expected = Buffer.from(config.debugToken);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return next(unauthenticated('Missing or wrong X-Debug-Token header'));
  }
  return next();
}

const routeField = z
  .string()
  .regex(/^\/api\/[A-Za-z0-9/:_-]*$/, 'route must be a route template such as /api/expenses/:id')
  .optional();

const router = express.Router();

router.post('/api/debug/latency', requireDebugToken, (req, res) => {
  const input = validate(
    z.object({
      ms: z.coerce.number().int('ms must be a whole number').min(0, 'ms must be 0 or more').max(60000, 'ms must be at most 60000'),
      route: routeField,
    }),
    req.body ?? {},
  );
  const key = input.route ?? '*';
  if (input.ms === 0) flags.latency.delete(key);
  else flags.latency.set(key, input.ms);
  res.json(faults.state());
});

router.post('/api/debug/errors', requireDebugToken, (req, res) => {
  const input = validate(
    z.object({
      rate: z.coerce.number().min(0, 'rate must be between 0 and 1').max(1, 'rate must be between 0 and 1'),
      route: routeField,
    }),
    req.body ?? {},
  );
  const key = input.route ?? '*';
  if (input.rate === 0) flags.errors.delete(key);
  else flags.errors.set(key, input.rate);
  res.json(faults.state());
});

// Database faults: every query gets the latency, and fails with probability rate.
router.post('/api/debug/db', requireDebugToken, (req, res) => {
  const input = validate(
    z.object({
      ms: z.coerce.number().int('ms must be a whole number').min(0, 'ms must be 0 or more').max(60000, 'ms must be at most 60000').default(0),
      rate: z.coerce.number().min(0, 'rate must be between 0 and 1').max(1, 'rate must be between 0 and 1').default(0),
    }),
    req.body ?? {},
  );
  flags.db.latencyMs = input.ms;
  flags.db.errorRate = input.rate;
  res.json(faults.state());
});

router.post('/api/debug/reset', requireDebugToken, (req, res) => {
  faults.reset();
  res.json(faults.state());
});

router.get('/api/debug/state', requireDebugToken, (req, res) => {
  res.json(faults.state());
});

module.exports = { router, faultInjection };
