'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export type SocialProvider = 'google' | 'facebook' | 'apple';

interface SocialConfig {
  google: { client_id: string } | null;
  facebook: { app_id: string } | null;
  apple: { client_id: string } | null;
}

interface Props {
  // e.g. https://api.exiuscart.com — the backend that owns /auth/social/config.
  apiBase: string;
  // Runs before any provider popup opens. Return false to stop (e.g. the
  // terms box isn't ticked yet); the caller shows its own message.
  beforeStart?: () => boolean;
  // Hands over the provider's token for the backend to verify. Throw to
  // surface an error message.
  onToken: (provider: SocialProvider, token: string, extra?: { name?: string }) => Promise<void>;
  onError: (message: string) => void;
}

// Provider SDKs load once per page, on demand, from the providers' own
// hosts. Loading them ahead of the click matters: a popup opened after an
// async script load is treated as not user-initiated and gets blocked.
const scriptCache: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  if (!scriptCache[src]) {
    scriptCache[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { delete scriptCache[src]; reject(new Error(`Couldn't load ${src}`)); };
      document.head.appendChild(s);
    });
  }
  return scriptCache[src];
}

const w = () => window as any;

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.2 5.6c4.3-4 6.8-9.9 6.8-17z" />
      <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.1a24 24 0 0 0 0 21.4l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d="M16.37 1.43c0 1.14-.46 2.22-1.2 3.02-.8.87-2.1 1.55-3.16 1.46-.13-1.1.42-2.25 1.15-3.01.81-.86 2.2-1.5 3.21-1.47zM20.5 17.3c-.55 1.27-.82 1.84-1.53 2.96-1 1.56-2.4 3.5-4.14 3.52-1.55.02-1.95-1-4.05-.99-2.1.01-2.54 1.01-4.09.99-1.74-.02-3.07-1.77-4.07-3.33C-.2 15.3-.5 10.2 1.1 7.7c1.14-1.78 2.94-2.82 4.63-2.82 1.72 0 2.8 1.02 4.22 1.02 1.38 0 2.22-1.02 4.21-1.02 1.5 0 3.09.82 4.22 2.23-3.71 2.03-3.11 7.33.12 8.19z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="#1877F2">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

// Brand-coloured full-width buttons with the logo in a white tile on the
// left — recognisable at a glance and consistent across login and signup.
const BTN = 'relative flex h-11 w-full items-center overflow-hidden rounded-lg p-[3px] [@media(max-height:760px)]:h-10 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60';
const TILE = 'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md bg-white [@media(max-height:760px)]:h-[34px] [@media(max-height:760px)]:w-[34px]';

export function SocialAuthButtons({ apiBase, beforeStart, onToken, onError }: Props) {
  const [config, setConfig] = useState<SocialConfig | null>(null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const googleClient = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/api/v1/auth/social/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: SocialConfig | null) => { if (!cancelled) setConfig(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiBase]);

  // Preload each enabled provider's SDK (see loadScript's note on popups).
  useEffect(() => {
    if (!config) return;
    if (config.google) {
      loadScript('https://accounts.google.com/gsi/client').catch(() => {});
    }
    if (config.facebook) {
      const fb = config.facebook;
      w().fbAsyncInit = () => w().FB.init({ appId: fb.app_id, cookie: false, xfbml: false, version: 'v19.0' });
      loadScript('https://connect.facebook.net/en_US/sdk.js').catch(() => {});
    }
    if (config.apple) {
      loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js')
        .then(() => w().AppleID.auth.init({
          clientId: config.apple!.client_id, scope: 'name email',
          redirectURI: window.location.origin, usePopup: true,
        }))
        .catch(() => {});
    }
  }, [config]);

  const run = async (provider: SocialProvider, getToken: () => Promise<{ token: string; name?: string }>) => {
    if (beforeStart && !beforeStart()) return;
    setBusy(provider);
    try {
      const { token, name } = await getToken();
      await onToken(provider, token, { name });
    } catch (e: any) {
      // A closed popup isn't an error worth shouting about.
      if (e?.message && e.message !== 'cancelled') onError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const notReady = (name: string) =>
    onError(`${name} sign-in isn't available yet. Please use your email for now.`);

  const google = () => !config?.google ? notReady('Google') : run('google', () => new Promise((resolve, reject) => {
    if (!w().google?.accounts?.oauth2) return reject(new Error('Google sign-in is still loading — try again in a moment.'));
    if (!googleClient.current) {
      googleClient.current = w().google.accounts.oauth2.initTokenClient({
        client_id: config!.google!.client_id,
        scope: 'openid email profile',
        callback: () => {},
      });
    }
    googleClient.current.callback = (resp: any) => (
      resp?.access_token ? resolve({ token: resp.access_token }) : reject(new Error('cancelled'))
    );
    googleClient.current.error_callback = () => reject(new Error('cancelled'));
    googleClient.current.requestAccessToken();
  }));

  const facebook = () => !config?.facebook ? notReady('Facebook') : run('facebook', () => new Promise((resolve, reject) => {
    if (!w().FB) return reject(new Error('Facebook sign-in is still loading — try again in a moment.'));
    w().FB.login((resp: any) => (
      resp?.authResponse?.accessToken ? resolve({ token: resp.authResponse.accessToken }) : reject(new Error('cancelled'))
    ), { scope: 'email,public_profile' });
  }));

  const apple = () => !config?.apple ? notReady('Apple') : run('apple', async () => {
    if (!w().AppleID) throw new Error('Apple sign-in is still loading — try again in a moment.');
    try {
      const res = await w().AppleID.auth.signIn();
      const n = res?.user?.name;
      return { token: res.authorization.id_token, name: n ? `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim() : undefined };
    } catch {
      throw new Error('cancelled');
    }
  });


  return (
    <div className="space-y-1.5">
      <button type="button" className={`${BTN} bg-[#4285F4]`} disabled={!!busy} onClick={google}>
        <span className={TILE}>{busy === 'google' ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <GoogleIcon />}</span>
        <span className="flex-1 pr-[38px] text-center">Continue with Google</span>
      </button>
      <button type="button" className={`${BTN} bg-black`} disabled={!!busy} onClick={apple}>
        <span className={`${TILE} text-black`}>{busy === 'apple' ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <AppleIcon />}</span>
        <span className="flex-1 pr-[38px] text-center">Continue with Apple</span>
      </button>
      <button type="button" className={`${BTN} bg-[#3B5998]`} disabled={!!busy} onClick={facebook}>
        <span className={TILE}>{busy === 'facebook' ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <FacebookIcon />}</span>
        <span className="flex-1 pr-[38px] text-center">Continue with Facebook</span>
      </button>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}
