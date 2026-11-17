'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { httpMetricsMiddleware } = require('./metrics/http');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const categoryRoutes = require('./routes/categories');
const budgetRoutes = require('./routes/budgets');
const insightRoutes = require('./routes/insights');
const sampleDataRoutes = require('./routes/sample-data');
const debug = require('./routes/debug');

function buildApp() {
  const app = express();

  // Behind ALB -> nginx. Without this, req.secure is false and Express refuses
  // to send the Secure auth cookie.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Route convention: every router declares FULL parameterised paths
  // ('/api/expenses/:id') and is mounted at the root, so
  // req.baseUrl + req.route.path is the complete route template, used as the
  // metrics `route` label. Never build a route from a raw path.

  // ---------------------------------------------------------------------------
  // Middleware, in order. Keep this block together.
  //
  // 1. Metrics: first, so every request is timed, including body-parsing
  //    errors and injected latency. Health checks are excluded inside it.
  app.use(httpMetricsMiddleware({ rawPath: config.metrics.debugRawPath }));
  //
  // 2. Body parsing
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  //
  // 3. Routes
  //    Fault injection (failure lessons) runs just before the routes, and is
  //    only mounted when ENABLE_DEBUG_API=true. Otherwise /api/debug/* is a 404.
  if (config.enableDebugApi) {
    app.use(debug.faultInjection);
    app.use(debug.router);
  }
  app.use(healthRoutes);
  app.use(authRoutes);
  app.use(expenseRoutes);
  app.use(categoryRoutes);
  app.use(budgetRoutes);
  app.use(insightRoutes);
  app.use(sampleDataRoutes);
  //
  // 4. 404 for anything no route matched (route label "unmatched")
  app.use(notFoundHandler);
  //
  // 5. Central error handler (must be last)
  app.use(errorHandler);
  // ---------------------------------------------------------------------------

  return app;
}

module.exports = { buildApp };
