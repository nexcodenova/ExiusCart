#!/bin/bash
set -e

PROJECT_DIR="/var/www/ExiusCart"
API_URL="https://api.exiuscart.com"

# Single-deploy lock: prevents two builds touching the same .next at once
# (the cause of the "ENOENT rename .next/export/500.html" failures). A second
# deploy waits up to 10 min for the first to finish instead of colliding.
exec 200>/tmp/exiuscart-deploy.lock
flock -w 600 200 || { echo "Could not acquire deploy lock — another deploy is running."; exit 1; }

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

# Code is pulled by the CI workflow before this script runs. For manual runs,
# run: git checkout -- . && git pull origin main && bash deploy.sh
CHANGED=$(git diff HEAD~1 --name-only 2>/dev/null || echo "all")

# Build a Next.js app on a clean .next, retrying once if the build hits a
# transient failure (e.g. Next's intermittent 500.html export race, or a flaky
# Google-Fonts fetch). A retry on a fresh .next clears it almost every time.
build_app() {
  local dir="$1" name="$2"
  cd "$dir"
  # Only reinstall deps when the lockfile/package.json actually changed (or node_modules
  # is missing). Saves ~30-60s every deploy.
  if echo "$CHANGED" | grep -qE 'package(-lock)?\.json' || [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo "[$name] installing dependencies..."
    npm install --silent
  fi
  # Keep .next/cache for fast incremental builds (zombies are gone + flock prevents
  # concurrent builds, so the cache is safe). Only wipe .next on a retry.
  if ! NEXT_PUBLIC_API_URL=$API_URL npm run build; then
    echo "[$name] build failed — clearing .next and retrying clean..."
    rm -rf .next
    NEXT_PUBLIC_API_URL=$API_URL npm run build
  fi
  pm2 restart "$name"
}

# Backend — always restart, only pip install if requirements changed
echo "--- Backend ---"
cd "$PROJECT_DIR/exiuscart-backend"
source venv/bin/activate
if echo "$CHANGED" | grep -q "exiuscart-backend/requirements.txt"; then
  pip install -r requirements.txt -q
  echo "requirements updated"
fi
pm2 restart exiuscart-backend --update-env
deactivate

# Admin
if echo "$CHANGED" | grep -qE "apps/exiuscart-admin/|packages/"; then
  echo "--- Admin (changed) ---"
  build_app "$PROJECT_DIR/apps/exiuscart-admin" exiuscart-admin
else
  echo "--- Admin (no changes, skipped) ---"
fi

# Store
if echo "$CHANGED" | grep -qE "apps/exiuscart-store/|packages/"; then
  echo "--- Store (changed) ---"
  build_app "$PROJECT_DIR/apps/exiuscart-store" exiuscart-store
else
  echo "--- Store (no changes, skipped) ---"
fi

# Affiliates
if echo "$CHANGED" | grep -qE "apps/exiuscart-affiliates/|packages/"; then
  echo "--- Affiliates (changed) ---"
  build_app "$PROJECT_DIR/apps/exiuscart-affiliates" exiuscart-affiliates
else
  echo "--- Affiliates (no changes, skipped) ---"
fi

echo "=== Deploy Complete ==="
pm2 status
