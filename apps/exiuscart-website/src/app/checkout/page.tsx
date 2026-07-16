'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, Check, Lock, CreditCard, ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { useCurrency } from '@/context/currency-context';
import { pricing } from '@/config/pricing';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.exiuscart.com';

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    '1,000 products',
    '1,000 orders / month',
    '5,000 customers',
    '3 user accounts',
    'Full POS & Invoicing',
    'VAT invoicing (5%)',
    'Shopify / WooCommerce sync',
    'Custom website sync',
    'HR & Payroll',
    '500 leads · Meta Ads capture',
    'Advanced sales reports',
    'Data export (Excel / CSV)',
    'Chat support',
  ],
  premium: [
    'Unlimited products & orders',
    'Unlimited customers & users',
    'Unlimited leads',
    'Full invoice branding',
    'Send from own domain',
    'Multi-store & multi-location',
    'Unlimited email campaigns',
    'Advanced analytics',
    'Priority support + onboarding',
  ],
};

function AedSign({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 26 32" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2L6 30L13 30C20 30 24 25 24 16C24 7 20 2 13 2Z" />
      <line x1="1" y1="11" x2="8" y2="11" />
      <line x1="1" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = (searchParams.get('plan') || 'starter') as 'starter' | 'premium';
  const billing = (searchParams.get('billing') || 'monthly') as 'monthly' | 'yearly';
  const paymentStatus = searchParams.get('status'); // 'success' after returning from Lemon Squeezy
  const { currency } = useCurrency();

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const prices = pricing[currency];
  const price = billing === 'monthly' ? prices[plan]?.monthly : prices[plan]?.yearly;
  const period = billing === 'monthly' ? '/month' : '/year';
  const planName = plan === 'starter' ? 'Starter' : 'Premium';
  const features = PLAN_FEATURES[plan] || [];
  const isAed = currency === 'AED';

  const yearlySavings = billing === 'yearly'
    ? Math.round(prices[plan].monthly * 12 - prices[plan].yearly)
    : 0;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/checkout-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          email: email.trim(),
          plan_type: plan,
          billing_type: billing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError('Could not reach the server. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm mb-8 transition">
          <ArrowLeft className="w-4 h-4" />
          Back to pricing
        </Link>

        <div className="grid md:grid-cols-2 gap-8 items-start">

          {/* Left — Plan Summary */}
          <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B3FD9]">
              {planName} Plan
            </span>

            <div className="mt-4 mb-1 flex items-start gap-2">
              {isAed ? (
                <AedSign className="w-5 h-7 mt-3 text-gray-400 shrink-0" />
              ) : (
                <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
              )}
              <span className="text-[3.5rem] font-black text-gray-900 tracking-tight leading-none">{price}</span>
              <span className="text-gray-400 text-sm self-end mb-1">{period}</span>
            </div>

            {billing === 'yearly' && yearlySavings > 0 && (
              <p className="text-sm text-emerald-600 font-medium mb-2">
                You save {isAed ? 'AED' : '$'}{yearlySavings}/year vs monthly billing
              </p>
            )}

            <div className="flex gap-2 mt-4 mb-6">
              <Link
                href={`/checkout?plan=${plan}&billing=monthly`}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${billing === 'monthly' ? 'bg-[#0B1121] text-white border-[#0B1121]' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                Monthly
              </Link>
              <Link
                href={`/checkout?plan=${plan}&billing=yearly`}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-[#0B1121] text-white border-[#0B1121]' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                Yearly
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Save 15%</span>
              </Link>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">What&apos;s included</p>
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-5 h-5 rounded-full bg-[#6B3FD9]/10 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-[#6B3FD9]" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-5 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-[#6B3FD9]" /> 7-day money-back</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3 text-[#6B3FD9]" /> Cancel anytime</span>
            </div>
          </div>

          {/* Right — Payment */}
          <div className="space-y-4">

            {paymentStatus === 'success' ? (
              /* Returned from Lemon Squeezy after a successful pre-signup payment */
              <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm text-center">
                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100 mx-auto">
                  <MailCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Payment received!</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Check your email for a link to set your password. Your account is being reviewed and you&apos;ll get a second email as soon as it&apos;s approved and your dashboard is ready.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Complete your purchase</h2>
                <p className="text-sm text-gray-500 mb-6">You&apos;ll be redirected to our secure payment page.</p>

                <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{planName} — {billing}</span>
                    <span className="font-bold text-gray-900">
                      {isAed ? 'AED' : '$'}{price}{period}
                    </span>
                  </div>
                  {billing === 'yearly' && yearlySavings > 0 && (
                    <div className="flex justify-between items-center text-xs text-emerald-600 mt-1">
                      <span>Savings vs monthly</span>
                      <span>–{isAed ? 'AED' : '$'}{yearlySavings}/yr</span>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
                    {error}
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Business name</label>
                    <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required
                      placeholder="Your shop name"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#6B3FD9] focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#6B3FD9] focus:outline-none transition" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-4 rounded-2xl transition-all text-base disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  {submitting ? 'Redirecting…' : 'Pay now'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-4">
                  <Lock className="w-3.5 h-3.5" />
                  Secured by Lemon Squeezy · SSL encrypted
                </p>

                <p className="text-center text-xs text-gray-400 mt-4">
                  Prefer to try first?{' '}
                  <Link href={`/register?plan=${plan}&billing=${billing}`} className="text-[#6B3FD9] font-semibold hover:underline">
                    Start a free trial instead
                  </Link>
                </p>
              </form>
            )}

            {/* Also want bank transfer? */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-700 mb-1">Need to pay by bank transfer?</p>
              <p className="text-xs text-gray-500 mb-3">We accept bank transfers for annual plans. Contact us and we&apos;ll send an invoice.</p>
              <Link href="/contact" className="text-sm text-[#6B3FD9] font-semibold hover:underline">
                Request invoice →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
