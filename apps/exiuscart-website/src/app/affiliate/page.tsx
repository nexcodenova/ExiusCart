'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Link2, DollarSign, Users, TrendingUp, Check, Loader2,
  ArrowLeft, Share2, Store, Zap,
} from 'lucide-react';

const HOW_IT_WORKS = [
  { step: '1', title: 'Apply below', desc: 'Fill in the form. We review and approve within 24 hours.' },
  { step: '2', title: 'Get your link', desc: 'You receive a unique link like exiuscart.com/register?ref=YOURCODE' },
  { step: '3', title: 'Share it', desc: 'Post it on social media, WhatsApp groups, YouTube, or send directly to business owners.' },
  { step: '4', title: 'Earn commission', desc: "When a referred shop pays for a plan, you earn. The more you refer each month, the higher your rate." },
];

export default function AffiliatePage() {
  const [affiliateType, setAffiliateType] = useState<'external' | 'shop_owner'>('external');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    website: '',
    how_promote: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const rates = affiliateType === 'shop_owner'
    ? { base: 25, tier2: 40 }
    : { base: 20, tier2: 35 };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setIsLoading(true);
    setError('');
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/api/v1/affiliates/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, affiliate_type: affiliateType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1121]">
      {/* Nav */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            <span className="text-[#6B3FD9]">Exius</span>Cart
          </Link>
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition">
            Sign in
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#6B3FD9]/10 text-[#6B3FD9] border border-[#6B3FD9]/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <Share2 className="w-4 h-4" />
          Affiliate Program
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
          Earn by sharing <span className="text-[#6B3FD9]">ExiusCart</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-6">
          One program. Two tracks. The more you refer each month, the more you earn.
        </p>
      </div>

      {/* Commission Tiers — two tracks side by side */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* External */}
          <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-white">External Affiliate</p>
                <p className="text-xs text-gray-500">Anyone can apply</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">1–10 referrals / month</p>
                  <p className="text-xs text-gray-600 mt-0.5">Tier 1</p>
                </div>
                <p className="text-2xl font-bold text-[#6B3FD9]">20%</p>
              </div>
              <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">11+ referrals / month</p>
                  <p className="text-xs text-gray-600 mt-0.5">Tier 2</p>
                </div>
                <p className="text-2xl font-bold text-green-400">35%</p>
              </div>
            </div>
          </div>

          {/* Shop Owner */}
          <div className="bg-[#151F32] rounded-2xl border-2 border-[#6B3FD9]/40 p-6 relative">
            <div className="absolute -top-3 right-4">
              <span className="bg-[#6B3FD9] text-black text-xs font-bold px-3 py-1 rounded-full">
                Higher Rates
              </span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#6B3FD9]/10 rounded-lg flex items-center justify-center">
                <Store className="w-5 h-5 text-[#6B3FD9]" />
              </div>
              <div>
                <p className="font-semibold text-white">ExiusCart Shop Owner</p>
                <p className="text-xs text-gray-500">Must have an active shop</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">1–10 referrals / month</p>
                  <p className="text-xs text-gray-600 mt-0.5">Tier 1</p>
                </div>
                <p className="text-2xl font-bold text-[#6B3FD9]">25%</p>
              </div>
              <div className="flex items-center justify-between bg-[#0B1121] rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs text-gray-500">11+ referrals / month</p>
                  <p className="text-xs text-gray-600 mt-0.5">Tier 2</p>
                </div>
                <p className="text-2xl font-bold text-green-400">40%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tier example callout */}
        <div className="mt-4 bg-[#6B3FD9]/5 border border-[#6B3FD9]/20 rounded-xl px-5 py-4 text-sm text-gray-400">
          <span className="text-white font-medium">Example:</span> You refer 15 shops in a month.
          The first 10 pay at your Tier 1 rate, the remaining 5 pay at Tier 2.
          Tiers reset at the start of each calendar month.
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-bold text-white text-center mb-10">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="bg-[#151F32] rounded-xl border border-gray-800 p-5 text-center">
              <div className="w-10 h-10 bg-[#6B3FD9] rounded-full flex items-center justify-center text-black font-bold text-lg mx-auto mb-4">
                {step.step}
              </div>
              <h3 className="font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Application Form */}
      <div id="apply" className="max-w-2xl mx-auto px-6 pb-20">
        <div className="bg-[#151F32] rounded-2xl border border-gray-800 p-6 lg:p-8">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Application Submitted!</h2>
              <p className="text-gray-400 mb-6">
                We'll review and get back to you at <strong className="text-white">{formData.email}</strong> within 24 hours.
              </p>
              <Link href="/" className="inline-flex items-center gap-2 text-[#6B3FD9] hover:underline text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white">Apply to become an affiliate</h2>
                <p className="text-gray-400 text-sm mt-1">Free to join. No minimum sales required.</p>
              </div>

              {/* Type Selector */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setAffiliateType('external')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                    affiliateType === 'external'
                      ? 'border-[#6B3FD9] bg-[#6B3FD9]/5'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Users className={`w-6 h-6 ${affiliateType === 'external' ? 'text-[#6B3FD9]' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${affiliateType === 'external' ? 'text-white' : 'text-gray-400'}`}>
                    External Affiliate
                  </span>
                  <span className="text-xs text-gray-500">20% → 35%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAffiliateType('shop_owner')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                    affiliateType === 'shop_owner'
                      ? 'border-[#6B3FD9] bg-[#6B3FD9]/5'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Store className={`w-6 h-6 ${affiliateType === 'shop_owner' ? 'text-[#6B3FD9]' : 'text-gray-500'}`} />
                  <span className={`text-sm font-medium ${affiliateType === 'shop_owner' ? 'text-white' : 'text-gray-400'}`}>
                    I'm a Shop Owner
                  </span>
                  <span className="text-xs text-[#6B3FD9] font-medium">25% → 40%</span>
                </button>
              </div>

              {affiliateType === 'shop_owner' && (
                <div className="mb-5 px-4 py-3 bg-[#6B3FD9]/5 border border-[#6B3FD9]/20 rounded-lg text-sm text-gray-400">
                  <Zap className="w-4 h-4 text-[#6B3FD9] inline mr-1.5" />
                  Use the <strong className="text-white">same email</strong> as your ExiusCart shop account.
                  We'll verify it automatically.
                </div>
              )}

              {/* Commission preview */}
              <div className="mb-5 flex items-center gap-4 bg-[#0B1121] rounded-xl px-4 py-3 text-sm">
                <DollarSign className="w-4 h-4 text-[#6B3FD9] flex-shrink-0" />
                <span className="text-gray-400">
                  Your rates:{' '}
                  <strong className="text-[#6B3FD9]">{rates.base}%</strong> for first 10 referrals/month,{' '}
                  <strong className="text-green-400">{rates.tier2}%</strong> after that
                </span>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Your name"
                      className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">
                      {affiliateType === 'shop_owner' ? 'ExiusCart Account Email *' : 'Email Address *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder={affiliateType === 'shop_owner' ? 'Your shop account email' : 'you@example.com'}
                      className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="+971 50 000 0000"
                      className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Company / Business</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Website / Social Media</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://yoursite.com or TikTok/Instagram link"
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">How will you promote ExiusCart?</label>
                  <textarea
                    value={formData.how_promote}
                    onChange={(e) => setFormData((p) => ({ ...p, how_promote: e.target.value }))}
                    placeholder="e.g. I manage a WhatsApp group of 500 UAE business owners, I'll share my referral link and explain the product..."
                    rows={3}
                    className="w-full px-3 py-2.5 bg-[#0B1121] border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:border-[#6B3FD9] focus:outline-none text-sm resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-black font-bold rounded-xl transition flex items-center justify-center gap-2 text-base"
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                  ) : (
                    `Apply — ${rates.base}% to ${rates.tier2}% Commission`
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  By applying you agree to our{' '}
                  <Link href="/terms" className="text-[#6B3FD9] hover:underline">Terms</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-[#6B3FD9] hover:underline">Privacy Policy</Link>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

