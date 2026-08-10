'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Loader2, Megaphone, Mail, Target, UserPlus, Store, TrendingUp,
  ShoppingBag, Package, Boxes, Users, BarChart3, Wallet, Award, Globe, Ticket,
  CreditCard, LucideIcon,
} from 'lucide-react';

interface FeatureCard {
  label: string;
  icon: LucideIcon;
  top: string;
  left: string;
  delay: number;
  duration: number;
}

// A full ring around the centered login card — top arc, bottom arc, and
// short side columns filling the vertical middle — rather than just two
// side columns. The card's own bounding box is roughly 34%-66% horizontal,
// so the top/bottom rows (low/high `top`, any `left`) always clear it
// vertically, and the side columns stay left of 15% / right of 82% to clear
// it horizontally. Each card has its own float delay/duration so the ring
// drifts asynchronously rather than bobbing in unison — straight up/down,
// no tilt.
const FEATURE_CARDS: FeatureCard[] = [
  // Top arc
  { label: 'Marketing', icon: Megaphone, top: '9%', left: '8%', delay: 0, duration: 4.2 },
  { label: 'Ads', icon: Target, top: '13%', left: '25%', delay: 0.4, duration: 3.8 },
  { label: 'Leads', icon: UserPlus, top: '8%', left: '42%', delay: 0.8, duration: 4.6 },
  { label: 'Email Campaigns', icon: Mail, top: '12%', left: '59%', delay: 1.2, duration: 4 },
  { label: 'Sales', icon: TrendingUp, top: '9%', left: '76%', delay: 1.6, duration: 4.4 },

  // Right column (vertical middle, beside the card)
  { label: 'POS', icon: Store, top: '32%', left: '74%', delay: 2, duration: 3.6 },
  { label: 'Products', icon: Package, top: '50%', left: '78%', delay: 2.4, duration: 4.2 },
  { label: 'Analytics', icon: BarChart3, top: '68%', left: '75%', delay: 2.8, duration: 4.6 },

  // Bottom arc
  { label: 'Orders', icon: ShoppingBag, top: '89%', left: '9%', delay: 0.2, duration: 4 },
  { label: 'Inventory', icon: Boxes, top: '86%', left: '26%', delay: 0.6, duration: 4.4 },
  { label: 'Wallet', icon: Wallet, top: '90%', left: '43%', delay: 1, duration: 3.8 },
  { label: 'Channels', icon: Globe, top: '87%', left: '60%', delay: 1.4, duration: 4.6 },
  { label: 'Coupons', icon: Ticket, top: '91%', left: '77%', delay: 1.8, duration: 4.2 },

  // Left column (vertical middle, beside the card)
  { label: 'Customers', icon: Users, top: '32%', left: '15%', delay: 2.2, duration: 4 },
  { label: 'Loyalty', icon: Award, top: '50%', left: '19%', delay: 2.6, duration: 4.4 },
  { label: 'Payments', icon: CreditCard, top: '68%', left: '16%', delay: 3, duration: 3.6 },
];

function FeatureCardBadge({ card }: { card: FeatureCard }) {
  const Icon = card.icon;
  return (
    <div
      className="float-card absolute flex items-center gap-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm px-4 py-3"
      style={{
        top: card.top,
        left: card.left,
        '--card-delay': `${card.delay}s`,
        '--card-duration': `${card.duration}s`,
      } as React.CSSProperties}
    >
      <div className="w-9 h-9 rounded-xl bg-[#6B3FD9]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#6B3FD9]" />
      </div>
      <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">{card.label}</span>
    </div>
  );
}

// Mobile — a phone has no room for a labeled card beside the form, let
// alone a full ring around it, so this is icon-only: a small floating
// circle, wrapped in bands above/below the form instead of positioned
// around it. The label is still there for accessibility (title + aria-label).
function IconOnlyBadge({ card }: { card: FeatureCard }) {
  const Icon = card.icon;
  return (
    <div
      title={card.label}
      aria-label={card.label}
      className="float-card w-11 h-11 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0"
      style={{
        '--card-delay': `${card.delay}s`,
        '--card-duration': `${card.duration}s`,
      } as React.CSSProperties}
    >
      <Icon className="w-5 h-5 text-[#6B3FD9]" />
    </div>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Pre-fill the email from last time when "Remember me" was left on. Only
  // the email is ever stored — never the password.
  useEffect(() => {
    const saved = localStorage.getItem('remembered_email');
    if (saved) setEmail(saved);
    else setRememberMe(false);
  }, []);

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
      if (rememberMe) localStorage.setItem('remembered_email', email);
      else localStorage.removeItem('remembered_email');
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

      {/* Main — the login form is always centered; on desktop it's ringed
          by full labeled cards positioned absolutely around it (see
          FEATURE_CARDS above); on mobile there's no room for that scatter,
          so the same set becomes icon-only badges wrapped in bands directly
          above and below the form instead of one scrolling line. */}
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden py-8 lg:py-12 gap-5">
        {/* Feature cards — desktop only, need real room to ring the card
            without crowding it */}
        <div className="hidden lg:block absolute inset-0">
          {/* Soft brand-colored glow behind the cards, filling the empty space */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 rounded-full bg-[#6B3FD9]/10 blur-3xl" />
          </div>
          {FEATURE_CARDS.map((card) => (
            <FeatureCardBadge key={card.label} card={card} />
          ))}
        </div>

        {/* Mobile — first half of the icon set, wrapped above the form */}
        <div className="lg:hidden flex flex-wrap items-center justify-center gap-2.5 max-w-[280px]">
          {FEATURE_CARDS.slice(0, 8).map((card) => (
            <IconOnlyBadge key={card.label} card={card} />
          ))}
        </div>

        {/* Login form — centered, always on top */}
        <div className="relative z-10 w-full flex justify-center px-6">
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
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300 bg-gray-50 accent-[#6B3FD9]"
              />
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

        {/* Mobile — second half of the icon set, wrapped below the form */}
        <div className="lg:hidden flex flex-wrap items-center justify-center gap-2.5 max-w-[280px]">
          {FEATURE_CARDS.slice(8).map((card) => (
            <IconOnlyBadge key={card.label} card={card} />
          ))}
        </div>
      </div>
    </div>
  );
}
