#!/usr/bin/env bash
# =============================================================
# Common Era — Product Seed Runner
#
# Clears all existing product/category data and seeds the DB
# with 12 coherent fashion products via Docker Compose.
#
# Usage (from repo root):
#   bash database/seed/seed.sh
#
# Usage (from database/seed/):
#   bash seed.sh
# =============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"
SQL_FILE="$SCRIPT_DIR/seed-products.sql"

# ── Colours ──────────────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'

info()  { echo -e "${CYAN}→${RESET}  $*"; }
ok()    { echo -e "${GREEN}✓${RESET}  $*"; }
err()   { echo -e "${RED}✗${RESET}  $*" >&2; }
hr()    { echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }

hr
echo -e "  ${BOLD}Common Era — Product Seed${RESET}"
hr
echo ""

# ── Pre-flight checks ─────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  err "Docker not found. Install Docker Desktop and try again."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  err "docker-compose.yml not found at: $COMPOSE_FILE"
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  err "SQL seed file not found at: $SQL_FILE"
  exit 1
fi

# Check the db container is running
DB_RUNNING=$(docker compose -f "$COMPOSE_FILE" ps --services --filter "status=running" 2>/dev/null || true)
if ! echo "$DB_RUNNING" | grep -q "^db$"; then
  err "The 'db' container is not running."
  echo ""
  echo "  Start the stack first:"
  echo "    docker compose up -d"
  echo ""
  exit 1
fi

ok "Docker db container is running."
echo ""

# ── Confirmation prompt ───────────────────────────────────────
echo -e "  ${RED}${BOLD}WARNING:${RESET} This will DELETE all existing products,"
echo    "  categories, cart items, wishlists, reviews, returns"
echo    "  and order items, then insert a fresh product catalog."
echo ""
read -r -p "  Continue? [y/N] " CONFIRM
echo ""

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  info "Aborted."
  exit 0
fi

# ── Run the seed ──────────────────────────────────────────────
info "Running seed-products.sql …"
echo ""

docker compose -f "$COMPOSE_FILE" exec -T db \
  psql -U user -d mydb -v ON_ERROR_STOP=1 < "$SQL_FILE"

echo ""
hr
ok "Seed complete. Product catalog loaded into the database."
hr
