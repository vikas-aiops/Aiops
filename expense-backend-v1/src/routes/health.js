'use strict';

const express = require('express');
const { timedQuery } = require('../db');

const router = express.Router();
const READY_TIMEOUT_MS = 1000;

// Liveness: the process is up and serving HTTP. Deliberately no DB call, so a
// database outage never gets a healthy backend restarted.
router.get('/api/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness: can this instance serve real traffic? Needs SELECT 1 within 1s.
router.get('/api/health/ready', async (req, res) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`database did not answer within ${READY_TIMEOUT_MS}ms`)), READY_TIMEOUT_MS);
  });
  try {
    await Promise.race([timedQuery({ operation: 'select', table: 'other' }, 'SELECT 1'), timeout]);
    res.json({ status: 'ok', checks: { database: 'ok' } });
  } catch (err) {
    res.status(503).json({ status: 'unavailable', checks: { database: err.message } });
  } finally {
    clearTimeout(timer);
  }
});

module.exports = router;
