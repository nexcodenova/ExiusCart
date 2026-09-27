'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2, Mail, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prodoraAuth } from '@/lib/api';

// open() shows the login step; open('/ai') makes it land on that Prodora page afterwards. It is also used directly as a click
// handler, so anything that is not a plain path string (a click event) is ignored.
const LoginModalContext = createContext<{ open: (next?: unknown) => void }>({ open: () => {} });

export const useLoginModal = () => useContext(LoginModalContext);

const EMAIL_KEY = 'prodora_email';   // the last email used here, so the next visit is one click

export default function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [next, setNext] = useState('');
  const [opening, setOpening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Coming from the ExiusCart dashboard's Prodora link — the account email
  // is already known, so open straight into Prodora instead of asking the
  // seller to retype an email they never had to type in the first place. Plain browser API
  // (not useSearchParams) since this provider wraps the whole app in the
  // root layout and shouldn't force every page into dynamic rendering.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailFromLink = params.get('email');
    const nextFromLink = params.get('next') || '';
    if (emailFromLink) {
      const target = /^\/[a-z0-9/_-]*$/i.test(nextFromLink) ? nextFromLink : '';   // a page on Prodora only, never another site
      setEmail(emailFromLink);
      setNext(target);
      window.history.replaceState({}, '', window.location.pathname);
      // The seller is already signed in to ExiusCart, so open Prodora straight away instead of asking them to
      // confirm the same email again. The login box only appears if this fails.
      setOpening(true);
      prodoraAuth.requestAccess(emailFromLink)
        .then(() => { try { localStorage.setItem(EMAIL_KEY, emailFromLink); } catch {} router.push(target || '/browse'); })
        .catch((err: any) => {
          setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
          setOpening(false);
          setShow(true);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShow(false); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [show]);

  const openModal = (n?: unknown) => {
    setNext(typeof n === 'string' && /^\/[a-z0-9/_-]*$/i.test(n) ? n : '');
    setError('');
    try { const saved = localStorage.getItem(EMAIL_KEY); if (saved) setEmail((cur) => cur || saved); } catch {}
    setShow(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await prodoraAuth.requestAccess(email.trim());
      try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch {}
      setShow(false);
      router.push(next || '/browse');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginModalContext.Provider value={{ open: openModal }}>
      {children}

      {opening && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Opening Prodora…</div>
        </div>
      )}

      {show && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShow(false); }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="prodora-login-title" className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" />
            <button
              type="button"
              onClick={() => setShow(false)}
              aria-label="Close"
              className="absolute right-4 top-5 rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="px-7 pb-7 pt-8 sm:px-8">
              <div className="mb-5 flex items-center gap-3">
                <Image src="/prodora-logo.png" alt="" width={40} height={40} className="rounded-xl" />
                <span className="text-xl font-extrabold tracking-tight text-foreground">Prodora</span>
              </div>

              <h2 id="prodora-login-title" className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Enter the email you use for your ExiusCart store to continue.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="prodora-login-email" className="mb-1.5 block text-sm font-medium text-foreground">Email address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="prodora-login-email"
                      ref={inputRef}
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                      placeholder="you@example.com"
                      className="h-12 w-full rounded-xl border border-input bg-background pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600">{error}</p>
                )}

                <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? 'Checking…' : 'Continue'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>

              <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p>No password needed. Prodora is included with every ExiusCart plan, including the free trial. Prodora AI comes with Growth and Scale.</p>
              </div>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                New to ExiusCart?{' '}
                <a href="https://exiuscart.com/register" className="font-semibold text-primary hover:underline">Start free</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </LoginModalContext.Provider>
  );
}
