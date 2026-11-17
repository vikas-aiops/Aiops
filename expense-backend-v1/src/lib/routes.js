'use strict';

// Every route template the app serves, with its methods, read once from the
// Express router stack. Used by code that answers BEFORE or WITHOUT normal
// routing but still needs the route template:
//   - failure injection labels an injected 500 with the route it was for;
//   - the 404 handler tells "wrong method on a real route" (405) apart from
//     "no such route" (404).

// '/api/expenses/:id' -> /^\/api\/expenses\/[^/]+\/?$/
function templateToRegex(template) {
  const escaped = template
    .split('/')
    .map((part) => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${escaped}/?$`);
}

const regexCache = new Map();
function matches(template, path) {
  if (template === '*') return true;
  if (!regexCache.has(template)) regexCache.set(template, templateToRegex(template));
  return regexCache.get(template).test(path);
}

function collectRoutes(router, out = []) {
  for (const layer of router?.stack ?? []) {
    if (layer.route && typeof layer.route.path === 'string') {
      out.push({ path: layer.route.path, methods: layer.route.methods || {} });
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      collectRoutes(layer.handle, out);
    }
  }
  return out;
}

// Cached per app: routes are all registered before the first request.
const tables = new WeakMap();
function routeTable(app) {
  if (!tables.has(app)) tables.set(app, collectRoutes(app.router));
  return tables.get(app);
}

// The template of the route that serves req.method on req.path, or null.
function templateFor(req) {
  const method = req.method.toLowerCase();
  const hit = routeTable(req.app).find((r) => (r.methods[method] || r.methods._all) && matches(r.path, req.path));
  return hit ? hit.path : null;
}

// For a path that exists under OTHER methods: its template and the methods it
// does allow (HEAD included wherever GET is, as Express serves HEAD for GET).
// null if no route has this path at all.
function allowedMethods(req) {
  const hits = routeTable(req.app).filter((r) => matches(r.path, req.path));
  if (hits.length === 0) return null;
  const methods = new Set();
  for (const r of hits) {
    for (const [m, on] of Object.entries(r.methods)) if (on && m !== '_all') methods.add(m.toUpperCase());
  }
  if (methods.has('GET')) methods.add('HEAD');
  return { template: hits[0].path, methods: [...methods].sort() };
}

module.exports = { matches, templateFor, allowedMethods };
