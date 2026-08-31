'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, MessageCircle, Phone, Clock,
  Users2, DollarSign, Wallet2, LineChart, Megaphone, Trophy, LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BorderBeam } from '@/components/ui/border-beam';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

interface FeatureBadge {
  label: string;
  icon: LucideIcon;
  delay: number;
  duration: number;
}

const FEATURE_BADGES: FeatureBadge[] = [
  { label: 'Referrals', icon: Users2, delay: 0, duration: 4.2 },
  { label: 'Commission', icon: DollarSign, delay: 0.4, duration: 3.8 },
  { label: 'Payouts', icon: Wallet2, delay: 0.8, duration: 4.6 },
  { label: 'Analytics', icon: LineChart, delay: 1.2, duration: 4 },
  { label: 'Marketing Assets', icon: Megaphone, delay: 1.6, duration: 4.4 },
  { label: 'Leaderboard', icon: Trophy, delay: 2, duration: 3.6 },
];

// Light theme now, matching exiuscart-store's login page badges exactly.
function FeatureBadgeCard({ badge }: { badge: FeatureBadge }) {
  const Icon = badge.icon;
  return (
    <div
      className="float-card flex items-center gap-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3"
      style={{
        '--card-delay': `${badge.delay}s`,
        '--card-duration': `${badge.duration}s`,
      } as React.CSSProperties}
    >
      <div className="w-9 h-9 rounded-xl bg-[#6B3FD9]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#6B3FD9]" />
      </div>
      <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{badge.label}</span>
    </div>
  );
}

// Same real contact details as the marketing site's Contact page and
// exiuscart-store's login page, same light styling too now.
function ContactBlock() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#6B3FD9] mb-4">
        Need a hand?
      </p>
      <div className="space-y-4">
        <a href="https://wa.me/971562393573" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-[#25D366]/15 rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle className="w-4.5 h-4.5 text-[#25D366]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">WhatsApp</p>
            <span className="text-sm text-gray-900 font-medium group-hover:text-[#6B3FD9] transition-colors">+971 562 393 573</span>
          </div>
        </a>
        <a href="mailto:support@exiuscart.com" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center shrink-0">
            <Mail className="w-4.5 h-4.5 text-[#6B3FD9]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Email</p>
            <span className="text-sm text-gray-900 font-medium group-hover:text-[#6B3FD9] transition-colors">support@exiuscart.com</span>
          </div>
        </a>
        <a href="tel:+971562393573" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center shrink-0">
            <Phone className="w-4.5 h-4.5 text-[#6B3FD9]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Phone</p>
            <span className="text-sm text-gray-900 font-medium group-hover:text-[#6B3FD9] transition-colors">+971 562 393 573</span>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-xl flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5 text-[#6B3FD9]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Business Hours</p>
            <p className="text-sm text-gray-900 font-medium">Sun–Thu: 9 AM – 6 PM</p>
            <p className="text-xs text-gray-500">Fri: 9 AM – 12 PM · Sat: Closed</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Invalid email or password');
      }
      const body = await res.json();
      localStorage.setItem('affiliate_token', body.access_token);
      localStorage.setItem('affiliate_id', String(body.affiliate_id));
      localStorage.setItem('affiliate_name', body.name || '');
      localStorage.setItem('affiliate_email', body.email || '');
      localStorage.setItem('affiliate_code', body.referral_code || '');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Unchanged card content — same fields/behavior throughout every
  // revision of this page's layout.
  const loginColumn = (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-3">
          <Image src="/logo.svg" alt="ExiusCart" width={36} height={36} />
          <span className="text-gray-900 font-bold text-lg">
            <span className="text-[#6B3FD9]">Exius</span>Cart
          </span>
          <span className="text-[#6B3FD9] text-xs font-semibold border border-[#6B3FD9]/30 px-2 py-0.5 rounded-full">Affiliates</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Affiliate Portal</h1>
        <p className="text-gray-500 text-sm mt-1">Sign in to track your earnings &amp; referrals</p>
      </div>

      {/* Card */}
      <Card className="relative overflow-hidden bg-white border-gray-200 shadow-sm p-10">
        <BorderBeam />
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B3FD9] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                required
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-12 py-3 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B3FD9] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all text-sm mt-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-6">
          Not an affiliate yet?{' '}
          <Link href="https://exiuscart.com/affiliate" className="text-[#6B3FD9] hover:underline">
            Apply here
          </Link>
        </p>
      </Card>

      <p className="text-center text-gray-500 text-xs mt-6">
        © {new Date().getFullYear()} ExiusCart. All rights reserved.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center px-4">
      {/* Desktop (lg+) — feature badges (wrapping to 2 lines within the
          column's own width) stacked above contact info, both in the
          left column; the login card on the right. */}
      <div className="hidden lg:flex items-center justify-center px-10 py-6 w-full">
        <div className="grid grid-cols-2 gap-16 max-w-6xl w-full items-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-3">
              {FEATURE_BADGES.map((badge) => (
                <FeatureBadgeCard key={badge.label} badge={badge} />
              ))}
            </div>
            <ContactBlock />
          </div>
          <div className="flex justify-center">
            {loginColumn}
          </div>
        </div>
      </div>

      {/* Mobile / tablet (<lg) — single centered column, no badges/contact. */}
      <div className="lg:hidden w-full flex justify-center">
        {loginColumn}
      </div>
    </div>
  );
}
