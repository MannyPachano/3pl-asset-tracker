#!/bin/bash
# One-time setup: Postgres + DB + seed. Run from project root: ./scripts/setup-local.sh
# If Homebrew install fails, run: sudo chown -R $(whoami) /opt/homebrew

set -e
cd "$(dirname "$0")/.."

echo "==> 1. PostgreSQL"

if command -v docker &>/dev/null; then
  echo "    Using Docker..."
  docker start postgres-3pl 2>/dev/null || \
    docker run -d --name postgres-3pl -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=3pl_asset_tracker -p 5432:5432 postgres:16
  echo "    Waiting for Postgres..."
  sleep 3
else
  if ! command -v psql &>/dev/null; then
    echo "    Installing PostgreSQL (Homebrew)..."
    brew install postgresql@16
    export PATH="$(brew --prefix postgresql@16)/bin:$PATH"
  fi
  echo "    Starting Postgres..."
  brew services start postgresql@16 2>/dev/null || true
  sleep 2
  USER=$(whoami)
  if psql -h localhost -U "$USER" -d postgres -tAc "SELECT 1" &>/dev/null; then
    echo "    Postgres running as $USER. Creating database..."
    createdb -h localhost -U "$USER" 3pl_asset_tracker 2>/dev/null || true
    if [ -f .env ]; then
      sed -i.bak "s|postgresql://postgres:postgres@localhost|postgresql://$USER@localhost|" .env 2>/dev/null || true
    fi
  fi
fi

echo "==> 2. Prisma (migrate + seed)"
npm run db:generate
npm run db:migrate deploy
npm run db:seed

echo ""
echo "==> Done. Run: npm run dev"
echo "    Login: admin@example.com / admin123"
