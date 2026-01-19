#!/usr/bin/env bash
set -euo pipefail

# Wait for DB to be available
HOSTPORT=${DATABASE_URL:-}

echo "Starting entrypoint: running prisma migrate deploy (if DATABASE_URL configured)"
if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma migrate deploy || true
fi

echo "Starting app"
exec npm run start
