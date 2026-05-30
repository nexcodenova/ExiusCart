#!/bin/bash
set -e

PROJECT_DIR="/var/www/ExiusCart"
API_URL="https://api.exiuscart.com"

echo "=== ExiusCart Deploy Started ==="
cd "$PROJECT_DIR"

# Pull latest code
git pull origin main

# Backend — install all dependencies and restart
echo "--- Backend ---"
cd "$PROJECT_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt -q
pm2 restart backend
deactivate

# Website
echo "--- Website ---"
cd "$PROJECT_DIR/apps/exiuscart-website"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart website

# Admin Dashboard
echo "--- Admin Dashboard ---"
cd "$PROJECT_DIR/apps/admin-dashboard"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart admin-dashboard

# Shopping
echo "--- Shopping ---"
cd "$PROJECT_DIR/apps/exiuscart-shopping"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart shopping

# Shop Dashboard
echo "--- Shop Dashboard ---"
cd "$PROJECT_DIR/apps/shop-dashboard"
npm install --silent
NEXT_PUBLIC_API_URL=$API_URL npm run build
pm2 restart shop-dashboard

echo "=== Deploy Complete ==="
pm2 status
