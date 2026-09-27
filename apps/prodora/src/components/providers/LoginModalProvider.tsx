'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prodoraAuth } from '@/lib/api';

// open() shows the login step; open('/ai') makes it land on that Prodora page afterwards. It is also used directly as a click
// handler, so anything that is not a plain path string (a click event) is ignored.
const LoginModalContext = createContext<{ open: (next?: unknown) => void }>({ open: () => {} });

export const useLoginModal = () => useContext(LoginModalContext);

export default function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [next, setNext] = useState('');
  const [opening, setOpening] = useState(false);

  // Coming from the ExiusCart dashboard's Prodora link — the account email
  // is already known, so open straight into this step pre-filled instead of
  // landing on a bare homepage the seller has to click around on and retype
  // an email they never had to type in the first place. Plain browser API
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
        .then(() => router.push(target || '/browse'))
        .catch((err: any) => {
          setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
          setOpening(false);
          setShow(true);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await prodoraAuth.requestAccess(email);
      setShow(false);
      router.push(next || '/browse');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginModalContext.Provider value={{ open: (n?: unknown) => { setNext(typeof n === 'string' && /^\/[a-z0-9/_-]*$/i.test(n) ? n : ''); setShow(true); } }}>
      {children}

      {opening && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Opening Prodora…</div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-6 relative">
            <button
              type="button"
              onClick={() => setShow(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-foreground mb-1">Log in to Prodora</h2>
            <p className="text-sm text-muted-foreground mb-5">Use your ExiusCart account email.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-12 px-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Prodora is included with every ExiusCart plan (Launch, Growth and Scale), including the free trial.
              </p>
              {error && (
                <p className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2.5">{error}</p>
              )}
              <Button type="submit" size="lg" className="w-full text-lg" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
              </Button>
            </form>
          </div>
        </div>
      )}
    </LoginModalContext.Provider>
  );
}
