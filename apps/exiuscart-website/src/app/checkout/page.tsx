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
  launch: [
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
  growth: [
    '3 of 8+ sales channels',
    '2 of 3 dropship suppliers',
    '2,000 leads · Meta Ads capture',
    '1,000 products',
    '1,000 orders / month',
    '5,000 customers',
    '3 user accounts',
    'Full POS & Invoicing',
    'Advanced sales reports',
    'Data export (Excel / CSV)',
    'Chat support',
  ],
  scale: [
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

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = (searchParams.get('plan') || 'launch') as 'launch' | 'growth' | 'scale';
  const billing = (searchParams.get('billing') || 'monthly') as 'monthly' | 'yearly';
  // trial=dollar — the $1-for-7-days path (Growth/Scale's "Try for $1" CTA).
  // Charges $1 today instead of the full plan price; full billing starts
  // automatically after the 7-day window.
  const trialDollar = searchParams.get('trial') === 'dollar';
  const paymentStatus = searchParams.get('status'); // 'success' after returning from Lemon Squeezy
  const { currency } = useCurrency();

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const prices = pricing[currency];
  const fullPrice = billing === 'monthly' ? prices[plan]?.monthly : prices[plan]?.yearly;
  const price = trialDollar ? 1 : fullPrice;
  const period = trialDollar ? ' today' : billing === 'monthly' ? '/month' : '/year';
  const planName = plan === 'launch' ? 'Launch' : plan === 'growth' ? 'Growth' : 'Scale';
  const features = PLAN_FEATURES[plan] || [];

  const yearlySavings = !trialDollar && billing === 'yearly'
    ? Math.round(prices[plan].monthly * 12 - prices[plan].yearly)
    : 0;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !email.trim() || !agreedToTerms) return;
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
          trial_dollar: trialDollar,
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
              <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
              <span className="text-[3.5rem] font-black text-gray-900 tracking-tight leading-none">{price}</span>
              <span className="text-gray-400 text-sm self-end mb-1">{period}</span>
            </div>

            {trialDollar ? (
              <p className="text-sm text-gray-500 mb-2">
                $1 covers your first 7 days — after that, ${fullPrice}{billing === 'monthly' ? '/month' : '/year'}. Cancel anytime.
              </p>
            ) : billing === 'yearly' && yearlySavings > 0 && (
              <p className="text-sm text-emerald-600 font-medium mb-2">
                You save ${yearlySavings}/year vs monthly billing
              </p>
            )}

            <div className="flex gap-2 mt-4 mb-6">
              <Link
                href={`/checkout?plan=${plan}&billing=monthly${trialDollar ? '&trial=dollar' : ''}`}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${billing === 'monthly' ? 'bg-[#0B1121] text-white border-[#0B1121]' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                Monthly
              </Link>
              <Link
                href={`/checkout?plan=${plan}&billing=yearly${trialDollar ? '&trial=dollar' : ''}`}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-[#0B1121] text-white border-[#0B1121]' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}
              >
                Yearly
                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Save 25%</span>
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
                  Check your email for a link to set your password — your dashboard is ready as soon as you do.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {trialDollar ? 'Start your $1 trial' : 'Complete your purchase'}
                </h2>
                <p className="text-sm text-gray-500 mb-6">You&apos;ll be redirected to our secure payment page.</p>

                <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">{planName}{trialDollar ? ' — $1 trial' : ` — ${billing}`}</span>
                    <span className="font-bold text-gray-900">
                      ${price}{period}
                    </span>
                  </div>
                  {trialDollar && (
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                      <span>Then, from day 8</span>
                      <span>${fullPrice}{billing === 'monthly' ? '/mo' : '/yr'}</span>
                    </div>
                  )}
                  {!trialDollar && billing === 'yearly' && yearlySavings > 0 && (
                    <div className="flex justify-between items-center text-xs text-emerald-600 mt-1">
                      <span>Savings vs monthly</span>
                      <span>–${yearlySavings}/yr</span>
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
                      placeholder="Your store name"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#6B3FD9] focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-[#6B3FD9] focus:outline-none transition" />
                  </div>
                </div>

                <div className="flex items-start gap-2.5 mb-4">
                  <input type="checkbox" id="checkout-terms" checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)} required
                    className="w-4 h-4 mt-0.5 rounded border-gray-300 bg-gray-50 text-[#6B3FD9] focus:ring-[#6B3FD9] focus:ring-offset-0" />
                  <label htmlFor="checkout-terms" className="text-sm text-gray-500">
                    I agree to the{' '}
                    <Link href="/terms" className="text-[#6B3FD9] hover:text-[#5A2EC9] transition">Terms of Service</Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-[#6B3FD9] hover:text-[#5A2EC9] transition">Privacy Policy</Link>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !agreedToTerms}
                  className="flex items-center justify-center gap-2 w-full bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-4 rounded-2xl transition-all text-base disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  {submitting ? 'Redirecting…' : trialDollar ? 'Start for $1' : 'Pay now'}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-4">
                  <Lock className="w-3.5 h-3.5" />
                  Secured by Lemon Squeezy · SSL encrypted
                </p>

                {/* Only Launch has a free week — Growth/Scale always start
                    at $1, so this offer never applies to them. */}
                {!trialDollar && plan === 'launch' && (
                  <p className="text-center text-xs text-gray-400 mt-4">
                    Prefer to try first?{' '}
                    <Link href={`/register?plan=${plan}&billing=${billing}`} className="text-[#6B3FD9] font-semibold hover:underline">
                      Start a free trial instead
                    </Link>
                  </p>
                )}
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
