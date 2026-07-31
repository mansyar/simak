#!/bin/sh
set -eu

node .output/server/migrate.mjs &
migration_pid=$!

stop_migration() {
  kill -TERM "$migration_pid" 2>/dev/null || true
  wait "$migration_pid" 2>/dev/null || true
  exit 143
}

trap stop_migration TERM INT
wait "$migration_pid"
exec node .output/server/index.mjs
