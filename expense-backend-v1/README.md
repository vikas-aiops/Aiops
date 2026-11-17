# expense-backend-v1

Expense app API: Node.js 24, Express 5, CommonJS, `mysql2` pool.
The `session-01` baseline is **Prometheus-instrumented** (`prom-client`, served
on a separate metrics port). Logs are plain `console.log` and there is no
tracing; those arrive as small diffs in later sessions.

## Run

```bash
npm ci --omit=dev
npm start            # node src/server.js
```

Configuration is **environment variables only** (read and validated in
`src/config.js`; the process exits with a clear message if one is missing):

| Variable                 | Default   | Notes |
|--------------------------|-----------|-------|
| `PORT`                   | `8080`    | |
| `DB_HOST`                | required  | |
| `DB_PORT`                | `3306`    | |
| `DB_NAME`                | required  | |
| `DB_USER`                | required  | |
| `DB_PASSWORD`            | required  | |
| `DB_POOL_SIZE`           | `10`      | mysql2 pool `connectionLimit` |
| `JWT_SECRET`             | required  | at least 32 characters |
| `COOKIE_SECURE`          | `true`    | set `false` only for plain-http local testing |
| `ENABLE_DEBUG_API`       | `false`   | mounts `/api/debug/*` (failure injection) |
| `DEBUG_TOKEN`            | empty     | required (8+ chars) when the debug API is on |
| `METRICS_PORT`           | `9101`    | separate Prometheus metrics server; must differ from `PORT` |
| `METRICS_DEBUG_RAW_PATH` | `false`   | **dangerous**, cardinality lesson only (see Metrics) |
| `APP_REF`                | `unknown` | git ref deployed, shown in `expense_backend_build_info` |

None of the new variables is required: with the unchanged infra env file the
app starts and serves metrics on 9101.

For local development, `npm run dev` loads `.env` if present (see `.env.example`).
Quote values containing `#`: Node's env-file parser treats an unquoted `#` as a comment.

On a VM, `/etc/expense/backend.env` (mode 600) with a systemd unit
`expense-backend.service` running `npm start` as user `expense` from
`/opt/expense/backend`. The unit and env file belong to the infra repo.

```bash
npm test             # unit tests (node:test), no database needed
npm run lint         # syntax check of every source file
```

## Routes (all under `/api`)

| Method | Route | |
|---|---|---|
| POST | `/api/auth/signup` | sets the auth cookie, 409 on duplicate email |
| POST | `/api/auth/signin` | updates `last_login_at` |
| POST | `/api/auth/signout` | clears the cookie |
| GET / PUT | `/api/auth/me` | current user / change display name |
| GET | `/api/expenses` | `page`, `limit` ≤ 100, `q`, `categoryIds`, `from`, `to`, `minAmount`, `maxAmount`, `sort=date\|amount`, `order=asc\|desc`; returns `items`, `total`, `sum` |
| POST | `/api/expenses` | body `{ amount, categoryId, expenseDate, description }` |
| PUT / DELETE | `/api/expenses/:id` | 404 unless it is the caller's |
| GET | `/api/expenses/summary` | `?month=YYYY-MM`; the heaviest endpoint |
| GET / POST | `/api/categories` | GET includes each category's spend for `?month=` |
| PUT | `/api/categories/:id` | custom categories only |
| GET | `/api/budgets` | `?month=YYYY-MM` |
| PUT | `/api/budgets/:categoryId` | `?month=`, body `{ amount }` (upsert) |
| GET | `/api/insights/trend` | `?months=6` |
| GET | `/api/insights/month` | `?month=YYYY-MM` |
| POST | `/api/sample-data` | ~3 months of data; 409 if the user has more than 20 expenses |
| GET | `/api/health/live` | 200 while the process is up (no DB call) |
| GET | `/api/health/ready` | 200 if `SELECT 1` answers within 1s, else 503 |

Every router declares **full parameterised paths** and is mounted at the root, so
`req.baseUrl + req.route.path` is the complete template (`/api/expenses/:id`),
used as the metrics `route` label.

Errors are always `{ "error": { "code", "message" } }`:

| Status | `code` | When |
|---|---|---|
| 400 | `validation_error`, `bad_request`, `invalid_category` | bad input or malformed JSON |
| 401 | `unauthenticated` | no or expired session cookie, wrong email/password |
| 401 | `session_ended` | cookie is valid but its user no longer exists; the cookie is cleared |
| 403 | `default_category` | signed in, but the action is not allowed (editing a default category) |
| 404 | `not_found` | no such route, or no such record **for this user** (other users' records are 404 too) |
| 405 | `method_not_allowed` | the route exists, not with this method; `Allow` header lists the methods |
| 409 | `email_taken`, `duplicate_category`, `sample_data_refused` | conflicts with existing data |
| 413 | `bad_request` | body over 100 kb |
| 500 | `internal_error` | anything unexpected, including MySQL being down |

In metrics, a 404 for an unknown path is labelled `route="unmatched"`; a 405 is
labelled with the route template it hit (e.g. `route="/api/auth/signup"`).

The metrics port (9101) answers `GET`/`HEAD /metrics` only: another method on
`/metrics` is 405, any other path 404. Scrapes are not counted in
`http_requests_total`; that metric covers the app port only.

Auth: JWT in the `expense_token` cookie (httpOnly, Secure, SameSite=Lax).
`trust proxy` is set to 1 because the app runs behind ALB → nginx.

## Metrics

A **separate** HTTP server on `METRICS_PORT` (default `9101`, bound to
`0.0.0.0`) serves only `GET /metrics` in Prometheus text format; every other
path is 404. The app port does not serve `/metrics`. On startup it logs
`metrics listening on :9101`.

```bash
curl -s localhost:${METRICS_PORT:-9101}/metrics | head
```

> **Nothing outside the VM can scrape this port yet.** The ALB never routes to
> it, and the backend security group doesn't allow it. The monitoring security
> group rule is added in the Session 1 lab.

### Custom metrics

| Name | Type | Labels | Meaning |
|---|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status_code` | Completed HTTP requests |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status_code` | Request latency. Buckets `0.01 0.025 0.05 0.1 0.2 0.3 0.5 1 2 5`; **0.3 s is the latency SLO threshold** |
| `http_requests_in_flight` | gauge | – | Requests being served right now |
| `http_request_duration_summary_seconds` | summary | `method`, `route` | p50/p90/p99 per instance over 10 min. Kept to show why quantiles **can't be aggregated** across instances; use the histogram for that |
| `expense_db_query_duration_seconds` | histogram | `operation`, `table` | DB query latency. Buckets `0.001 … 1` s |
| `expense_db_query_errors_total` | counter | `operation`, `table` | Failed DB queries |
| `expense_db_pool_connections` | gauge | `state` = `active` \| `idle` | Connections checked out / free in the pool |
| `expense_db_pool_pending_requests` | gauge | – | Callers waiting for a pool connection (saturation) |
| `expense_expenses_created_total` | counter | – | Expenses saved (sample data included) |
| `expense_amount_rupees_total` | counter | – | Rupees recorded in saved expenses (sample data included) |
| `expense_user_logins_total` | counter | `result` = `success` \| `failure` | Sign-in attempts |
| `expense_users_registered_total` | counter | – | Successful sign-ups |
| `expense_budgets_exceeded` | gauge | – | Current-month budgets over their limit, across all users. One aggregate query, cached 30 s, 2 s timeout; keeps its last value if the DB is down |
| `expense_backend_build_info` | gauge (always 1) | `version`, `git_ref`, `node_version` | Which build is running |

Plus the `prom-client` default process metrics with the prefix
`expense_backend_` (CPU, memory, event-loop lag, GC, file descriptors, handles).
No global labels are added: Prometheus adds `job`, `instance` and `tier` at
scrape time.

Label values:
- `route` is the route **template** (`/api/expenses/:id`); requests that match
  no route are `unmatched`. `status_code` is the numeric code as a string
  (`"200"`), `method` is uppercase.
- `operation` is `select` | `insert` | `update` | `delete` | `other`; `table` is
  `users` | `categories` | `expenses` | `budgets` | `other`. Both are written
  explicitly at each call site through `timedQuery({ operation, table }, sql, params)`
  in `src/db.js`; the SQL text is never parsed.
- `/api/health/live` and `/api/health/ready` are **excluded** from all HTTP
  metrics so load-balancer checks don't distort the request rate. (The
  readiness check's `SELECT 1` is still a DB query: `operation="select",table="other"`.)
- A request the client abandons before the response is sent leaves the
  in-flight gauge but isn't counted (it has no real status code).

### No high-cardinality labels

Every label value comes from a small, fixed set. **Never** put user IDs,
emails, expense IDs, raw paths, query strings, SQL text or category names in a
label: each distinct value creates a new time series, and unbounded values
eventually take Prometheus down.

> **`METRICS_DEBUG_RAW_PATH=true` is dangerous.** It labels HTTP metrics with
> the raw request path (`/api/expenses/1`, `/api/expenses/2`, …), creating one
> series per URL. It exists only for the cardinality lesson, prints a warning
> at startup, and must never be set in a real deployment. Unset it and restart
> to return to route templates.

### Code layout

```
src/metrics/
  registry.js   shared Registry, default metrics, build info
  http.js       HTTP middleware (counter, histogram, in-flight gauge, summary)
  db.js         DB timing wrapper + pool gauges
  business.js   business counters + budgets gauge
  server.js     the separate metrics HTTP server
```

The HTTP metrics middleware is the first middleware in `src/app.js`, before
body parsing, routing and failure injection, so injected latency is inside the
measured time.

## Failure injection (Session 7 onward)

Only when `ENABLE_DEBUG_API=true`, and every call needs `X-Debug-Token: $DEBUG_TOKEN`:

```bash
H='X-Debug-Token: <token>'
curl -XPOST -H "$H" -H 'content-type: application/json' localhost:8080/api/debug/latency -d '{"ms":800,"route":"/api/expenses/summary"}'
curl -XPOST -H "$H" -H 'content-type: application/json' localhost:8080/api/debug/errors  -d '{"rate":0.2}'
curl -XPOST -H "$H" -H 'content-type: application/json' localhost:8080/api/debug/db      -d '{"ms":200,"rate":0.1}'
curl        -H "$H" localhost:8080/api/debug/state
curl -XPOST -H "$H" localhost:8080/api/debug/reset
```

- `latency` / `errors`: omit `route` to affect every route. `ms: 0` or
  `rate: 0` removes that flag. Injected errors are 500s labelled with the route
  template the request was for.
- `db`: every DB query gets `ms` extra latency and fails with probability
  `rate`. Both show up in the `expense_db_*` metrics. `{}` turns it off.
- Flags are in memory, per process, and change without a restart.

## Where later instrumentation goes

- Logging is plain `console.log` / `console.error` on purpose (Session 15).
- `src/server.js` is the entry point for `node --require` (OTel, Session 16).

Graceful shutdown: on SIGTERM or SIGINT the server stops accepting connections,
waits up to 10s for in-flight requests, closes the metrics server and the pool,
and exits 0.
