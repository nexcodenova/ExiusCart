const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
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

// Secret file (not committed to the repo, root-only permissions) — same
// value must be pasted into GitHub → TheDersi repo → Settings → Webhooks →
// this hook's "Secret" field. Read once at startup, not per-request — this
// process is restarted (pm2) whenever the secret rotates anyway.
//
// SECURITY: found 2026-08-31 that this endpoint had NO authentication at
// all — publicly reachable on :9000, anyone could POST /thedersi and
// trigger a real production deploy (git pull + npm install + build + pm2
// restart, running as root). Added GitHub's own documented fix: verify the
// X-Hub-Signature-256 header (HMAC-SHA256 over the raw request body, using
// the shared secret) before running anything. A request with a missing or
// wrong signature is rejected outright — never reaches exec().
const SECRET_PATH = '/var/www/.thedersi-webhook-secret';
let WEBHOOK_SECRET = '';
try {
  WEBHOOK_SECRET = fs.readFileSync(SECRET_PATH, 'utf8').trim();
} catch (e) {
  console.error(`[SECURITY] Could not read webhook secret at ${SECRET_PATH} — every /thedersi request will be rejected until this exists. ${e.message}`);
}

function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET || !signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');
  // timingSafeEqual throws if lengths differ — that's fine, it means "not equal"
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

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
    return;
  }

  if (req.method === 'POST' && req.url === '/thedersi') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks);
      if (!verifySignature(rawBody, req.headers['x-hub-signature-256'])) {
        console.warn('[TheDersi] Rejected — missing/invalid signature. From:', req.socket.remoteAddress, new Date().toISOString());
        res.writeHead(401);
        res.end('invalid signature');
        return;
      }

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
    });
    return;
  }

  res.end();
}).listen(9000, () => console.log('Webhook listening on :9000'));
