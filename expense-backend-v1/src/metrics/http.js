'use strict';

// HTTP RED metrics. Names follow naming-conventions §6.3: standard HTTP metric
// names with no prefix; labels method, route (template) and status_code.

const { client, register } = require('./registry');

// 0.3 s is the course latency SLO threshold, so it must be a bucket boundary.
const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5];

const requestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'HTTP requests completed, by method, route template and status code.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const requestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by method, route template and status code.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: DURATION_BUCKETS,
  registers: [register],
});

const requestsInFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'HTTP requests currently being served.',
  registers: [register],
});

// Kept on purpose for the lesson on why quantiles can't be aggregated across
// instances; the histogram above covers the same data the right way.
const requestDurationSummary = new client.Summary({
  name: 'http_request_duration_summary_seconds',
  help: 'HTTP request duration quantiles per instance (do not aggregate across instances).',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.99],
  maxAgeSeconds: 600,
  ageBuckets: 5,
  registers: [register],
});

// Health checks (ALB, readiness probes) are excluded from every HTTP metric so
// they don't distort the request rate.
const EXCLUDED_PATHS = new Set(['/api/health/live', '/api/health/ready']);

function isExcludedPath(path) {
  const normalised = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return EXCLUDED_PATHS.has(normalised);
}

// The route label is the matched route TEMPLATE ('/api/expenses/:id'), never
// the raw path. A request that matched no route is 'unmatched'.
// `req.metricsRoute` lets middleware that answers before routing (failure
// injection) name the route the request was for.
function routeLabel(req) {
  if (req.route && typeof req.route.path === 'string') return (req.baseUrl || '') + req.route.path;
  if (typeof req.metricsRoute === 'string') return req.metricsRoute;
  return 'unmatched';
}

// rawPath: METRICS_DEBUG_RAW_PATH. Labels with the raw path, which creates one
// series per distinct URL. Cardinality lesson only.
function httpMetricsMiddleware({ rawPath = false } = {}) {
  return function httpMetrics(req, res, next) {
    const path = req.path;
    if (isExcludedPath(path)) return next();

    requestsInFlight.inc();
    const start = process.hrtime.bigint();
    let done = false;

    const finish = (completed) => {
      if (done) return; // 'close' always follows 'finish'; count once
      done = true;
      requestsInFlight.dec();
      // An aborted request (client went away before the response was sent)
      // only leaves the in-flight gauge; it has no real status code to record.
      if (!completed) return;

      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const method = req.method.toUpperCase();
      const route = rawPath ? path : routeLabel(req);
      const labels = { method, route, status_code: String(res.statusCode) };
      requestsTotal.inc(labels);
      requestDuration.observe(labels, seconds);
      requestDurationSummary.observe({ method, route }, seconds);
    };

    res.on('finish', () => finish(true));
    res.on('close', () => finish(res.writableFinished));
    return next();
  };
}

module.exports = { httpMetricsMiddleware, routeLabel, isExcludedPath, DURATION_BUCKETS };
