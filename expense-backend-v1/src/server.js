'use strict';

const config = require('./config');
const { pool } = require('./db');
const { buildApp } = require('./app');
const { startMetricsServer } = require('./metrics/server');

const SHUTDOWN_GRACE_MS = 10_000;

const app = buildApp();
const server = app.listen(config.port, () => {
  console.log(`expense-backend listening on port ${config.port}, database ${config.db.host}:${config.db.port}/${config.db.name}`);
});

const metricsServer = startMetricsServer(config.metrics.port);
if (config.metrics.debugRawPath) {
  console.log(
    'WARNING: METRICS_DEBUG_RAW_PATH=true: HTTP metrics are labelled with raw request paths. ' +
      'This creates one series per distinct URL (cardinality lesson only). Never use it in a real deployment.',
  );
}

server.on('error', (err) => {
  console.error(`error: HTTP server failed: ${err.message}`);
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down (up to ${SHUTDOWN_GRACE_MS / 1000}s for in-flight requests)`);

  // Hard stop if in-flight requests don't finish in time.
  const timer = setTimeout(() => {
    console.error('error: in-flight requests did not finish in time, closing them');
    server.closeAllConnections();
  }, SHUTDOWN_GRACE_MS);
  timer.unref();

  // Stop accepting new connections; the callback runs once in-flight requests finish.
  server.close(async () => {
    clearTimeout(timer);
    await new Promise((resolve) => metricsServer.close(resolve));
    try {
      await pool.end();
    } catch (err) {
      console.error(`error: closing the DB pool failed: ${err.message}`);
    }
    console.log('shutdown complete');
    process.exit(0);
  });
  // Keep-alive sockets with no request in flight would otherwise hold close()
  // open until the client gives up on them. Close each one as soon as its
  // last in-flight response has been sent.
  server.closeIdleConnections();
  setInterval(() => server.closeIdleConnections(), 100).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
