'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { unauthenticated } = require('./errors');

const COOKIE_NAME = 'expense_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  };
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: TOKEN_TTL_SECONDS * 1000 });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

// Stateless auth: the user id comes only from the signed JWT, never from the
// request body or query string.
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next(unauthenticated());
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('bad subject');
    req.user = { id };
    return next();
  } catch {
    return next(unauthenticated('Your session has expired. Sign in again.'));
  }
}

module.exports = { requireAuth, setAuthCookie, clearAuthCookie, COOKIE_NAME };
