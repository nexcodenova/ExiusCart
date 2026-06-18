const http = require('http');
const { exec } = require('child_process');

const DEPLOY_CMD = [
  'cd /var/www/ExiusCart',
  "GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519' git pull",
  'cd exiuscart-backend && source venv/bin/activate && pip install -r requirements.txt -q && deactivate',
  'pm2 restart exiuscart-backend --update-env',
  'cd /var/www/ExiusCart/apps/exiuscart-store && npm install --silent && NEXT_PUBLIC_API_URL=https://api.exiuscart.com npm run build && pm2 restart exiuscart-store --update-env',
  'cd /var/www/ExiusCart/apps/exiuscart-admin && npm install --silent && NEXT_PUBLIC_API_URL=https://api.exiuscart.com npm run build && pm2 restart exiuscart-admin --update-env',
  'cd /var/www/ExiusCart/apps/exiuscart-affiliates && npm install --silent && NEXT_PUBLIC_API_URL=https://api.exiuscart.com npm run build && pm2 restart exiuscart-affiliates --update-env',
].join(' && ');

const THEDERSI_CMD = [
  'set -e',
  'cd /var/www/TheDersi',
  "GIT_SSH_COMMAND='ssh -i ~/.ssh/thedersi_deploy' git pull",
  'cd apps/web && npm install',
  'rm -rf .next.backup && cp -r .next .next.backup 2>/dev/null || true',
  'if npm run build; then rm -rf .next.backup && pm2 restart thedersi --update-env; else rm -rf .next && mv .next.backup .next 2>/dev/null || true; fi',
].join('\n');

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    res.end('ok');
    console.log('[ExiusCart] Deploy started:', new Date().toISOString());
    exec(DEPLOY_CMD, { shell: '/bin/bash' }, (err) => {
      if (err) console.error('[ExiusCart] Deploy error:', err.message);
      else console.log('[ExiusCart] Deploy done:', new Date().toISOString());
    });

  } else if (req.method === 'POST' && req.url === '/thedersi') {
    res.end('ok');
    console.log('[TheDersi] Deploy started:', new Date().toISOString());
    exec(THEDERSI_CMD, { shell: '/bin/bash' }, (err) => {
      if (err) console.error('[TheDersi] Deploy error:', err.message);
      else console.log('[TheDersi] Deploy done:', new Date().toISOString());
    });

  } else {
    res.end();
  }
}).listen(9000, () => console.log('Webhook listening on :9000'));
