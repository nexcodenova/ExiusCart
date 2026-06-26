#!/bin/bash
set -e

PROJECT_DIR="/var/www/ExiusCart"
API_URL="https://api.exiuscart.com"

# Single-deploy lock: prevents two builds touching the same .next at once
exec 200>/tmp/exiuscart-deploy.lock
flock -w 600 200 || { echo "Could not acquire deploy lock — another deploy is running."; exit 1; }

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

CHANGED=$(git diff HEAD~1 --name-only 2>/dev/null || echo "all")

# ── Health check helper ───────────────────────────────────────────────────────
# Usage: health_check <name> <port> <retries>
# Retries every 3s. Returns 0 if healthy, 1 if all retries fail.
health_check() {
  local name="$1" port="$2" retries="${3:-15}"
  echo "[$name] health check on port $port (${retries} attempts × 3s)..."
  for i in $(seq 1 "$retries"); do
    if curl -sf "http://localhost:${port}/" > /dev/null 2>&1; then
      echo "[$name] healthy after ${i} attempt(s)"
      return 0
    fi
    sleep 3
  done
  echo "[$name] HEALTH CHECK FAILED after $((retries * 3))s"
  return 1
}

# ── Build + zero-downtime swap + reload + health check ───────────────────────
# If build fails  → old .next is untouched, pm2 keeps serving old code
# If reload fails → old process may already be gone (pm2 reload is best-effort)
# If health check fails → .next-old is restored and old build is reloaded
build_app() {
  local dir="$1" name="$2" port="$3"
  cd "$dir"

  # Only reinstall deps when lockfile/package.json changed or node_modules missing
  if echo "$CHANGED" | grep -qE 'package(-lock)?\.json' || [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "[$name] installing dependencies..."
    npm install --silent
  fi

  # Build into .next-staging — live app keeps serving .next untouched during build
  rm -rf .next-staging
  [ -d .next/cache ] && mkdir -p .next-staging && cp -a .next/cache .next-staging/cache 2>/dev/null || true

  if ! NEXT_PUBLIC_API_URL=$API_URL NEXT_DIST_DIR=.next-staging npm run build; then
    echo "[$name] first build attempt failed — retrying on clean dir..."
    rm -rf .next-staging
    # If retry also fails, set -e exits here. Old .next is still untouched. ✓
    NEXT_PUBLIC_API_URL=$API_URL NEXT_DIST_DIR=.next-staging npm run build
  fi

  # Atomic swap: keep .next-old as rollback target
  rm -rf .next-old
  [ -d .next ] && mv .next .next-old
  mv .next-staging .next

  # Graceful reload: starts new process, waits for it, THEN kills old one.
  # If new process fails to start, PM2 keeps old process running.
  if pm2 describe "$name" > /dev/null 2>&1; then
    pm2 reload "$name" --update-env
  else
    pm2 start "npm start" --name "$name" --cwd "$dir"
  fi

  # Health check — if app is not responding after 45s, roll back
  if ! health_check "$name" "$port" 15; then
    echo "[$name] Rolling back to previous build..."
    rm -rf .next
    [ -d .next-old ] && mv .next-old .next || true
    pm2 reload "$name" --update-env || true
    echo "[$name] ROLLBACK COMPLETE — old version restored"
    exit 1
  fi

  # Deploy successful — clean up rollback copy
  rm -rf .next-old
  echo "[$name] deploy successful ✓"
}

# ── Backend ───────────────────────────────────────────────────────────────────
echo "--- Backend ---"
cd "$PROJECT_DIR/exiuscart-backend"
source venv/bin/activate
if echo "$CHANGED" | grep -q "exiuscart-backend/requirements.txt"; then
  pip install -r requirements.txt -q
  echo "requirements updated"
fi
if pm2 describe exiuscart-backend > /dev/null 2>&1; then
  pm2 reload exiuscart-backend --update-env
else
  pm2 start "$PROJECT_DIR/exiuscart-backend/start.sh" --name exiuscart-backend
fi
# Backend health check
if ! health_check "exiuscart-backend" 8000 10; then
  echo "[exiuscart-backend] backend unhealthy after deploy — check logs: pm2 logs exiuscart-backend"
  # Don't exit — other apps can still deploy; backend issues are often startup-time only
fi
deactivate

# ── Store ─────────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -qE "apps/exiuscart-store/|packages/"; then
  echo "--- Store (changed) ---"
  build_app "$PROJECT_DIR/apps/exiuscart-store" exiuscart-store 3002
else
  echo "--- Store (no changes, skipped) ---"
fi

# ── Admin ─────────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -qE "apps/exiuscart-admin/|packages/"; then
  echo "--- Admin (changed) ---"
  build_app "$PROJECT_DIR/apps/exiuscart-admin" exiuscart-admin 3001
else
  echo "--- Admin (no changes, skipped) ---"
fi

# ── Affiliates ────────────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -qE "apps/exiuscart-affiliates/|packages/"; then
  echo "--- Affiliates (changed) ---"
  build_app "$PROJECT_DIR/apps/exiuscart-affiliates" exiuscart-affiliates 3004
else
  echo "--- Affiliates (no changes, skipped) ---"
fi

# ── Trends storefront ─────────────────────────────────────────────────────────
if echo "$CHANGED" | grep -qE "apps/trends-exiuscart/|packages/"; then
  echo "--- Trends (changed) ---"
  build_app "$PROJECT_DIR/apps/trends-exiuscart" trends-exiuscart 3000
else
  echo "--- Trends (no changes, skipped) ---"
fi

echo "=== Deploy Complete ==="
pm2 save
pm2 status
