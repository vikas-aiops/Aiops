'use strict';

// One shared Prometheus registry for the whole process. Every metric in
// src/metrics/* registers here, and the metrics server exposes it.

const client = require('prom-client');
const config = require('../config');
const { version } = require('../../package.json');

const register = new client.Registry();

// Process metrics: CPU, memory, event-loop lag, GC, file descriptors, handles.
// No global default labels: Prometheus adds job, instance and tier at scrape time.
client.collectDefaultMetrics({ register, prefix: 'expense_backend_' });

const buildInfo = new client.Gauge({
  name: 'expense_backend_build_info',
  help: 'Always 1. Labels describe the running build.',
  labelNames: ['version', 'git_ref', 'node_version'],
  registers: [register],
});
buildInfo.set({ version, git_ref: config.appRef, node_version: process.version }, 1);

module.exports = { client, register };
