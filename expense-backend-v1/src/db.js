'use strict';

const mysql = require('mysql2/promise');
const config = require('./config');
const faults = require('./lib/faults');
const { instrumentQuery, registerPoolGauges } = require('./metrics/db');

// One pool for the whole process. Its size comes from DB_POOL_SIZE so the
// connection-pool saturation lessons can change it without a code change.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  connectionLimit: config.db.poolSize,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 3000, // fail fast when MySQL is down instead of hanging requests
  enableKeepAlive: true,
  timezone: 'Z',
  dateStrings: true, // DATE -> 'YYYY-MM-DD', no JS timezone shifts
  decimalNumbers: true, // DECIMAL -> number (amounts fit easily in a double)
  charset: 'utf8mb4',
});

// Store and compare every DATETIME in UTC, whatever the MySQL server's own
// timezone is, so CURRENT_TIMESTAMP defaults and UTC_TIMESTAMP() agree.
pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

registerPoolGauges(pool);

// Every query in the app goes through this wrapper. The caller names the
// operation (select/insert/update/delete/other) and the main table explicitly;
// the SQL text is never parsed for labels. `executor` is the pool by default,
// or a transaction connection.
//   const rows = await timedQuery({ operation: 'select', table: 'expenses' }, sql, params);
async function timedQuery(labels, sql, params = [], executor = pool) {
  return instrumentQuery(labels, async () => {
    await applyDbFaults();
    const [rows] = await executor.query(sql, params);
    return rows;
  });
}

// Failure injection (debug API only): DB latency and errors happen inside the
// timed span, so they show up in the DB metrics.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function applyDbFaults() {
  const { latencyMs, errorRate } = faults.flags.db;
  if (latencyMs > 0) await sleep(latencyMs);
  if (errorRate > 0 && Math.random() < errorRate) {
    const err = new Error('Injected database failure (debug API)');
    err.code = 'INJECTED_DB_FAILURE';
    throw err;
  }
}

// Runs fn(conn) inside a transaction on a dedicated connection.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, timedQuery, withTransaction };
