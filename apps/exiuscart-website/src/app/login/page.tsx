'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ArrowLeft, BarChart3, Zap, ShieldCheck, Package } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

const features = [
  { icon: BarChart3, text: 'Real-time sales & analytics' },
  { icon: Zap,       text: 'Fast & easy POS system' },
  { icon: Package,   text: 'Inventory & order management' },
  { icon: ShieldCheck, text: 'Secure & always reliable' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';
const STORE_URL = process.env.NEXT_PUBLIC_STORE_URL || 'https://store.exiuscart.com';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid email or password.');
      }
      const body = await res.json();
      const token = body.access_token;
      // Pass token to store via hash fragment (never sent to server)
      window.location.href = `${STORE_URL}/login#token=${token}`;
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121] flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#151F32] to-[#0B1121] flex-col justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#6B3FD9] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#6B3FD9] rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 mb-12">
            <span className="text-2xl font-bold text-white tracking-tight">
              <span className="text-[#6B3FD9]">Exius</span>Cart
            </span>
          </Link>

          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Welcome Back to<br />
            <span className="text-[#6B3FD9]">Your Dashboard</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10">
            Sign in to manage your store, track orders, and grow your business.
          </p>

          <div className="space-y-5">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-[#6B3FD9]" />
                </div>
                <span className="text-gray-300 text-base">{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800">
            <p className="text-gray-500 text-sm">
              New here? Start your 14-day free trial — no credit card needed.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <header className="p-4 sm:p-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to home</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <Link href="/" className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <span className="text-2xl font-bold text-white tracking-tight">
                <span className="text-[#6B3FD9]">Exius</span>Cart
              </span>
            </Link>

            <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">Welcome Back</h2>
              <p className="text-gray-400 text-sm mb-6">Sign in to your account to continue</p>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-4 py-3 mb-5">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm text-gray-400 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    {...register('email')}
                    className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition"
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      className="w-full px-4 py-3 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#6B3FD9] focus:outline-none transition pr-12"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-sm mt-1">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-600 bg-[#0B1121] text-[#6B3FD9] focus:ring-[#6B3FD9] focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-400">Remember me</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-[#6B3FD9] hover:text-[#8B5CF6] transition"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <p className="text-center mt-6 text-gray-400 text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-[#6B3FD9] font-semibold hover:text-[#8B5CF6] transition">
                  Start free trial
                </Link>
              </p>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-gray-600 text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Secured with SSL encryption</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
