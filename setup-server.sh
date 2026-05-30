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

# PostgreSQL
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Swap (2GB)
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# PostgreSQL user + database
sudo -u postgres psql -c "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'exiususer') THEN
    CREATE USER exiususer WITH PASSWORD 'ExiusCart2026';
  END IF;
END \$\$;"
sudo -u postgres psql -c "CREATE DATABASE exiuscart OWNER exiususer;" 2>/dev/null || echo "DB already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE exiuscart TO exiususer;"

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

# Backend .env
cat > /var/www/ExiusCart/backend/.env << 'ENVEOF'
DATABASE_URL=postgresql://exiususer:ExiusCart2026@localhost/exiuscart
JWT_SECRET_KEY=nexcodenova-exiuscart-secret-key-2026-very-long-and-secure
ENVEOF

# Backend Python setup
cd /var/www/ExiusCart/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
deactivate

# Nginx config
cat > /etc/nginx/sites-available/exiuscart << 'NGINXEOF'
server {
    listen 80;
    server_name exiuscart.com www.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name app.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name admin.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3002; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name shop.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:3003; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
server {
    listen 80;
    server_name api.exiuscart.com;
    location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/exiuscart /etc/nginx/sites-enabled/exiuscart
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 9000
ufw --force enable

echo ""
echo "=== Base setup done! Now building apps (this takes 15-20 mins) ==="
echo ""

API_URL="https://api.exiuscart.com"
cd /var/www/ExiusCart/apps/exiuscart-website && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build
cd /var/www/ExiusCart/apps/admin-dashboard && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build
cd /var/www/ExiusCart/apps/exiuscart-shopping && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build
cd /var/www/ExiusCart/apps/shop-dashboard && npm install --silent && NEXT_PUBLIC_API_URL=$API_URL npm run build

# Start PM2
cd /var/www/ExiusCart
pm2 start ecosystem.config.js
pm2 startup systemd -u root --hp /root
pm2 save

echo ""
echo "=== Setup Complete! ==="
echo "Run SSL next: certbot --nginx -d exiuscart.com -d www.exiuscart.com -d api.exiuscart.com -d admin.exiuscart.com -d app.exiuscart.com -d shop.exiuscart.com"
