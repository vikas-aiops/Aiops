// All API calls go to the relative base /api: nothing environment-specific is
// baked into the build. Auth is an httpOnly cookie, so every request includes
// credentials and no token is ever stored in JavaScript.

const BASE = '/api';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const FALLBACK_MESSAGES = {
  0: "Can't reach the server. Check your connection and try again.",
  400: 'Check the details you entered and try again.',
  401: 'Your session has ended. Sign in again.',
  403: "You can't make that change.",
  404: "We couldn't find that.",
  405: "That action isn't supported.",
  409: 'That conflicts with something that already exists.',
  413: 'That request is too large.',
  500: 'The server could not complete the request. Try again in a moment.',
  502: 'The server is not responding. Try again in a moment.',
  503: 'The service is temporarily unavailable. Try again in a moment.',
  504: 'The server took too long to respond. Try again in a moment.',
};

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'network_error', FALLBACK_MESSAGES[0]);
  }

  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. an HTML error page from a proxy)
  }

  if (!res.ok) {
    const message = data?.error?.message || FALLBACK_MESSAGES[res.status] || `Request failed (${res.status}). Try again.`;
    const error = new ApiError(res.status, data?.error?.code || `http_${res.status}`, message);
    // A 401 from anything other than sign-in / sign-up (wrong password, etc.)
    // means the session ended mid-use: expired cookie, or session_ended when
    // the account no longer exists. Let the auth layer send the user to sign in.
    if (res.status === 401 && path !== '/auth/signin' && path !== '/auth/signup') {
      window.dispatchEvent(new CustomEvent('expense:unauthenticated'));
    }
    throw error;
  }
  return data;
}

// Builds a query string from an object, skipping empty values.
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(','));
    } else search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
