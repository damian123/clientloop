#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
DEFAULT_BACKUP_DIR="$ROOT_DIR/backups/postgres"
BACKUP_DIR="${BACKUP_DIR:-$DEFAULT_BACKUP_DIR}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  DATABASE_URL="$(awk -F= '/^DATABASE_URL=/ { print substr($0, index($0,$2)) }' "$ENV_FILE" | tail -n 1)"
  DATABASE_URL="${DATABASE_URL%\"}"
  DATABASE_URL="${DATABASE_URL#\"}"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required. Set it in the environment or $ENV_FILE." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but was not found on PATH." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
output="$BACKUP_DIR/clientloop-postgres-$timestamp.dump"
tmp_output="$output.tmp"
latest="$BACKUP_DIR/clientloop-postgres-latest.dump"
pg_dump_url="$DATABASE_URL"
pg_dump_url="${pg_dump_url%%\?schema=*}"

rm -f "$tmp_output"
pg_dump \
  --dbname="$pg_dump_url" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$tmp_output"

mv "$tmp_output" "$output"

ln -f "$output" "$latest"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ && "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" \
    -name 'clientloop-postgres-*.dump' \
    -type f \
    -mtime +"$RETENTION_DAYS" \
    -delete
fi

echo "$output"
