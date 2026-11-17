'use strict';

// Database metrics: query timing and errors (labelled by operation and table,
// passed explicitly by the caller, never parsed from SQL) and pool gauges.

const { client, register } = require('./registry');

const OPERATIONS = new Set(['select', 'insert', 'update', 'delete', 'other']);
const TABLES = new Set(['users', 'categories', 'expenses', 'budgets', 'other']);

const queryDuration = new client.Histogram({
  name: 'expense_db_query_duration_seconds',
  help: 'Database query duration in seconds, by operation and main table.',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

const queryErrors = new client.Counter({
  name: 'expense_db_query_errors_total',
  help: 'Database queries that failed, by operation and main table.',
  labelNames: ['operation', 'table'],
  registers: [register],
});

// Labels come from fixed lists only; anything else becomes "other", so a typo
// can never create a new series.
function dbLabels({ operation, table } = {}) {
  return {
    operation: OPERATIONS.has(operation) ? operation : 'other',
    table: TABLES.has(table) ? table : 'other',
  };
}

// Times fn() and records duration and errors under the given labels.
async function instrumentQuery(labels, fn) {
  const l = dbLabels(labels);
  const end = queryDuration.startTimer(l);
  try {
    return await fn();
  } catch (err) {
    queryErrors.inc(l);
    throw err;
  } finally {
    end();
  }
}

// ---- pool gauges -------------------------------------------------------------

// Size of one of mysql2's private pool collections, or null if unreadable.
function sizeOf(collection) {
  if (collection == null) return null;
  if (typeof collection.length === 'number') return collection.length;
  if (typeof collection.size === 'number') return collection.size;
  if (typeof collection.size === 'function') return collection.size();
  return null;
}

function registerPoolGauges(promisePool) {
  const core = promisePool.pool ?? promisePool;

  // Fallback if mysql2's private fields ever change: track pool events.
  const tracked = { active: 0, idle: 0, pending: 0 };
  core.on('connection', () => {
    tracked.idle += 1;
  });
  core.on('acquire', () => {
    tracked.active += 1;
    tracked.idle = Math.max(0, tracked.idle - 1);
    tracked.pending = Math.max(0, tracked.pending - 1);
  });
  core.on('release', () => {
    tracked.active = Math.max(0, tracked.active - 1);
    tracked.idle += 1;
  });
  core.on('enqueue', () => {
    tracked.pending += 1;
  });

  function read() {
    try {
      const all = sizeOf(core._allConnections);
      const free = sizeOf(core._freeConnections);
      const queued = sizeOf(core._connectionQueue);
      if (all !== null && free !== null && queued !== null) {
        return { active: Math.max(0, all - free), idle: free, pending: queued };
      }
    } catch {
      // fall through to the event-tracked values
    }
    return tracked;
  }

  new client.Gauge({
    name: 'expense_db_pool_connections',
    help: 'Connections in the MySQL pool, by state (active = checked out, idle = free).',
    labelNames: ['state'],
    registers: [register],
    collect() {
      try {
        const s = read();
        this.set({ state: 'active' }, s.active);
        this.set({ state: 'idle' }, s.idle);
      } catch {
        // never fail a scrape
      }
    },
  });

  new client.Gauge({
    name: 'expense_db_pool_pending_requests',
    help: 'Callers waiting for a free MySQL pool connection.',
    registers: [register],
    collect() {
      try {
        this.set(read().pending);
      } catch {
        // never fail a scrape
      }
    },
  });
}

module.exports = { instrumentQuery, registerPoolGauges, dbLabels, queryErrors };
