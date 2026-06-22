#!/bin/bash
set -e

PROJECT_DIR="/var/www/ExiusCart"
API_URL="https://api.exiuscart.com"

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

# Pull latest code and detect what changed
git pull origin main
CHANGED=$(git diff HEAD~1 --name-only 2>/dev/null || echo "all")

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
  cd "$PROJECT_DIR/apps/exiuscart-admin"
  npm install --silent
  NEXT_PUBLIC_API_URL=$API_URL npm run build
  pm2 restart exiuscart-admin
else
  echo "--- Admin (no changes, skipped) ---"
fi

# Store
if echo "$CHANGED" | grep -qE "apps/exiuscart-store/|packages/"; then
  echo "--- Store (changed) ---"
  cd "$PROJECT_DIR/apps/exiuscart-store"
  npm install --silent
  NEXT_PUBLIC_API_URL=$API_URL npm run build
  pm2 restart exiuscart-store
else
  echo "--- Store (no changes, skipped) ---"
fi

# Affiliates
if echo "$CHANGED" | grep -qE "apps/exiuscart-affiliates/|packages/"; then
  echo "--- Affiliates (changed) ---"
  cd "$PROJECT_DIR/apps/exiuscart-affiliates"
  npm install --silent
  NEXT_PUBLIC_API_URL=$API_URL npm run build
  pm2 restart exiuscart-affiliates
else
  echo "--- Affiliates (no changes, skipped) ---"
fi

echo "=== Deploy Complete ==="
pm2 status
