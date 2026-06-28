#!/bin/bash
# deploy.sh — called by GitHub Actions after pre-built .next folders are rsynced
# SERVER NEVER RUNS npm run build — GitHub Actions builds everything (7GB RAM, free)
set -e

PROJECT_DIR="/var/www/ExiusCart"

echo "=== ExiusCart Deploy Started (server-side) ==="
cd "$PROJECT_DIR"

CHANGED=$(git diff HEAD~1 --name-only 2>/dev/null || echo "all")

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

# ── Store — .next was pre-built on GitHub Actions and rsynced ─────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-store/" || [ "$CHANGED" = "all" ]; then
  echo "--- Store ---"
  if [ ! -f "$PROJECT_DIR/apps/exiuscart-store/.next/BUILD_ID" ]; then
    echo "WARNING: No .next build found for store — skipping reload"
  else
    pm2 reload exiuscart-store --update-env 2>/dev/null || \
      PORT=3002 pm2 start npm --name exiuscart-store --cwd "$PROJECT_DIR/apps/exiuscart-store" -- start
    echo "Store reloaded ✓"
  fi
fi

# ── Admin — .next was pre-built on GitHub Actions and rsynced ────────────────
if echo "$CHANGED" | grep -q "apps/exiuscart-admin/" || [ "$CHANGED" = "all" ]; then
  echo "--- Admin ---"
  if [ ! -f "$PROJECT_DIR/apps/exiuscart-admin/.next/BUILD_ID" ]; then
    echo "WARNING: No .next build found for admin — skipping reload"
  else
    pm2 reload exiuscart-admin --update-env 2>/dev/null || \
      pm2 start npm --name exiuscart-admin --cwd "$PROJECT_DIR/apps/exiuscart-admin" -- start
    echo "Admin reloaded ✓"
  fi
fi

pm2 save
echo "=== Deploy Complete — zero builds ran on this server ==="
pm2 status
