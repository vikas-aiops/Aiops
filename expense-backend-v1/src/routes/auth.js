'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { timedQuery } = require('../db');
const { requireAuth, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { validate, conflict, unauthenticated, sessionEnded } = require('../middleware/errors');
const { z } = require('../lib/validation');
const { recordLogin, recordRegistration } = require('../metrics/business');

const router = express.Router();
const BCRYPT_COST = 10;

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(255, 'Email must be at most 255 characters')
  .pipe(z.email({ error: 'Enter a valid email address' }));

const displayName = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters');

const signupSchema = z.object({
  email,
  password: z
    .string({ error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  displayName,
});

const signinSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

const updateMeSchema = z.object({ displayName });

function toUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function loadUser(id) {
  const rows = await timedQuery({ operation: 'select', table: 'users' }, 'SELECT id, email, display_name, created_at, last_login_at FROM users WHERE id = ?',
    [id],
  );
  // Only ever called with the session's own user id: if that row is gone, the
  // session is what's broken (401 + cookie cleared), not a missing resource.
  if (rows.length === 0) throw sessionEnded();
  return toUser(rows[0]);
}

router.post('/api/auth/signup', async (req, res) => {
  const input = validate(signupSchema, req.body ?? {});
  const hash = await bcrypt.hash(input.password, BCRYPT_COST);
  let result;
  try {
    result = await timedQuery({ operation: 'insert', table: 'users' }, 'INSERT INTO users (email, password_hash, display_name, last_login_at) VALUES (?, ?, ?, UTC_TIMESTAMP())',
      [input.email, hash, input.displayName],
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw conflict('An account with this email already exists. Sign in instead.', 'email_taken');
    }
    throw err;
  }
  recordRegistration();
  setAuthCookie(res, result.insertId);
  res.status(201).json({ user: await loadUser(result.insertId) });
});

router.post('/api/auth/signin', async (req, res) => {
  let input;
  try {
    input = validate(signinSchema, req.body ?? {});
  } catch (err) {
    recordLogin(false);
    throw err;
  }
  const rows = await timedQuery({ operation: 'select', table: 'users' }, 'SELECT id, password_hash FROM users WHERE email = ?', [input.email]);
  const ok = rows.length === 1 && (await bcrypt.compare(input.password, rows[0].password_hash));
  if (!ok) {
    recordLogin(false);
    throw unauthenticated('Email or password is incorrect');
  }
  recordLogin(true);

  await timedQuery({ operation: 'update', table: 'users' }, 'UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [rows[0].id]);
  setAuthCookie(res, rows[0].id);
  res.json({ user: await loadUser(rows[0].id) });
});

router.post('/api/auth/signout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

router.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: await loadUser(req.user.id) });
});

router.put('/api/auth/me', requireAuth, async (req, res) => {
  const input = validate(updateMeSchema, req.body ?? {});
  await timedQuery({ operation: 'update', table: 'users' }, 'UPDATE users SET display_name = ? WHERE id = ?', [input.displayName, req.user.id]);
  res.json({ user: await loadUser(req.user.id) });
});

module.exports = router;
