'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BorderBeam } from '@/components/ui/border-beam';
import { WELCOME_FLAG } from '@/components/welcome-splash';
import { SocialAuthButtons, type SocialProvider } from '@/components/auth/social-auth-buttons';
import { AuthHeader } from '@/components/auth/auth-header';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  // Pre-fill the email from last time when "Remember me" was left on. Only
  // the email is ever stored — never the password.
  useEffect(() => {
    const saved = localStorage.getItem('remembered_email');
    if (saved) setEmail(saved);
    else setRememberMe(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (reason === 'refunded') {
      setError('Your account was refunded and has been blocked. Contact support for details.');
      window.history.replaceState(null, '', window.location.pathname);
    } else if (reason === 'deactivated') {
      setError('Your account has been deactivated. Please contact support.');
      window.history.replaceState(null, '', window.location.pathname);
    }

    const hash = window.location.hash;
    if (hash.startsWith('#token=')) {
      const token = hash.slice(7);
      if (token) {
        window.history.replaceState(null, '', window.location.pathname);
        localStorage.setItem('access_token', token);
        (async () => {
          try {
            const { shopApi } = await import('@/lib/api');
            const shopRes = await shopApi.getMyShop();
            if (shopRes.data?.id) localStorage.setItem('shop_id', String(shopRes.data.id));
          } catch {}
          try { sessionStorage.setItem(WELCOME_FLAG, '1'); } catch {}
          window.location.href = '/dashboard';
        })();
      }
    }
  }, []);

  // Shared by the email/password and social paths: persist the session, look
  // up the shop, flag the welcome splash, and land on the dashboard.
  const finishLogin = async (access_token: string, user: unknown) => {
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    try {
      const { shopApi } = await import('@/lib/api');
      const shopRes = await shopApi.getMyShop();
      if (shopRes.data?.id) localStorage.setItem('shop_id', String(shopRes.data.id));
    } catch {}
    try { sessionStorage.setItem(WELCOME_FLAG, '1'); } catch {}
    window.location.href = '/dashboard';
  };

  const handleSocial = async (provider: SocialProvider, token: string, extra?: { name?: string }) => {
    setError('');
    try {
      const { authApi } = await import('@/lib/api');
      // Signing in only: a social login here never creates an account (that
      // happens on the sign-up page, where the terms are accepted).
      const res = await authApi.social(provider, token, extra?.name, false);
      await finishLogin(res.data.access_token, res.data.user);
    } catch (err: any) {
      throw new Error(err?.response?.data?.detail ?? 'Sign-in failed. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { authApi } = await import('@/lib/api');
      const res = await authApi.login(email, password);
      const { access_token, user } = res.data;
      if (rememberMe) localStorage.setItem('remembered_email', email);
      else localStorage.removeItem('remembered_email');
      await finishLogin(access_token, user);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'pending_approval') {
        setError('Your account is pending admin approval. You will receive an email once approved.');
      } else {
        setError(typeof detail === 'string' ? detail : 'Invalid email or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#6B3FD9] focus:border-transparent focus:outline-none transition text-sm [@media(max-height:760px)]:py-1.5';

  const loginFormCard = (
    <Card className="relative overflow-hidden w-full max-w-md bg-white border-gray-200 rounded-2xl shadow-sm p-5 [@media(max-height:760px)]:p-4">
      <BorderBeam />
      <h2 className="text-xl font-bold text-gray-900 text-center">Log in to your account</h2>
      <p className="text-gray-500 text-sm text-center mt-0.5 mb-3 [@media(max-height:700px)]:hidden">Sign in to manage your shop</p>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="mb-2.5">
        <SocialAuthButtons apiBase={API_BASE} onToken={handleSocial} onError={setError} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label htmlFor="email" className="text-xs font-medium text-gray-800 mb-0.5 block">Email</label>
          <input
            id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className={inputClass} placeholder="Enter your email address"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-xs font-medium text-gray-800 mb-0.5 block">Password</label>
          <div className="relative">
            <input
              id="password" type={showPassword ? 'text' : 'password'} value={password}
              onChange={(e) => setPassword(e.target.value)} required
              className={`${inputClass} pr-11`} placeholder="Enter your password"
            />
            <button
              type="button" onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-gray-600 text-sm cursor-pointer select-none">
            <input
              type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-gray-300 bg-gray-50 accent-[#6B3FD9]"
            />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-[#6B3FD9] hover:text-[#5A2EC9] transition">
            Forgotten your password?
          </Link>
        </div>

        <button
          type="submit" disabled={isLoading}
          className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          Log in
        </button>
      </form>

      <p className="text-center mt-3 text-gray-600 text-sm">
        Don&apos;t have an ExiusCart account?{' '}
        <Link href="https://exiuscart.com/register" className="text-[#6B3FD9] font-semibold hover:text-[#5A2EC9] transition">
          Create account
        </Link>
      </p>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col">
      <AuthHeader />

      <div className="flex-1 mx-auto grid w-full max-w-6xl content-center items-center gap-10 px-4 py-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <div className="flex flex-col items-center gap-3">
          {loginFormCard}
          <p className="text-xs text-gray-500 text-center">
            Need a hand? <a href="mailto:support@exiuscart.com" className="text-[#6B3FD9] hover:underline">support@exiuscart.com</a>
            {' · '}
            <a href="https://wa.me/971562393573" target="_blank" rel="noopener noreferrer" className="text-[#6B3FD9] hover:underline">WhatsApp +971 562 393 573</a>
          </p>
        </div>

        <div className="hidden lg:flex flex-col justify-center">
          <div className="rounded-3xl bg-gradient-to-br from-[#1B1146] via-[#2B1A6E] to-[#4A2EC9] p-8 shadow-xl">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Run your whole business<br />from one dashboard.
            </h2>
            <p className="mt-2 text-sm text-indigo-200">POS, inventory, invoicing and every sales channel in one place.</p>
            <div className="mt-6 overflow-hidden rounded-xl border border-white/15 shadow-2xl">
              <Image src="/auth-preview.webp" alt="ExiusCart dashboard" width={1400} height={933} priority className="h-auto w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
