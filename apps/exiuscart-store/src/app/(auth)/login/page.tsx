'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'deactivated') {
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
          window.location.href = '/dashboard';
        })();
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { authApi, shopApi } = await import('@/lib/api');
      const res = await authApi.login(email, password);
      const { access_token, user } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      // Fetch and store shop_id so all dashboard pages work immediately
      try {
        const shopRes = await shopApi.getMyShop();
        if (shopRes.data?.id) {
          localStorage.setItem('shop_id', String(shopRes.data.id));
        }
      } catch {}
      window.location.href = '/dashboard';
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'pending_approval') {
        setError('Your account is pending admin approval. You will receive an email once approved.');
      } else {
        setError(detail ?? 'Invalid email or password.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center">
        <Image src="/logo.svg" alt="ExiusCart" width={28} height={28} />
        <span className="text-lg font-bold text-white ml-2">
          <span className="text-[#6B3FD9]">Exius</span>Cart
        </span>
      </div>

      {/* Mobile — dashboard preview banner (hidden on lg, shown side-by-side there instead) */}
      <div className="lg:hidden px-6 pt-6">
        <div className="relative w-full h-48 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/20">
          <Image src="/dashboard.png" alt="ExiusCart Dashboard" fill className="object-cover object-top" priority />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center overflow-hidden">
        {/* Left — login form */}
        <div className="w-full lg:w-[45%] flex justify-center lg:justify-start px-6 lg:pl-16 py-12">
        <div className="w-full max-w-sm bg-[#151F32] border border-gray-800 rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-1">Log in to your account</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in to manage your shop</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#151F32] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-gray-400 text-sm cursor-pointer select-none">
              <input type="checkbox" defaultChecked className="rounded border-gray-700 bg-[#151F32] accent-[#6B3FD9]" />
              Remember me
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
              Log in
            </button>
          </form>

          <p className="text-center mt-6 text-gray-400 text-sm">
            Don&apos;t have an ExiusCart account?{' '}
            <Link href="https://exiuscart.com/register" className="text-[#6B3FD9] font-semibold hover:text-[#8B5CF6] transition">
              Create account
            </Link>
          </p>
        </div>
        </div>

        {/* Right — dashboard preview */}
        <div className="hidden lg:flex lg:w-[55%] items-center pl-8">
          <div className="w-[85%] rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/20">
            <Image src="/dashboard.png" alt="ExiusCart Dashboard" width={1536} height={1024} className="w-full h-auto" priority />
          </div>
        </div>
      </div>
    </div>
  );
}
