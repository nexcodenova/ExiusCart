'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

// Set by the login page right before it redirects to /dashboard (both the
// password login and the emailed setup-link login). Session-scoped, so a
// plain page refresh or navigation never replays the splash.
export const WELCOME_FLAG = 'show_welcome';

// How long after signup an account still counts as "new" for the greeting.
const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;

const SPARKLES = [
  { top: '18%', left: '22%', delay: '0s', size: 10 },
  { top: '26%', left: '76%', delay: '0.4s', size: 14 },
  { top: '68%', left: '18%', delay: '0.8s', size: 12 },
  { top: '74%', left: '80%', delay: '0.2s', size: 10 },
  { top: '44%', left: '10%', delay: '1s', size: 8 },
  { top: '52%', left: '90%', delay: '0.6s', size: 9 },
];

interface SplashState { name: string; isNew: boolean }

export function WelcomeSplash() {
  const [splash, setSplash] = useState<SplashState | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Preview without logging in again: /dashboard?welcome=new or ?welcome=back
    // forces that variant (and doesn't touch the real "welcomed" record).
    const previewParam = new URLSearchParams(window.location.search).get('welcome');
    const preview = previewParam === 'new' || previewParam === 'back' ? previewParam : null;

    let flagged = false;
    try { flagged = sessionStorage.getItem(WELCOME_FLAG) === '1'; } catch {}
    if (!flagged && !preview) return;
    try { sessionStorage.removeItem(WELCOME_FLAG); } catch {}

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      let user: any = null;
      try { user = JSON.parse(localStorage.getItem('user') || 'null'); } catch {}
      // The emailed setup-link login lands here without a stored user record;
      // fetch it (short timeout — never hold the splash hostage to the API)
      // so we know the account's age and can greet by name.
      if (!user?.created_at) {
        try {
          const { usersApi } = await import('@/lib/api');
          const res = await Promise.race([
            usersApi.getMe(),
            new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 1500)),
          ]);
          user = res.data;
          localStorage.setItem('user', JSON.stringify(user));
        } catch {}
      }
      if (cancelled) return;

      // "New" = the account was created recently AND this browser hasn't
      // welcomed this shop before. Account age comes from the server, so an
      // old account on a fresh browser (cleared storage) gets "Welcome back"
      // instead of being mistaken for a new signup. If the age is unknown,
      // fall back to the per-browser check alone.
      let seenBefore = false;
      if (!preview) {
        try {
          const key = `welcomed_shop_${localStorage.getItem('shop_id') ?? 'unknown'}`;
          seenBefore = !!localStorage.getItem(key);
          localStorage.setItem(key, '1');
        } catch {}
      }
      const createdAt = user?.created_at ? new Date(user.created_at).getTime() : null;
      const isRecent = createdAt === null ? true : Date.now() - createdAt < NEW_ACCOUNT_WINDOW_MS;
      const isNew = preview ? preview === 'new' : isRecent && !seenBefore;

      const name = String(user?.full_name || '').trim().split(/\s+/)[0] || '';
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = reduced ? 700 : isNew ? 3400 : 2200;
      setSplash({ name, isNew });
      timers.push(setTimeout(() => setLeaving(true), duration));
      timers.push(setTimeout(() => setSplash(null), duration + 500));
    })();

    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, []);

  if (!splash) return null;

  const { name, isNew } = splash;
  const barSeconds = isNew ? 3.4 : 2.2;
  const skip = () => { setLeaving(true); setTimeout(() => setSplash(null), 400); };

  return (
    <div
      role="dialog" aria-label="Welcome" onClick={skip}
      className={`fixed inset-0 z-[200] flex cursor-pointer items-center justify-center overflow-hidden bg-background transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(243_75%_59%/0.14),transparent_60%)]" />

      {isNew && SPARKLES.map((s, i) => (
        <span key={i} aria-hidden="true"
          className="welcome-anim absolute rounded-full bg-indigo-400/80"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, animation: `welcome-float 2.4s ease-in-out ${s.delay} infinite` }} />
      ))}

      <div className="relative flex flex-col items-center px-6 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {[0, 0.7, 1.4].map((d) => (
            <span key={d} aria-hidden="true"
              className="welcome-anim absolute inset-0 rounded-full border-2 border-indigo-400/50"
              style={{ animation: `welcome-ring 2.1s ease-out ${d}s infinite` }} />
          ))}
          <div className="welcome-anim flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-xl ring-1 ring-border"
            style={{ animation: 'welcome-pop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}>
            <Image src="/logo.svg" alt="ExiusCart" width={56} height={56} priority />
          </div>
        </div>

        <h1 className="welcome-anim mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
          style={{ animation: 'welcome-rise 0.7s ease-out 0.35s both' }}>
          {isNew ? 'Welcome to ' : 'Welcome back'}
          {isNew && <><span className="text-indigo-500">Exius</span>Cart</>}
          {name ? <>, <span className="text-indigo-500">{name}</span></> : ''}
        </h1>
        <p className="welcome-anim mt-3 max-w-md text-base text-muted-foreground"
          style={{ animation: 'welcome-rise 0.7s ease-out 0.6s both' }}>
          {isNew
            ? 'Your store is ready. Let’s get you set up and selling.'
            : 'Getting your store ready…'}
        </p>

        <div className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-muted">
          <div className="welcome-anim h-full origin-left rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            style={{ animation: `welcome-bar ${barSeconds}s cubic-bezier(0.4, 0, 0.2, 1) both` }} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground/70">Click anywhere to skip</p>
      </div>
    </div>
  );
}
