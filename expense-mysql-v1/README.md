# expense-mysql-v1

Schema and migrations for the Expense app (MySQL 8). Plain SQL plus one shell
script, so the MySQL VM needs **no Node.js**: only `bash` and the `mysql` client.

## Contents

```
migrations/
  001_create_users.sql
  002_create_categories.sql
  003_create_expenses.sql
  004_seed_default_categories.sql   # the 10 system categories
  005_create_budgets.sql
seed/
  load-users.sql                    # optional, NOT applied by migrate.sh
migrate.sh
```

## Run migrations

```bash
DB_HOST=127.0.0.1 DB_PORT=3306 DB_NAME=expense DB_USER=root DB_PASSWORD='...' ./migrate.sh
```

| Variable      | Default     |                                       |
|---------------|-------------|---------------------------------------|
| `DB_HOST`     | `127.0.0.1` |                                       |
| `DB_PORT`     | `3306`      |                                       |
| `DB_NAME`     | `expense`   | created if missing (utf8mb4)          |
| `DB_USER`     | `root`      | needs CREATE / ALTER / INSERT         |
| `DB_PASSWORD` | empty       | passed via `MYSQL_PWD`, never argv    |
| `MYSQL_BIN`   | `mysql`     | path to the client                    |

- Creates `schema_migrations(version, applied_at)` if missing.
- Applies each `NNN_*.sql` **once**, in order; prints `apply` or `skip` per file.
- Re-running is a no-op. A failing file is not recorded; fix it and re-run.
- Each file runs in a transaction with its `schema_migrations` row. MySQL commits
  DDL implicitly, so every DDL file uses `IF NOT EXISTS` and is safe to re-run.

The app connects with a least-privilege user, for example:

```sql
CREATE USER 'expense'@'%' IDENTIFIED BY '<password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON expense.* TO 'expense'@'%';
```

## Schema

| Table        | Notes |
|--------------|-------|
| `users`      | unique `email`; `password_hash` (bcrypt); `last_login_at` |
| `categories` | `user_id NULL` = system default (read-only); otherwise a user's custom category; `icon` is a lucide icon name, `color` a hex |
| `expenses`   | `amount DECIMAL(10,2) > 0`, `expense_date DATE`; indexes `(user_id)`, `(user_id, expense_date)` |
| `budgets`    | `month` = first day of the month; `amount > 0`; unique `(user_id, category_id, month)` |

All tables are InnoDB, `utf8mb4`. The backend stores every `DATETIME` in UTC.

## Load-test users (Session 3)

`seed/load-users.sql` creates `loaduser01@lab.local` … `loaduser50@lab.local`,
all with the password **`LoadTest#2026`** (bcrypt, cost 10). Run it explicitly;
re-running leaves existing users untouched:

```bash
mysql -h <host> -u root -p expense < seed/load-users.sql
```

## Versioning

Students deploy tags, never `main`. `session-01` is the uninstrumented baseline.
