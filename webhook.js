const http = require('http');
const { exec } = require('child_process');

// Delegates to deploy.sh, which is the actual source of truth for how to
// build/reload each app safely (clears .next before building, only reloads
// pm2 on a successful build, runs Alembic + legacy SQL migrations, and only
// rebuilds apps that actually changed). BEFORE_SHA is captured here — before
// the pull — and passed through so deploy.sh can diff against everything
// this pull brought in, not just the single most recent commit.
const DEPLOY_CMD = [
  'cd /var/www/ExiusCart',
  'export BEFORE_SHA=$(git rev-parse HEAD)',
  "GIT_SSH_COMMAND='ssh -i ~/.ssh/id_ed25519' git pull",
  'bash deploy.sh',
].join(' && ');

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
let exiuscartDeploying = false;
let thedersiDeploying = false;

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    if (exiuscartDeploying) {
      console.log('[ExiusCart] Deploy already in progress — ignoring duplicate trigger:', new Date().toISOString());
      res.end('already deploying');
      return;
    }
    exiuscartDeploying = true;
    res.end('ok');
    console.log('[ExiusCart] Deploy started:', new Date().toISOString());
    exec(DEPLOY_CMD, { shell: '/bin/bash' }, (err) => {
      exiuscartDeploying = false;
      if (err) console.error('[ExiusCart] Deploy error:', err.message);
      else console.log('[ExiusCart] Deploy done:', new Date().toISOString());
    });

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
