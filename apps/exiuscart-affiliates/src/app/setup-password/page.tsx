'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError('Invalid or missing setup link. Please check your email.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/affiliates/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.detail || 'Something went wrong. Try again.');

      // Store session and mark done
      localStorage.setItem('affiliate_token', body.access_token);
      localStorage.setItem('affiliate_id', String(body.affiliate_id));
      localStorage.setItem('affiliate_name', body.name || '');
      localStorage.setItem('affiliate_code', body.referral_code || '');
      setDone(true);
      setTimeout(() => router.replace('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <Image src="/logo.svg" alt="ExiusCart" width={36} height={36} />
            <span className="text-white font-bold text-lg">ExiusCart</span>
            <span className="text-[#7B4FE9] text-xs font-semibold border border-[#7B4FE9]/40 px-2 py-0.5 rounded-full">Affiliates</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Set your password</h1>
          <p className="text-gray-400 text-sm mt-1">Create a password to access your affiliate dashboard</p>
        </div>

        <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password set!</h2>
              <p className="text-gray-400 text-sm">Taking you to your dashboard...</p>
              <Loader2 className="w-5 h-5 animate-spin text-[#7B4FE9] mx-auto mt-4" />
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-5 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      minLength={8}
                      className="w-full bg-[#0D1526] border border-gray-700 rounded-xl pl-10 pr-12 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-300 mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      required
                      className="w-full bg-[#0D1526] border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                    />
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !token || password.length < 8 || password !== confirm}
                  className="w-full flex items-center justify-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isLoading ? 'Setting password...' : 'Set Password & Open Dashboard'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} ExiusCart. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B1121] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7B4FE9]" />
      </div>
    }>
      <SetupPasswordForm />
    </Suspense>
  );
}
