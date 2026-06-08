'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire to backend auth
    window.location.href = '/dashboard';
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
              <label className="text-sm font-medium text-gray-300 mb-1.5 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#0D1526] border border-gray-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#7B4FE9] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link href="/forgot-password" className="text-xs text-[#7B4FE9] hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-xl transition-all text-sm"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-gray-500 text-xs mt-6">
            Not an affiliate yet?{' '}
            <Link href="https://exiuscart.com/affiliates" className="text-[#7B4FE9] hover:underline">
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
