const http = require('http');
const { exec } = require('child_process');

// ExiusCart deploys via GitHub Actions now (.github/workflows/deploy.yml —
// runs tests + typecheck before deploying, which this path never did), not
// this webhook. The two running independently, both writing into
// /var/www/ExiusCart on every push, is what was actually corrupting builds
// today — not just duplicate webhook deliveries. Left as a no-op rather
// than deleted so a leftover GitHub webhook delivery to /webhook doesn't
// error, and so this is easy to find if anyone goes looking for why
// deploys "stopped happening" here.
const EXIUSCART_DEPLOY_DISABLED = true;

const THEDERSI_CMD = [
  'set -e',
  'cd /var/www/TheDersi',
  "GIT_SSH_COMMAND='ssh -i ~/.ssh/thedersi_deploy' git pull",
  'cd apps/web && npm install',
  'rm -rf .next.backup && cp -r .next .next.backup 2>/dev/null || true',
  'if npm run build; then rm -rf .next.backup && pm2 restart thedersi --update-env; else rm -rf .next && mv .next.backup .next 2>/dev/null || true; fi',
].join('\n');

// GitHub redelivers a webhook if it doesn't get a fast-enough response, and
// this handler responds instantly then runs the real deploy in the
// background — so a redelivery (or a human re-triggering it) used to spawn
// a SECOND full deploy while the first was still running. Two concurrent
// `npm run build`s writing into the same app directory is exactly what was
// corrupting builds and 500ing the live site. One in-flight guard per
// target closes that.
let thedersiDeploying = false;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    res.end('disabled — ExiusCart deploys via GitHub Actions now');
    console.log('[ExiusCart] Ignored — this path is disabled, deploy runs via GitHub Actions:', new Date().toISOString());

  } else if (req.method === 'POST' && req.url === '/thedersi') {
    if (thedersiDeploying) {
      console.log('[TheDersi] Deploy already in progress — ignoring duplicate trigger:', new Date().toISOString());
      res.end('already deploying');
      return;
    }
    thedersiDeploying = true;
    res.end('ok');
    console.log('[TheDersi] Deploy started:', new Date().toISOString());
    exec(THEDERSI_CMD, { shell: '/bin/bash' }, (err) => {
      thedersiDeploying = false;
      if (err) console.error('[TheDersi] Deploy error:', err.message);
      else console.log('[TheDersi] Deploy done:', new Date().toISOString());
    });

  } else {
    res.end();
  }
}).listen(9000, () => console.log('Webhook listening on :9000'));
