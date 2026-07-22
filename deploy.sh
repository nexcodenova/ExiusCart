#!/bin/bash
# deploy.sh — runs on server after git pull
# Builds Next.js apps ON the server so RSC module paths are correct
set -e

PROJECT_DIR="/var/www/ExiusCart"

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

# webhook.js sets BEFORE_SHA to HEAD *before* the pull, so this diffs against
# everything the pull actually brought in — a push with several commits
# bundled together no longer has its earlier commits silently skipped by
# only looking at the single most recent one (the old `HEAD~1` behavior).
# Falls back to HEAD~1 for a manual run where BEFORE_SHA isn't set.
CHANGED=$(git diff "${BEFORE_SHA:-HEAD~1}" HEAD --name-only 2>/dev/null || echo "all")

export NEXT_PUBLIC_API_URL="https://api.exiuscart.com"
export NEXT_TELEMETRY_DISABLED=1

# Helper: build a Next.js app with zero-downtime, atomic swap.
# Builds into .next-staging (each app's next.config.js reads NEXT_DIST_DIR
# for exactly this) while the OLD .next stays fully intact and serving
# traffic the entire time — unlike rm -rf .next beforehand, there is no
# window where a live request can land on a half-built/missing .next and
# 500 (that's what was happening: an in-progress build deleted .next while
# the still-running old process tried to read a manifest that no longer
# existed). Only after a successful build do we swap it in and reload pm2.
build_app() {
  local APP_DIR="$1"
  local PM2_NAME="$2"
  local PORT="$3"   # optional — only used when starting fresh

  echo "--- Building $PM2_NAME ---"
  cd "$PROJECT_DIR/$APP_DIR"

  rm -rf .next-staging
  NEXT_DIST_DIR=.next-staging npm run build || true
  if [ ! -f .next-staging/BUILD_ID ]; then
    echo "$PM2_NAME build failed — old .next left untouched, site keeps running on it"
    rm -rf .next-staging
    cd "$PROJECT_DIR"
    return 0
  fi

  rm -rf .next-old
  [ -d .next ] && mv .next .next-old
  mv .next-staging .next
  rm -rf .next-old

  cd "$PROJECT_DIR"

  # Reload (or start) pm2
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
  # Real schema/data migrations live here (alembic/versions/*.py) — this was
  # never run automatically before, relying on someone remembering to SSH in
  # and run it by hand. Safe to run every deploy: a no-op when already at head.
  cd "$PROJECT_DIR/exiuscart-backend"
  source venv/bin/activate
  alembic upgrade head && echo "Alembic migrations applied ✓" || echo "Warning: alembic upgrade head failed — check manually"
  deactivate
  cd "$PROJECT_DIR"

  # Legacy one-off SQL migrations (predates the switch to Alembic) — kept for
  # any of these still pending on a given environment.
  DB_URL=$(grep ^DATABASE_URL "$ENV_FILE" | cut -d= -f2-)
  if [ -n "$DB_URL" ]; then
    for migration in "$PROJECT_DIR/exiuscart-backend/migrations/"*.sql; do
      [ -f "$migration" ] || continue
      echo "Applying: $(basename "$migration")"
      psql "$DB_URL" -f "$migration" || echo "Warning: migration may already be applied or failed: $(basename "$migration")"
    done
    echo "Legacy SQL migrations done ✓"
  else
    echo "DATABASE_URL not found in .env — skipping legacy SQL migrations"
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
