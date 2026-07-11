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
    <div className="min-h-screen flex items-center justify-center bg-[#0B1121] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-8">
          <div className="flex items-center justify-center gap-2 mb-8">
            <Image src="/logo.svg" alt="ExiusCart" width={36} height={36} />
            <span className="text-2xl font-bold text-white">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          </div>

          <h2 className="text-xl font-bold text-white text-center mb-1">Welcome Back</h2>
          <p className="text-gray-400 text-center text-sm mb-6">Sign in to manage your shop</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
                placeholder="you@example.com"
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
                  className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition pr-12"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
              Sign In
            </button>
          </form>

          <p className="text-center mt-6 text-gray-400 text-sm">
            Don&apos;t have an account?{' '}
            <Link href="https://exiuscart.com/register" className="text-[#6B3FD9] font-semibold hover:text-[#8B5CF6] transition">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
