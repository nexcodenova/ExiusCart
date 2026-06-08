#!/bin/bash
set -e

PROJECT_DIR="/var/www/ExiusCart"
API_URL="https://api.exiuscart.com"

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

# Pull latest code
git pull origin main

# Backend
echo "--- Backend ---"
cd "$PROJECT_DIR/exiuscart-backend"
source venv/bin/activate
pip install -r requirements.txt -q
pm2 restart exiuscart-backend
deactivate

# Admin
echo "--- Admin ---"
cd "$PROJECT_DIR/apps/exiuscart-admin"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart exiuscart-admin

# Store
echo "--- Store ---"
cd "$PROJECT_DIR/apps/exiuscart-store"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart exiuscart-store

# Affiliates
echo "--- Affiliates ---"
cd "$PROJECT_DIR/apps/exiuscart-affiliates"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart exiuscart-affiliates

echo "=== Deploy Complete ==="
pm2 status
