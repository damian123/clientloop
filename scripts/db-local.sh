#!/usr/bin/env bash
set -euo pipefail

PG_FORMULA="${CLIENTLOOP_PG_FORMULA:-postgresql@17}"
DB_NAME="${CLIENTLOOP_DB_NAME:-clientloop}"
DB_USER="${CLIENTLOOP_DB_USER:-clientloop}"
DB_PASSWORD="${CLIENTLOOP_DB_PASSWORD:-clientloop}"

usage() {
  printf 'Usage: %s {install|start|stop|status|setup}\n' "$0" >&2
}

require_brew() {
  if ! command -v brew >/dev/null 2>&1; then
    printf 'Homebrew is required for local PostgreSQL setup.\n' >&2
    exit 1
  fi
}

postgres_bin_path() {
  local prefix
  prefix="$(brew --prefix "$PG_FORMULA" 2>/dev/null || true)"
  if [ -n "$prefix" ]; then
    printf '%s/bin\n' "$prefix"
  fi
}

validate_identifier() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    printf '%s must be a PostgreSQL-safe identifier, got: %s\n' "$name" "$value" >&2
    exit 1
  fi
}

ensure_path() {
  local bin_path
  bin_path="$(postgres_bin_path)"
  if [ -n "$bin_path" ]; then
    export PATH="$bin_path:$PATH"
  fi
}

install_postgres() {
  require_brew
  if brew list --versions "$PG_FORMULA" >/dev/null 2>&1; then
    printf '%s is already installed.\n' "$PG_FORMULA"
    return
  fi

  brew install "$PG_FORMULA"
}

start_postgres() {
  install_postgres
  ensure_path
  brew services start "$PG_FORMULA"
}

stop_postgres() {
  require_brew
  brew services stop "$PG_FORMULA"
}

status_postgres() {
  require_brew
  brew services list | grep -E "^(Name|$PG_FORMULA)[[:space:]]"
}

wait_for_postgres() {
  ensure_path
  for _ in $(seq 1 30); do
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  printf 'PostgreSQL did not become ready on localhost:5432.\n' >&2
  exit 1
}

setup_database() {
  validate_identifier "CLIENTLOOP_DB_NAME" "$DB_NAME"
  validate_identifier "CLIENTLOOP_DB_USER" "$DB_USER"
  start_postgres
  wait_for_postgres

  psql -h localhost -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '$DB_USER', '$DB_PASSWORD')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER')\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', '$DB_USER', '$DB_PASSWORD')\gexec

SELECT format('CREATE DATABASE %I OWNER %I', '$DB_NAME', '$DB_USER')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$DB_NAME')\gexec

SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', '$DB_NAME', '$DB_USER')\gexec
SQL

  printf 'Local database is ready: postgresql://%s:%s@localhost:5432/%s?schema=public\n' \
    "$DB_USER" "$DB_PASSWORD" "$DB_NAME"
}

case "${1:-}" in
  install)
    install_postgres
    ;;
  start)
    start_postgres
    ;;
  stop)
    stop_postgres
    ;;
  status)
    status_postgres
    ;;
  setup)
    setup_database
    ;;
  *)
    usage
    exit 1
    ;;
esac
