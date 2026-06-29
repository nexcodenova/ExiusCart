#!/bin/bash
set -e
echo "=== ExiusCart Full Server Setup ==="

# System packages
apt-get update -y
apt-get install -y git curl nginx python3 python3-pip python3-venv certbot python3-certbot-nginx ufw

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# Swap (2GB)
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Clone project
mkdir -p /var/www
cd /var/www
if [ -d "ExiusCart" ]; then
  echo "Project already exists, pulling..."
  cd ExiusCart && git pull
else
  git clone https://github.com/nexcodenova/ExiusCart.git ExiusCart
  cd ExiusCart
fi

# Backend .env (points to nexcodenova-db-server)
cat > /var/www/ExiusCart/exiuscart-backend/.env << 'ENVEOF'
DATABASE_URL=postgresql://exiuscart_user:ExiusCart%40DB2026!@159.223.47.168/exiuscart_db
JWT_SECRET_KEY=nexcodenova-exiuscart-secret-key-2026-very-long-and-secure
THEDERSI_PARTNER_KEY=REPLACE_WITH_PARTNER_KEY
THEDERSI_HMAC_SECRET=REPLACE_WITH_HMAC_SECRET
THEDERSI_WEBHOOK_URL=https://thedersi.lk/api/exiuscart/webhook
ENVEOF

# Backend Python setup
cd /var/www/ExiusCart/exiuscart-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
python -c "from app.core.database import Base, engine; from app.models import *; Base.metadata.create_all(bind=engine); print('Tables created!')"
deactivate

# Nginx config
cat > /etc/nginx/sites-available/exiuscart << 'NGINXEOF'
server {
    listen 80;
    server_name admin.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name store.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3002; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name affiliates.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3004; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name api.exiuscart.com;
    client_max_body_size 10M;
    location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/exiuscart /etc/nginx/sites-enabled/exiuscart
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=== Base setup done! Now building apps ==="
echo ""

API_URL="https://api.exiuscart.com"
cd /var/www/ExiusCart/apps/exiuscart-admin && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build
cd /var/www/ExiusCart/apps/exiuscart-store && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build
cd /var/www/ExiusCart/apps/exiuscart-affiliates && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build

# Start PM2
pm2 start "cd /var/www/ExiusCart/exiuscart-backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000" --name exiuscart-backend --interpreter bash
pm2 start "npm start" --name exiuscart-admin --cwd /var/www/ExiusCart/apps/exiuscart-admin
pm2 start "npm start" --name exiuscart-store --cwd /var/www/ExiusCart/apps/exiuscart-store
pm2 start "npm start" --name exiuscart-affiliates --cwd /var/www/ExiusCart/apps/exiuscart-affiliates

pm2 startup systemd -u root --hp /root
pm2 save

echo ""
echo "=== Setup Complete! ==="
echo "Run SSL: certbot --nginx -d api.exiuscart.com -d admin.exiuscart.com -d app.exiuscart.com -d affiliates.exiuscart.com"
