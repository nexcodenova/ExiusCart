'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, X, ChevronDown } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { useCurrency } from '@/context/currency-context';
import { pricing } from '@/config/pricing';

type Period = 'monthly' | 'yearly';

const faqs = [
  {
    q: 'What happens after the 14-day free trial?',
    a: 'Your account is paused and you can upgrade to Starter or Premium to continue. All your data is saved — nothing is deleted.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes. Cancel from your account settings anytime. You keep access until the end of your current billing period.',
  },
  {
    q: 'What is the difference between monthly and yearly billing?',
    a: 'Yearly billing saves you approximately 15% compared to monthly. You are charged once per year upfront.',
  },
  {
    q: 'Can I upgrade from Starter to Premium?',
    a: 'Yes — upgrade anytime. You only pay the prorated difference for the remaining billing period.',
  },
  {
    q: 'Do UAE and international users pay different prices?',
    a: 'Yes. UAE users pay in AED (Starter AED 69/mo, Premium AED 149/mo). International users pay in USD (Starter $19/mo, Premium $39/mo). Prices are shown automatically based on your location.',
  },
  {
    q: 'Is VAT invoicing available on the free trial?',
    a: 'Yes — VAT-compliant invoicing is available on all plans including the free trial.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept bank transfer and local payment methods. Card payments coming soon.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Yes — we offer a 7-day money-back guarantee if you are not satisfied after upgrading.',
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<Period>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { currency, currencyConfig, isLoading } = useCurrency();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  const prices = pricing[currency];
  const fmt = (n: number) => currency === 'USD' ? `$${n}` : `AED ${n}`;
  const starterPrice = billing === 'monthly' ? prices.starter.monthly : prices.starter.yearly;
  const premiumPrice = billing === 'monthly' ? prices.premium.monthly : prices.premium.yearly;
  const period = billing === 'monthly' ? '/mo' : '/yr';

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-28 pb-12 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#6B3FD9] bg-[#6B3FD9]/10 px-3 py-1.5 rounded-full mb-6">
            Transparent Pricing
          </span>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-5">
            Simple pricing.<br />
            <span className="text-[#6B3FD9]">Serious power.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-8 leading-relaxed">
            Start free for 14 days. No credit card required.
            Upgrade when you&apos;re ready.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            {currencyConfig.flag}&nbsp; Prices shown in&nbsp;
            <strong className="text-gray-600">{currency}</strong>&nbsp;
            for {currencyConfig.country}
          </p>

          {/* Billing toggle */}
          <div className="flex justify-center">
            <div className="inline-flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-7 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  billing === 'monthly'
                    ? 'bg-[#0B1121] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-7 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                  billing === 'yearly'
                    ? 'bg-[#0B1121] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Yearly
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  Save 15%
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing cards ── */}
      <section className="pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-4 items-start">

            {/* Free Trial */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400">
                Free Trial
              </span>
              <div className="mt-3 mb-1 flex items-baseline gap-1">
                <span className="text-5xl font-black text-gray-900 tracking-tight">Free</span>
              </div>
              <p className="text-sm text-gray-400 mb-7">14 days · no credit card</p>

              <Link
                href="/register"
                className="block text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Start Free Trial
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Included
              </p>
              <ul className="space-y-3">
                {['25 products', '50 orders / month', '100 customers', '1 user account', 'Basic POS & Invoicing', 'VAT invoicing (5%)'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-gray-500" />
                    </span>
                    {f}
                  </li>
                ))}
                {['Shopify integration', 'Multi-user access', 'Chat support'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <X className="w-3 h-3 text-gray-300" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Starter — featured */}
            <div className="relative bg-[#0B1121] rounded-3xl p-8 shadow-2xl ring-2 ring-[#6B3FD9] -mt-4 md:-mt-6">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#6B3FD9] text-white text-[11px] font-bold px-4 py-1.5 rounded-full whitespace-nowrap tracking-wide">
                Most Popular
              </div>

              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#6B3FD9]">
                Starter
              </span>
              <div className="mt-3 mb-1 flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-white tracking-tight">{fmt(starterPrice)}</span>
                <span className="text-gray-500 text-sm">{period}</span>
              </div>
              <p className="text-sm text-gray-500 mb-7">For small shops. Most businesses fit here.</p>

              <Link
                href="/register"
                className="block text-center bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Get Started
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">
                Everything in Free, plus
              </p>
              <ul className="space-y-3">
                {[
                  '1,000 products',
                  '1,000 orders / month',
                  '5,000 customers',
                  '3 user accounts',
                  'Full POS & Invoicing',
                  'VAT invoicing (5%)',
                  'Shopify + store sync',
                  'Lead management (500)',
                  'Chat support',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-[#6B3FD9]/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#6B3FD9]" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400">
                Premium
              </span>
              <div className="mt-3 mb-1 flex items-baseline gap-1.5">
                <span className="text-5xl font-black text-gray-900 tracking-tight">{fmt(premiumPrice)}</span>
                <span className="text-gray-400 text-sm">{period}</span>
              </div>
              <p className="text-sm text-gray-400 mb-7">Unlimited everything. For growing businesses.</p>

              <Link
                href="/register"
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Get Started
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Everything in Starter, plus
              </p>
              <ul className="space-y-3">
                {[
                  'Unlimited products',
                  'Unlimited orders',
                  'Unlimited customers & users',
                  'Custom invoice branding',
                  'Send from own domain',
                  'Multi-store & multi-location',
                  'Unlimited leads',
                  'Priority support + onboarding',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-gray-700" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Trust row */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-gray-400">
            {[
              'No credit card for free trial',
              'Cancel anytime',
              '7-day money-back guarantee',
              'All features from day one',
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#6B3FD9]" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full comparison table ── */}
      <section className="py-20 px-6 bg-[#0B1121]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-3">
            Full plan comparison
          </h2>
          <p className="text-gray-500 text-center mb-12">
            See exactly what&apos;s included in each plan
          </p>

          <div className="overflow-x-auto rounded-2xl border border-gray-800">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-4 pl-6 text-left text-sm text-gray-500 font-medium w-[42%]">Feature</th>
                  <th className="py-4 text-center text-sm text-gray-500 font-medium">Free Trial</th>
                  <th className="py-4 text-center text-sm font-semibold text-[#6B3FD9]">Starter</th>
                  <th className="py-4 pr-6 text-center text-sm text-gray-500 font-medium">Premium</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-800/50">
                <CmpSection label="Core Limits" />
                <CmpRow f="Products"         t="25"       s="1,000"     p="Unlimited" />
                <CmpRow f="Orders / month"   t="50"       s="1,000"     p="Unlimited" />
                <CmpRow f="Customers"        t="100"      s="5,000"     p="Unlimited" />
                <CmpRow f="Team users"       t="1"        s="3"         p="Unlimited" />
                <CmpRow f="Storage"          t="500 MB"   s="5 GB"      p="20 GB" />
                <CmpRow f="Branches"         t="1"        s="1"         p="Multiple" />

                <CmpSection label="POS & Invoicing" />
                <CmpRow f="Point of Sale"            t="Basic"    s             p />
                <CmpRow f="VAT invoicing (5%)"       t            s             p />
                <CmpRow f="PDF invoice download"     t            s             p />
                <CmpRow f="Invoice email sending"    t="50/mo"    s="500/mo"    p="Unlimited" />
                <CmpRow f="Custom invoice branding"  t={false}    s="Basic"     p="Full" />
                <CmpRow f="Send from own domain"     t={false}    s={false}     p />
                <CmpRow f="Receipts"                 t            s             p />

                <CmpSection label="Inventory" />
                <CmpRow f="Stock tracking"        t="Basic"  s          p />
                <CmpRow f="Low-stock alerts"      t={false}  s          p />
                <CmpRow f="Auto stock deduction"  t          s          p />
                <CmpRow f="Item movement history" t={false}  s          p />
                <CmpRow f="Multi-location stock"  t={false}  s={false}  p />

                <CmpSection label="Store Integration" />
                <CmpRow f="Shopify sync"         t={false}  s  p />
                <CmpRow f="Custom store API"     t={false}  s  p />
                <CmpRow f="Real-time order sync" t={false}  s  p />
                <CmpRow f="Multi-store"          t={false}  s={false}  p />

                <CmpSection label="Marketing & Leads" />
                <CmpRow f="Lead management"       t={false}  s="500"   p="Unlimited" />
                <CmpRow f="Meta Ads lead capture" t={false}  s         p />
                <CmpRow f="Email campaigns"       t={false}  s="Basic" p />
                <CmpRow f="Lead source tracking"  t={false}  s         p />

                <CmpSection label="Reports & Analytics" />
                <CmpRow f="Sales reports"           t="Basic"  s="Advanced"  p="Advanced" />
                <CmpRow f="Inventory reports"       t={false}  s             p />
                <CmpRow f="VAT reports"             t          s             p />
                <CmpRow f="Data export (Excel/CSV)" t={false}  s             p />
                <CmpRow f="Custom reports"          t={false}  s={false}     p />

                <CmpSection label="Support" />
                <CmpRow f="Email support"     t  s  p />
                <CmpRow f="Chat support"      t={false}  s  p />
                <CmpRow f="Priority support"  t={false}  s={false}  p />
                <CmpRow f="Onboarding help"   t={false}  s={false}  p />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-6 bg-[#F5F3EF]">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-2">
            {faqs.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="text-gray-900 font-medium text-sm pr-4">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 bg-[#0B1121]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Start your free trial today
          </h2>
          <p className="text-gray-400 mb-10 text-lg">
            14 days free. No credit card. Cancel anytime.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-10 py-4 rounded-2xl transition-all text-base"
            >
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ── Comparison table helpers ── */
function CmpSection({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={4} className="pt-6 pb-2 pl-6">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#6B3FD9]">
          {label}
        </span>
      </td>
    </tr>
  );
}

function CmpRow({ f, t, s, p }: { f: string; t?: boolean | string; s?: boolean | string; p?: boolean | string }) {
  const cell = (val?: boolean | string, isStarter = false) => {
    if (val === undefined || val === false)
      return <X className="w-4 h-4 text-gray-700 mx-auto" />;
    if (val === true)
      return <Check className={`w-4 h-4 mx-auto ${isStarter ? 'text-[#6B3FD9]' : 'text-gray-400'}`} />;
    return (
      <span className={`text-xs block text-center leading-tight ${isStarter ? 'text-[#6B3FD9] font-medium' : 'text-gray-400'}`}>
        {val}
      </span>
    );
  };

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="py-3 pl-6 text-gray-400">{f}</td>
      <td className="py-3 text-center">{cell(t)}</td>
      <td className="py-3 text-center">{cell(s, true)}</td>
      <td className="py-3 pr-6 text-center">{cell(p)}</td>
    </tr>
  );
}
