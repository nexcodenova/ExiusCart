'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, X, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { useCurrency } from '@/context/currency-context';
import { pricing } from '@/config/pricing';

type BillingPeriod = 'monthly' | 'yearly';

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { currency, currencyConfig, isLoading } = useCurrency();
  const prices = pricing[currency];

  const fmt = (n: number) => currency === 'USD' ? `$${n}` : `AED ${n}`;

  const starterPrice = billing === 'monthly' ? prices.starter.monthly : prices.starter.yearly;
  const premiumPrice = billing === 'monthly' ? prices.premium.monthly : prices.premium.yearly;
  const periodLabel  = billing === 'monthly' ? '/mo' : '/yr';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1121] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1121]">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 text-[#7B4FE9] text-xs font-bold tracking-widest uppercase mb-5 border border-[#7B4FE9]/30 bg-[#7B4FE9]/10 px-3 py-1.5 rounded-full">
            Transparent Pricing
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto mb-4">
            Start free for 14 days. No credit card required. Upgrade when you&apos;re ready.
          </p>
          <p className="text-sm text-gray-500">
            {currencyConfig.flag} Showing prices for {currencyConfig.country} ({currency})
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="pb-24 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Billing toggle */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-[#151F32] rounded-xl p-1 gap-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-7 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  billing === 'monthly' ? 'bg-[#7B4FE9] text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-7 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                  billing === 'yearly' ? 'bg-[#7B4FE9] text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                Yearly
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                  Save ~15%
                </span>
              </button>
            </div>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-6">

            {/* Free Trial */}
            <PlanCard
              name="Free Trial"
              badge="14 Days"
              description="Test everything basic. No credit card needed."
              priceDisplay="Free"
              period=""
              note="50 products · 1 user · 14 days only"
              features={[
                { text: '50 products', ok: true },
                { text: '50 orders / month', ok: true },
                { text: '100 customers', ok: true },
                { text: '1 user', ok: true },
                { text: 'Basic POS & Invoicing', ok: true },
                { text: 'VAT invoicing (5%)', ok: true },
                { text: '50 emails / month', ok: true },
                { text: 'Shopify sync', ok: false },
                { text: 'Lead management', ok: false },
                { text: 'Chat support', ok: false },
              ]}
              ctaText="Start Free Trial"
              ctaHref="/register"
            />

            {/* Starter */}
            <PlanCard
              name="Starter"
              badge="Most Popular"
              description="For small shops. Most businesses fit here."
              priceDisplay={fmt(starterPrice)}
              period={periodLabel}
              note="1,000 products · 3 users · cancel anytime"
              popular
              features={[
                { text: '1,000 products', ok: true },
                { text: '1,000 orders / month', ok: true },
                { text: '5,000 customers', ok: true },
                { text: '3 users', ok: true },
                { text: 'Full POS & Invoicing', ok: true },
                { text: 'VAT invoicing (5%)', ok: true },
                { text: '1,000 emails / month', ok: true },
                { text: 'Shopify + store sync', ok: true },
                { text: 'Lead management (500)', ok: true },
                { text: 'Chat support', ok: true },
              ]}
              ctaText="Get Started"
              ctaHref="/register"
            />

            {/* Premium */}
            <PlanCard
              name="Premium"
              description="For growing businesses. Everything unlimited."
              priceDisplay={fmt(premiumPrice)}
              period={periodLabel}
              note="Unlimited everything · multi-store · priority support"
              features={[
                { text: 'Unlimited products', ok: true },
                { text: 'Unlimited orders', ok: true },
                { text: 'Unlimited customers', ok: true },
                { text: 'Unlimited users', ok: true },
                { text: 'Custom invoice branding', ok: true },
                { text: 'Send from own domain', ok: true },
                { text: 'Unlimited emails', ok: true },
                { text: 'Multi-store & multi-location', ok: true },
                { text: 'Unlimited leads', ok: true },
                { text: 'Priority support + onboarding', ok: true },
              ]}
              ctaText="Get Started"
              ctaHref="/register"
            />
          </div>

          {/* Free trial CTA bar */}
          <div className="mt-10 bg-[#7B4FE9]/10 border border-[#7B4FE9]/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#7B4FE9]/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-[#7B4FE9]" />
              </div>
              <div>
                <p className="text-white font-semibold">Try ExiusCart free for 14 days</p>
                <p className="text-gray-400 text-sm">Full basic access. No credit card required. Upgrade anytime.</p>
              </div>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white font-semibold px-7 py-3 rounded-xl transition-all whitespace-nowrap text-sm"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Full Feature Comparison */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
            Full plan comparison
          </h2>
          <p className="text-gray-400 text-center mb-12 text-sm">
            See exactly what&apos;s included in each plan
          </p>

          <div className="overflow-x-auto rounded-2xl border border-gray-800">
            <table className="w-full min-w-[580px]">
              <thead>
                <tr className="border-b border-gray-800 bg-[#0D1526]">
                  <th className="text-left py-4 pl-5 text-gray-400 font-medium text-sm w-2/5">Feature</th>
                  <th className="text-center py-4 text-gray-400 font-medium text-sm">Free Trial</th>
                  <th className="text-center py-4 font-medium text-sm">
                    <span className="text-[#7B4FE9]">Starter</span>
                  </th>
                  <th className="text-center py-4 text-gray-400 font-medium text-sm pr-5">Premium</th>
                </tr>
              </thead>
              <tbody className="text-sm">

                <SectionHeader title="Core Limits" />
                <CompareRow f="Products"       t="50"      s="1,000"   p="Unlimited" />
                <CompareRow f="Orders / month" t="50"      s="1,000"   p="Unlimited" />
                <CompareRow f="Customers"      t="100"     s="5,000"   p="Unlimited" />
                <CompareRow f="Team users"     t="1"       s="3"       p="Unlimited" />
                <CompareRow f="Storage"        t="500 MB"  s="5 GB"    p="20 GB" />
                <CompareRow f="Branches"       t="1"       s="1"       p="Multiple" />

                <SectionHeader title="POS & Invoicing" />
                <CompareRow f="Point of Sale"            t="Basic"       s            p />
                <CompareRow f="VAT invoicing (5%)"       t               s            p />
                <CompareRow f="PDF invoice download"     t               s            p />
                <CompareRow f="Invoice email sending"    t="50/month"    s="1,000/month" p="Unlimited" />
                <CompareRow f="Custom invoice branding"  t={false}       s="Basic logo"  p="Full branding" />
                <CompareRow f="Send from own domain"     t={false}       s={false}    p />
                <CompareRow f="Receipts"                 t               s            p />

                <SectionHeader title="Inventory" />
                <CompareRow f="Stock tracking"        t="Basic"  s        p />
                <CompareRow f="Low-stock alerts"      t={false}  s        p />
                <CompareRow f="Auto stock deduction"  t          s        p />
                <CompareRow f="Item movement history" t={false}  s        p />
                <CompareRow f="Multi-location stock"  t={false}  s={false} p />

                <SectionHeader title="Store Integration" />
                <CompareRow f="Shopify sync"          t={false}  s  p />
                <CompareRow f="Custom store API"      t={false}  s  p />
                <CompareRow f="Real-time order sync"  t={false}  s  p />
                <CompareRow f="Multi-store"           t={false}  s={false} p />

                <SectionHeader title="Marketing & Leads" />
                <CompareRow f="Lead management"       t={false}  s="500 leads"  p="Unlimited" />
                <CompareRow f="Meta Ads lead capture" t={false}  s              p />
                <CompareRow f="Email campaigns"       t={false}  s="Basic"      p />
                <CompareRow f="Lead source tracking"  t={false}  s              p />

                <SectionHeader title="Orders & Delivery" />
                <CompareRow f="Order management"     t="Basic"  s  p />
                <CompareRow f="Delivery tracking"    t={false}  s  p />
                <CompareRow f="Supplier info"        t={false}  s  p />
                <CompareRow f="Order status updates" t          s  p />

                <SectionHeader title="Reports & Analytics" />
                <CompareRow f="Sales reports"          t="Basic"  s="Advanced"  p="Advanced" />
                <CompareRow f="Inventory reports"      t={false}  s             p />
                <CompareRow f="VAT reports"            t          s             p />
                <CompareRow f="Data export (Excel/CSV)" t={false} s             p />
                <CompareRow f="Custom reports"         t={false}  s={false}     p />

                <SectionHeader title="Support" />
                <CompareRow f="Email support"     t  s  p />
                <CompareRow f="Chat support"      t={false}  s  p />
                <CompareRow f="Priority support"  t={false}  s={false}  p />
                <CompareRow f="Onboarding help"   t={false}  s={false}  p />

              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {[
              {
                q: 'What happens after the 14-day free trial?',
                a: 'After 14 days your account is paused and you must upgrade to Starter or Premium to continue. All your data is saved — nothing is deleted.',
              },
              {
                q: 'Can I cancel my subscription anytime?',
                a: 'Yes. Cancel anytime from your account settings. You keep access until the end of your current billing period.',
              },
              {
                q: 'What is the difference between monthly and yearly billing?',
                a: 'Yearly billing saves you approximately 15% compared to monthly. You are charged once per year upfront.',
              },
              {
                q: 'Can I upgrade from Starter to Premium?',
                a: 'Yes, upgrade at any time. You only pay the prorated difference for the remaining billing period.',
              },
              {
                q: 'Do UAE and international users pay different prices?',
                a: 'Yes. UAE users pay in AED (Starter AED 69/mo, Premium AED 149/mo). International users pay in USD (Starter $19/mo, Premium $39/mo). Prices are automatically shown based on your location.',
              },
              {
                q: 'Is VAT invoicing available on the free trial?',
                a: 'Yes, VAT-compliant invoicing is available on all plans including the free trial.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept bank transfer and local payment methods. Card payments coming soon.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'Yes, we offer a 7-day money-back guarantee if you are not satisfied after upgrading.',
              },
            ].map((item, i) => (
              <div key={i} className="border border-gray-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-white font-medium text-sm pr-4">{item.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 pt-3 text-gray-400 text-sm border-t border-gray-800/60">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-[#0D1526]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-3">
            Start your free trial today
          </h2>
          <p className="text-gray-400 mb-8">
            14 days free. No credit card required. Cancel anytime.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white font-semibold px-10 py-4 rounded-xl transition-all"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function PlanCard({
  name,
  badge,
  description,
  priceDisplay,
  period,
  note,
  features,
  popular,
  ctaText,
  ctaHref,
}: {
  name: string;
  badge?: string;
  description: string;
  priceDisplay: string;
  period: string;
  note: string;
  features: { text: string; ok: boolean }[];
  popular?: boolean;
  ctaText: string;
  ctaHref: string;
}) {
  return (
    <div className={`relative flex flex-col rounded-2xl border p-6 ${
      popular
        ? 'border-[#7B4FE9] bg-[#151F32] ring-1 ring-[#7B4FE9]'
        : 'border-gray-800 bg-[#151F32]'
    }`}>
      {badge && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${
          popular ? 'bg-[#7B4FE9] text-white' : 'bg-gray-700 text-gray-300'
        }`}>
          {badge}
        </div>
      )}

      <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
      <p className="text-gray-500 text-sm mb-5">{description}</p>

      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-4xl font-black text-white">{priceDisplay}</span>
        {period && <span className="text-gray-500 text-sm">{period}</span>}
      </div>
      <p className="text-gray-600 text-xs mb-6">{note}</p>

      <Link
        href={ctaHref}
        className={`block text-center font-semibold py-3 rounded-xl transition-all mb-6 text-sm ${
          popular
            ? 'bg-[#7B4FE9] hover:bg-[#5A2EC9] text-white'
            : 'bg-white/10 hover:bg-white/20 text-white'
        }`}
      >
        {ctaText}
      </Link>

      <ul className="space-y-3 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {f.ok
              ? <Check className="w-4 h-4 text-[#7B4FE9] flex-shrink-0" />
              : <X className="w-4 h-4 text-gray-700 flex-shrink-0" />
            }
            <span className={`text-sm ${f.ok ? 'text-gray-300' : 'text-gray-600'}`}>{f.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr className="bg-[#0B1121]/60">
      <td colSpan={4} className="pt-6 pb-2 pl-5">
        <span className="text-xs font-bold tracking-widest uppercase text-[#7B4FE9]">{title}</span>
      </td>
    </tr>
  );
}

function CompareRow({
  f, t, s, p,
}: {
  f: string;
  t?: boolean | string;
  s?: boolean | string;
  p?: boolean | string;
}) {
  const cell = (val?: boolean | string) => {
    if (val === undefined || val === false) {
      return <X className="w-4 h-4 text-gray-700 mx-auto" />;
    }
    if (val === true) {
      return <Check className="w-4 h-4 text-[#7B4FE9] mx-auto" />;
    }
    return <span className="text-gray-400 text-xs text-center block leading-tight">{val}</span>;
  };

  return (
    <tr className="border-b border-gray-800/40 hover:bg-white/[0.015] transition-colors">
      <td className="py-3 pl-5 text-gray-300 text-sm">{f}</td>
      <td className="py-3 text-center">{cell(t)}</td>
      <td className="py-3 text-center">{cell(s)}</td>
      <td className="py-3 text-center pr-5">{cell(p)}</td>
    </tr>
  );
}
