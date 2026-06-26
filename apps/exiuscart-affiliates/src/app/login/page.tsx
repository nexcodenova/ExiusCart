'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/affiliates/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid email or access code');
      }
      const body = await res.json();
      localStorage.setItem('affiliate_token', body.access_token);
      localStorage.setItem('affiliate_id', String(body.affiliate_id));
      localStorage.setItem('affiliate_name', body.name || '');
      localStorage.setItem('affiliate_code', body.referral_code || '');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
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
          <h1 className="text-2xl font-bold text-white">Affiliate Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to track your earnings & referrals</p>
        </div>

        {/* Card */}
        <div className="bg-[#151F32] border border-gray-800 rounded-2xl p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#0D1526] border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">
                Access Code
                <span className="ml-2 text-xs text-gray-500 font-normal">(your affiliate referral code)</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. JOHN8F2A"
                  required
                  className="w-full bg-[#0D1526] border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-[#7B4FE9] transition-colors"
                />
              </div>
              <p className="text-xs text-gray-600 mt-1.5">Your access code was emailed when your application was approved.</p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-xs mt-6">
            Not an affiliate yet?{' '}
            <Link href="https://exiuscart.com/affiliate" className="text-[#7B4FE9] hover:underline">
              Apply here
            </Link>
          </p>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} ExiusCart. All rights reserved.
        </p>
      </div>
    </div>
  );
}
