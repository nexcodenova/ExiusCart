'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6B3FD9]/10">
          <MailCheck className="h-6 w-6 text-[#6B3FD9]" />
        </div>
        <p className="text-sm leading-relaxed text-gray-600">
          If an account exists for <span className="font-semibold text-gray-900">{email}</span>, we&apos;ve sent a link to reset your
          password. It expires in 1 hour and works once.
        </p>
        <p className="mt-3 text-xs text-gray-400">Nothing there? Check your spam folder.</p>
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-[#6B3FD9] hover:text-[#5A2EC9]">
          Back to log in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to reset it.">
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-500">Email</label>
          <input
            id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6B3FD9] py-3 font-semibold text-white transition hover:bg-[#5A2EC9] disabled:opacity-50"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          Send reset link
        </button>
      </form>
      <Link href="/login" className="mt-6 block text-center text-sm text-gray-500 hover:text-gray-700">
        Back to log in
      </Link>
    </AuthShell>
  );
}
