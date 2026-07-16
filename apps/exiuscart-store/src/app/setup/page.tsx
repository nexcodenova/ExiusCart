'use client';

import Image from 'next/image';
import { Suspense, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

function SetupForm() {
  const params       = useSearchParams();
  const token        = params.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    if (!token) setError('Missing or invalid setup link. Please request a new one.');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { authApi } = await import('@/lib/api');
      const res = await authApi.setupPassword(token, password);
      if (res.data?.status === 'pending_approval') {
        setPendingApproval(true);
        setDone(true);
        return;
      }
      const { access_token, user } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      setDone(true);
      setTimeout(() => { window.location.href = '/dashboard'; }, 1800);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Setup link is invalid or has expired. Please contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B1121] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/logo.svg" alt="ExiusCart" width={36} height={36} />
            <span className="text-2xl font-bold text-white">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          </div>

          {done ? (
            <div className="text-center">
              <CheckCircle className="h-14 w-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Password set!</h2>
              <p className="text-gray-400 text-sm">
                {pendingApproval
                  ? "Your account is still pending admin approval — we'll email you as soon as it's ready to log in."
                  : 'Taking you to your dashboard…'}
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white text-center mb-1">Set Your Password</h2>
              <p className="text-gray-400 text-center text-sm mb-6">
                Welcome to ExiusCart. Create a password to access your store.
              </p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition pr-12"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
                    placeholder="Re-enter your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !token}
                  className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  Activate My Account
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense>
      <SetupForm />
    </Suspense>
  );
}
