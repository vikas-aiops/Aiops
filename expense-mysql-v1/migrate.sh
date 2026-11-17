#!/usr/bin/env bash
# Applies migrations/NNN_*.sql in order, each exactly once.
# Needs only bash and the mysql client: no Node.js on the MySQL VM.
#
# Connection settings (env vars):
#   DB_HOST      default 127.0.0.1
#   DB_PORT      default 3306
#   DB_NAME      default expense   (created if missing)
#   DB_USER      default root
#   DB_PASSWORD  default empty
#   MYSQL_BIN    default mysql     (path to the mysql client)
#
# Re-running is a no-op: applied versions are recorded in schema_migrations.
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-expense}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
MYSQL_BIN="${MYSQL_BIN:-mysql}"

if ! [[ "$DB_NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "migrate: DB_NAME may contain only letters, digits and underscores" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# The password travels via the environment, never on the command line (visible in ps).
export MYSQL_PWD="$DB_PASSWORD"
mysql_cmd=("$MYSQL_BIN" --protocol=TCP -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER"
           --default-character-set=utf8mb4 --batch --skip-column-names)

echo "migrate: target ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

"${mysql_cmd[@]}" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

"${mysql_cmd[@]}" "$DB_NAME" -e "CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/[0-9][0-9][0-9]_*.sql)
if [ "${#files[@]}" -eq 0 ]; then
  echo "migrate: no migration files found in $MIGRATIONS_DIR" >&2
  exit 1
fi

applied=0
skipped=0
for file in "${files[@]}"; do
  version="$(basename "$file" .sql)"
  count="$("${mysql_cmd[@]}" "$DB_NAME" -e "SELECT COUNT(*) FROM schema_migrations WHERE version = '${version}';" | tr -d '[:space:]')"
  if [ "$count" != "0" ]; then
    echo "  skip   ${version}"
    skipped=$((skipped + 1))
    continue
  fi

  # One mysql session per file: the file and its schema_migrations row run in a
  # single transaction. MySQL commits DDL implicitly, so for CREATE TABLE files
  # the guarantee is "recorded only if every statement succeeded": the mysql
  # client stops at the first error, so the INSERT below never runs on failure.
  # Every DDL file uses IF NOT EXISTS, so re-running after a fix is safe.
  if {
       echo "START TRANSACTION;"
       cat "$file"
       echo
       echo "INSERT INTO schema_migrations (version) VALUES ('${version}');"
       echo "COMMIT;"
     } | "${mysql_cmd[@]}" "$DB_NAME"; then
    echo "  apply  ${version}"
    applied=$((applied + 1))
  else
    echo "migrate: FAILED on ${version}; it was not recorded. Fix it and re-run." >&2
    exit 1
  fi
done

echo "migrate: done, ${applied} applied, ${skipped} skipped"
