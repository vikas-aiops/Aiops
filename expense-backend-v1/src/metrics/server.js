'use strict';

// Separate HTTP server for Prometheus: GET (and HEAD) /metrics only. Another
// method on /metrics is 405, any other path is 404.
// The ALB never routes here; access is the monitoring security group's job.
//
// Scrapes are NOT counted in http_requests_total: that metric is recorded by
// the Express app on PORT, and this server is not part of it. Prometheus
// records each scrape itself (up, scrape_duration_seconds, ...).

const http = require('node:http');
const { register } = require('./registry');

function startMetricsServer(port) {
  const server = http.createServer(async (req, res) => {
    const path = (req.url || '').split('?')[0];
    if (path !== '/metrics') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found. Metrics are at GET /metrics\n');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
      res.end(`${req.method} is not supported on /metrics. Use GET.\n`);
      return;
    }
    try {
      const body = await register.metrics();
      res.writeHead(200, { 'Content-Type': register.contentType });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (err) {
      console.error(`error: collecting metrics failed: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('metrics collection failed\n');
    }
  });

  server.on('error', (err) => {
    console.error(`error: metrics server failed: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`metrics listening on :${port}`);
  });
  return server;
}

module.exports = { startMetricsServer };
