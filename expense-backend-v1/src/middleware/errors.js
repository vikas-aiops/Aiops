'use strict';

const { allowedMethods } = require('../lib/routes');

// Every error response has the same shape: { error: { code, message } }.
// 4xx = the client's fault, 5xx = ours. The SLO sessions depend on that split
// being accurate, so only genuinely unexpected failures become 500.
//
//   400 validation_error / bad_request   input is wrong
//   401 unauthenticated / session_ended  no valid session
//   403 <code>                           signed in, but not allowed to do this
//   404 not_found                        no such route, or no such record for this user
//   405 method_not_allowed               the route exists, not with this method
//   409 <code>                           conflicts with existing data
//   413 / 415 bad_request                body too large / unsupported encoding
//   500 internal_error                   unexpected (includes MySQL being down)

class AppError extends Error {
  constructor(status, code, message, { clearSession = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.clearSession = clearSession;
  }
}

const badRequest = (message, code = 'validation_error') => new AppError(400, code, message);
const unauthenticated = (message = 'Sign in to continue') => new AppError(401, 'unauthenticated', message);
const forbidden = (message, code = 'forbidden') => new AppError(403, code, message);
const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);
const conflict = (message, code = 'conflict') => new AppError(409, code, message);

// The session cookie is validly signed, but its user is gone (e.g. the
// database was rebuilt while the browser kept the cookie). That is a session
// problem, not a missing resource: 401, and the stale cookie is cleared.
const sessionEnded = () =>
  new AppError(401, 'session_ended', 'Your session is no longer valid. Sign in again.', { clearSession: true });

// A foreign key on user_id failed: the session's user no longer exists.
// Constraint names: fk_expenses_user, fk_budgets_user, fk_categories_user.
const isMissingUserFk = (err) => err.code === 'ER_NO_REFERENCED_ROW_2' && /`fk_\w+_user`/.test(err.sqlMessage || err.message || '');

// Validates input with a zod schema; throws a 400 with the first issue's message.
function validate(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue.message);
  }
  return result.data;
}

// Reached when no route answered. If the path IS a route, just not for this
// method, that's 405 with an Allow header (labelled with the route template in
// metrics); otherwise 404 (labelled "unmatched").
function notFoundHandler(req, res) {
  const allowed = allowedMethods(req);
  if (allowed) {
    req.metricsRoute = allowed.template;
    res.set('Allow', allowed.methods.join(', '));
    return res.status(405).json({
      error: { code: 'method_not_allowed', message: `${req.method} is not supported on ${req.path}. Allowed: ${allowed.methods.join(', ')}` },
    });
  }
  return res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
}

function send(res, err) {
  if (err.clearSession) require('./auth').clearAuthCookie(res); // lazy: auth.js requires this file
  return res.status(err.status).json({ error: { code: err.code, message: err.message } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return send(res, err);

  if (isMissingUserFk(err)) return send(res, sessionEnded());

  // Errors raised by express.json(): malformed JSON (400), body too large (413),
  // unsupported charset or encoding (415), etc. Their status is already right.
  if (err.type && Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'Request body is not valid JSON' : err.message;
    return res.status(err.status).json({ error: { code: 'bad_request', message } });
  }

  console.error(`error: ${req.method} ${req.originalUrl} failed: ${err.code || err.name}: ${err.message}`);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: { code: 'internal_error', message: 'The server could not complete the request. Try again shortly.' } });
}

module.exports = {
  AppError,
  badRequest,
  unauthenticated,
  forbidden,
  notFound,
  conflict,
  sessionEnded,
  validate,
  notFoundHandler,
  errorHandler,
};
