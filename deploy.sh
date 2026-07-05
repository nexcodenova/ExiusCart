#!/bin/bash
# deploy.sh — runs on server after git pull
# Builds Next.js apps ON the server so RSC module paths are correct
set -e

PROJECT_DIR="/var/www/ExiusCart"

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

CHANGED=$(git diff HEAD~1 --name-only 2>/dev/null || echo "all")

export NEXT_PUBLIC_API_URL="https://api.exiuscart.com"
export NEXT_TELEMETRY_DISABLED=1

# Helper: build a Next.js app safely.
# Clears only the stale-build problem files (not the whole .next),
# builds, and only reloads pm2 when the build actually succeeds.
# If the build fails the OLD .next stays intact so the live site keeps running.
build_app() {
  local APP_DIR="$1"
  local PM2_NAME="$2"
  local PORT="$3"   # optional — only used when starting fresh

  echo "--- Building $PM2_NAME ---"
  cd "$PROJECT_DIR"

  # Remove only the specific files that cause Next.js build errors.
  # Do NOT rm -rf .next — the live server needs it while we build.
  rm -rf  "$APP_DIR/.next/export"                   2>/dev/null || true
  rm -f   "$APP_DIR/.next/server/pages-manifest.json" 2>/dev/null || true

  # Build — if this fails set -e exits here; the old .next is untouched.
  npm run build --workspace="$APP_DIR"

  # Build succeeded — reload (or start) pm2
  if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    pm2 reload "$PM2_NAME" --update-env
  else
    if [ -n "$PORT" ]; then
      PORT="$PORT" pm2 start npm --name "$PM2_NAME" --cwd "$APP_DIR" -- start
    else
      pm2 start npm --name "$PM2_NAME" --cwd "$APP_DIR" -- start
    fi
  fi

  echo "$PM2_NAME built and reloaded ✓"
}

# ── Database migrations ───────────────────────────────────────────────────────
echo "--- Running DB migrations ---"
ENV_FILE="$PROJECT_DIR/exiuscart-backend/.env"
if [ -f "$ENV_FILE" ]; then
  DB_URL=$(grep ^DATABASE_URL "$ENV_FILE" | cut -d= -f2-)
  if [ -n "$DB_URL" ]; then
    for migration in "$PROJECT_DIR/exiuscart-backend/migrations/"*.sql; do
      [ -f "$migration" ] || continue
      echo "Applying: $(basename "$migration")"
      psql "$DB_URL" -f "$migration" || echo "Warning: migration may already be applied or failed: $(basename "$migration")"
    done
    echo "Migrations done ✓"
  else
    echo "DATABASE_URL not found in .env — skipping migrations"
  fi
else
  echo ".env not found — skipping migrations"
fi

# ── Backend ───────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "exiuscart-backend/" || [ "$CHANGED" = "all" ]; then
  echo "--- Backend ---"
  cd "$PROJECT_DIR/exiuscart-backend"
  source venv/bin/activate
  if echo "$CHANGED" | grep -q "requirements.txt"; then
    pip install -r requirements.txt -q
    echo "requirements updated"
  fi
  if pm2 describe exiuscart-backend > /dev/null 2>&1; then
    pm2 reload exiuscart-backend --update-env
  else
    pm2 start "$PROJECT_DIR/exiuscart-backend/start.sh" --name exiuscart-backend --interpreter bash
  fi
  deactivate
  echo "Backend reloaded ✓"
fi

# ── Store ─────────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-store/" || [ "$CHANGED" = "all" ]; then
  build_app "apps/exiuscart-store" "exiuscart-store" "3002"
fi

# ── Admin ─────────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-admin/" || [ "$CHANGED" = "all" ]; then
  build_app "apps/exiuscart-admin" "exiuscart-admin" ""
fi

# ── Affiliates ────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-affiliates/" || [ "$CHANGED" = "all" ]; then
  build_app "apps/exiuscart-affiliates" "exiuscart-affiliates" ""
fi

pm2 save
echo "=== Deploy Complete ==="
pm2 status
