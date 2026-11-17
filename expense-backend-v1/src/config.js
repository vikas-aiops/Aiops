'use strict';

// Every environment variable the app uses is read and validated here, and
// nowhere else. Missing or invalid values stop the process at startup with a
// clear message instead of failing on the first request.

const errors = [];

function required(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    errors.push(`${name} is required`);
    return '';
  }
  return value;
}

function optional(name, fallback) {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}

function integer(name, fallback, { min, max }) {
  const raw = optional(name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
  }
  return value;
}

function boolean(name, fallback) {
  const raw = optional(name, String(fallback)).toLowerCase();
  if (raw !== 'true' && raw !== 'false') {
    errors.push(`${name} must be "true" or "false" (got "${raw}")`);
  }
  return raw === 'true';
}

const config = {
  port: integer('PORT', 8080, { min: 1, max: 65535 }),
  db: {
    host: required('DB_HOST'),
    port: integer('DB_PORT', 3306, { min: 1, max: 65535 }),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    poolSize: integer('DB_POOL_SIZE', 10, { min: 1, max: 500 }),
  },
  jwtSecret: required('JWT_SECRET'),
  cookieSecure: boolean('COOKIE_SECURE', true),
  enableDebugApi: boolean('ENABLE_DEBUG_API', false),
  debugToken: optional('DEBUG_TOKEN', ''),
  metrics: {
    // Separate metrics server. 9101 is the backend metrics port for the course.
    port: integer('METRICS_PORT', 9101, { min: 1, max: 65535 }),
    // DANGEROUS, cardinality lesson only: label HTTP metrics with the raw path.
    debugRawPath: boolean('METRICS_DEBUG_RAW_PATH', false),
  },
  // Git ref the deployment was built from, shown in expense_backend_build_info.
  appRef: optional('APP_REF', 'unknown'),
};

if (config.jwtSecret && config.jwtSecret.length < 32) {
  errors.push('JWT_SECRET must be at least 32 characters');
}
if (config.enableDebugApi && config.debugToken.length < 8) {
  errors.push('DEBUG_TOKEN (at least 8 characters) is required when ENABLE_DEBUG_API=true');
}

if (config.metrics.port === config.port) {
  errors.push(`METRICS_PORT must differ from PORT (both are ${config.port})`);
}

if (errors.length > 0) {
  console.error(`config error: ${errors.join('; ')}`);
  process.exit(1);
}

module.exports = config;
