'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { authApi } from '@/lib/api';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords don’t match.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset link missing" subtitle="This page needs the link from your reset email.">
        <Link href="/forgot-password" className="block rounded-2xl bg-[#6B3FD9] py-3 text-center font-semibold text-white hover:bg-[#5A2EC9]">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Password updated">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="mb-6 text-sm text-gray-600">Your password has been changed. You can log in with it now.</p>
        <Link href="/login" className="block rounded-2xl bg-[#6B3FD9] py-3 text-center font-semibold text-white hover:bg-[#5A2EC9]">
          Log in
        </Link>
      </AuthShell>
    );
  }

  const field = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]';
  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}{' '}
          {/expired|invalid/i.test(error) && (
            <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>
          )}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-500">New password</label>
          <div className="relative">
            <input id="password" type={show ? 'text' : 'password'} required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" className={field} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1 block text-xs font-medium text-gray-500">Confirm new password</label>
          <input id="confirm" type={show ? 'text' : 'password'} required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" className={field} />
        </div>
        <button type="submit" disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6B3FD9] py-3 font-semibold text-white transition hover:bg-[#5A2EC9] disabled:opacity-50">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Update password
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
