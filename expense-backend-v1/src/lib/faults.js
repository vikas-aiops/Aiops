'use strict';

// In-memory failure-injection flags, shared by the debug API (which sets them)
// and the code paths that apply them (HTTP fault middleware, DB wrapper).
// Nothing can set them unless ENABLE_DEBUG_API=true.

const flags = {
  latency: new Map(), // route template or '*' -> ms
  errors: new Map(), // route template or '*' -> rate 0..1
  db: { latencyMs: 0, errorRate: 0 },
};

function reset() {
  flags.latency.clear();
  flags.errors.clear();
  flags.db.latencyMs = 0;
  flags.db.errorRate = 0;
}

function state() {
  return {
    latency: Object.fromEntries(flags.latency),
    errors: Object.fromEntries(flags.errors),
    db: { ...flags.db },
  };
}

module.exports = { flags, reset, state };
