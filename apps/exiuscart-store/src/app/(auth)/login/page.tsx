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
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center">
        <Image src="/logo.svg" alt="ExiusCart" width={28} height={28} />
        <span className="text-lg font-bold text-gray-900 ml-2">
          <span className="text-[#6B3FD9]">Exius</span>Cart
        </span>
      </div>

      {/* Mobile — dashboard preview banner (hidden on lg, shown side-by-side there instead) */}
      <div className="lg:hidden px-6 pt-6">
        <div className="relative w-full h-48 rounded-2xl overflow-hidden shadow-sm border border-gray-200">
          <Image src="/dashboard.png" alt="ExiusCart Dashboard" fill className="object-cover object-top" priority />
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center overflow-hidden">
        {/* Left — login form */}
        <div className="relative z-10 w-full lg:w-[45%] flex justify-center lg:justify-start px-6 lg:pl-56 py-12">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Log in to your account</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in to manage your shop</p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#6B3FD9] focus:outline-none transition"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#6B3FD9] focus:outline-none transition pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-gray-500 text-sm cursor-pointer select-none">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 bg-gray-50 accent-[#6B3FD9]" />
              Remember me
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
              Log in
            </button>
          </form>

          <p className="text-center mt-6 text-gray-500 text-sm">
            Don&apos;t have an ExiusCart account?{' '}
            <Link href="https://exiuscart.com/register" className="text-[#6B3FD9] font-semibold hover:text-[#5A2EC9] transition">
              Create account
            </Link>
          </p>
        </div>
        </div>

        {/* Right — dashboard preview: overlaps into the login card's middle, full image, no crop */}
        <div className="hidden lg:flex lg:w-[55%] items-center -ml-48">
          <div className="w-[95%] rounded-2xl overflow-hidden shadow-sm border border-gray-200">
            <Image src="/dashboard.png" alt="ExiusCart Dashboard" width={1536} height={1024} className="w-full h-auto" priority />
          </div>
        </div>
      </div>
    </div>
  );
}
