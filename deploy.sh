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

# ── Store — build on server so RSC paths match ────────────────────────────────
# NOTE: we do NOT rm -rf .next — old build stays live until pm2 reload completes.
# Next.js uses BUILD_ID so stale files from previous builds are never served.
# Keeping .next also preserves the SWC cache, cutting build time roughly in half.
if echo "$CHANGED" | grep -q "apps/exiuscart-store/" || [ "$CHANGED" = "all" ]; then
  echo "--- Store (building on server) ---"
  cd "$PROJECT_DIR"
  npm run build --workspace=apps/exiuscart-store
  if pm2 describe exiuscart-store > /dev/null 2>&1; then
    pm2 reload exiuscart-store --update-env
  else
    PORT=3002 pm2 start npm --name exiuscart-store --cwd "$PROJECT_DIR/apps/exiuscart-store" -- start
  fi
  echo "Store built and reloaded ✓"
fi

# ── Admin — build on server so RSC paths match ────────────────────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-admin/" || [ "$CHANGED" = "all" ]; then
  echo "--- Admin (building on server) ---"
  cd "$PROJECT_DIR"
  npm run build --workspace=apps/exiuscart-admin
  if pm2 describe exiuscart-admin > /dev/null 2>&1; then
    pm2 reload exiuscart-admin --update-env
  else
    pm2 start npm --name exiuscart-admin --cwd "$PROJECT_DIR/apps/exiuscart-admin" -- start
  fi
  echo "Admin built and reloaded ✓"
fi

# ── Affiliates — build on server ──────────────────────────────────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-affiliates/" || [ "$CHANGED" = "all" ]; then
  echo "--- Affiliates (building on server) ---"
  cd "$PROJECT_DIR"
  npm run build --workspace=apps/exiuscart-affiliates
  if pm2 describe exiuscart-affiliates > /dev/null 2>&1; then
    pm2 reload exiuscart-affiliates --update-env
  else
    pm2 start npm --name exiuscart-affiliates --cwd "$PROJECT_DIR/apps/exiuscart-affiliates" -- start
  fi
  echo "Affiliates built and reloaded ✓"
fi

pm2 save
echo "=== Deploy Complete ==="
pm2 status
