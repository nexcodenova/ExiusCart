'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Caveat } from 'next/font/google';
import { ArrowRight, Check, X, ChevronDown, Store, Users2, Puzzle, Headphones } from 'lucide-react';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { pricing } from '@/config/pricing';

const caveat = Caveat({ subsets: ['latin'], weight: ['600', '700'] });

type Period = 'monthly' | 'yearly';

// Hand-drawn marker-style callout — a curved arrow + handwritten note, the
// "someone scribbled this on the page" pattern used by Tradelle and similar
// SaaS pricing pages to draw the eye to one specific thing. `flip` mirrors
// the arrow for callouts pointing the other direction. Hidden below `lg`:
// there's no room for a floating annotation once cards stack to one column.
function PencilNote({
  text, className, rotate = -4, flip = false, direction = 'down', wrap = false, wrapWidth = 190,
}: { text: string | string[]; className?: string; rotate?: number; flip?: boolean; direction?: 'down' | 'left'; wrap?: boolean; wrapWidth?: number }) {
  const lines = Array.isArray(text) ? text : [text];
  // `wrap` trades the single-line layout for a narrow wrapped block — used
  // where the note has no guaranteed open space beside it (e.g. sitting in
  // a grid column with no fixed gutter), so it can't rely on screen width.
  const textEl = (
    <span
      className={`${caveat.className} text-2xl leading-snug text-[#6B3FD9] ${wrap ? 'whitespace-normal' : 'whitespace-nowrap'} ${direction === 'down' ? 'text-right' : ''}`}
      style={{ transform: `rotate(${rotate}deg)`, ...(wrap ? { maxWidth: `${wrapWidth}px` } : {}) }}
    >
      {lines.map((line, i) => (
        <span key={i} className={wrap ? undefined : 'block'}>{wrap ? `${line} ` : line}</span>
      ))}
    </span>
  );

  // 'down': text sits above, the arrow swoops down from it to point at a
  // target below — `flip` mirrors the swoop to lean right instead of left.
  if (direction === 'down') {
    return (
      <div className={`hidden lg:flex flex-col items-end gap-0.5 pointer-events-none select-none ${className ?? ''}`}>
        {textEl}
        <svg
          width="46" height="42" viewBox="0 0 46 42" fill="none"
          className={`shrink-0 text-[#6B3FD9] ${flip ? 'scale-x-[-1]' : ''}`}
        >
          <path
            d="M42 4C40 17 31 33 12 39C8 40.3 4.5 40 2 38.3"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"
          />
          <path d="M9 33.5L2 38.3L4.5 29.8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    );
  }

  // 'left': a short horizontal swoosh pointing left, for a note sitting
  // beside its target (same line) rather than above it.
  return (
    <div className={`hidden lg:flex items-center gap-1.5 pointer-events-none select-none ${className ?? ''}`}>
      <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="shrink-0 text-[#6B3FD9]">
        <path d="M38 7C27 8 14 12 4 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M11 9L4 15L12 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {textEl}
    </div>
  );
}

// Prodora is a real, named product-within-the-product (thousands of
// pre-vetted winning products, one-click import) — it was getting lost as
// plain text in a long checklist next to "Chat support". Pulled out into
// its own render so it reads as a headline feature, not a bullet point.
// The real logo file has a white background baked in (not transparent), so
// it's wrapped in a small white chip rather than dropped directly onto the
// dark cards — reads as an intentional app-icon badge, not a broken image.
function FeatureLine({ text }: { text: string }) {
  if (!text.startsWith('Prodora')) return <>{text}</>;
  const rest = text.replace(/^Prodora\s*—\s*/, '');
  return (
    <span className="inline-flex items-center flex-wrap gap-x-2">
      <span className="inline-flex items-center gap-1.5 font-black text-[1.2em] tracking-tight bg-gradient-to-r from-[#A78BFA] to-[#6B3FD9] bg-clip-text text-transparent">
        <span className="inline-flex w-[1.3em] h-[1.3em] rounded-md bg-white p-[0.15em] shrink-0 shadow-sm">
          <Image src="/prodora-logo.png" alt="" width={20} height={20} className="w-full h-full object-contain" />
        </span>
        Prodora
      </span>
      <span>— {rest}</span>
    </span>
  );
}

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
    q: 'Is pricing the same everywhere?',
    a: 'Yes — one price worldwide, billed in USD (Starter $12/mo, Premium $29/mo). No region-based pricing or currency switching.',
  },
  {
    q: 'Is VAT invoicing available on the free trial?',
    a: 'Yes — VAT-compliant invoicing is available on all plans including the free trial. Your VAT rate is configured in your account settings.',
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

  const prices = pricing.USD;
  const starterPrice = billing === 'monthly' ? prices.starter.monthly : prices.starter.yearly;
  const premiumPrice = billing === 'monthly' ? prices.premium.monthly : prices.premium.yearly;
  const starterOriginal = billing === 'monthly' ? prices.starter.originalMonthly : prices.starter.originalYearly;
  const premiumOriginal = billing === 'monthly' ? prices.premium.originalMonthly : prices.premium.originalYearly;
  const period = billing === 'monthly' ? '/mo' : '/yr';
  const currSym = '$';

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
            🌍&nbsp; One price for everyone, billed in&nbsp;
            <strong className="text-gray-600">USD</strong>
          </p>

          {/* Billing toggle */}
          <div className="flex justify-center">
            <div className="relative inline-flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
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
                className={`relative px-7 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  billing === 'yearly'
                    ? 'bg-[#0B1121] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Yearly
                {/* Below `lg` the hand-drawn PencilNote below is hidden (no
                    room for a floating annotation once cards stack), so this
                    compact badge carries the same savings message at every
                    size instead of losing it below desktop. Hidden at lg+ so
                    the two never show at once. 17%, not a round 15/20 — real
                    savings from pricing.ts's actual numbers (yearly = 10x
                    monthly, i.e. 2 months free): $12x12=$144 vs $120/yr, and
                    $29x12=$348 vs $290/yr, both ≈16.7%, rounded to 17%. */}
                <span className="animate-float lg:hidden absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm whitespace-nowrap">
                  -17%
                </span>
              </button>
              <PencilNote
                text="save 17% billing yearly!"
                rotate={-4}
                direction="left"
                wrap
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3"
              />
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
                {['25 products', '2 GB storage', '50 orders / month', '100 customers', '1 user account', 'Basic POS & Invoicing', 'VAT invoicing (Custom)', 'Basic marketing emails', 'Basic sales reports', '1 channel connection (Shopify, TheDersi, or custom site)'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-gray-500" />
                    </span>
                    <FeatureLine text={f} />
                  </li>
                ))}
                {['Multi-user access', 'HR & staff management', 'Chat support'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <X className="w-3 h-3 text-gray-300" />
                    </span>
                    <FeatureLine text={f} />
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
              {starterOriginal && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-gray-500 line-through">{currSym}{starterOriginal}{period}</span>
                  <span className="animate-float text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
                    {Math.round((1 - starterPrice / starterOriginal) * 100)}% OFF
                  </span>
                </div>
              )}
              <div className="mt-2 mb-2 flex items-start gap-2">
                <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
                <span className="text-[3.8rem] font-black text-white tracking-tight leading-none">{starterPrice}</span>
                <span className="text-gray-500 text-sm self-end mb-1">{period}</span>
              </div>
              <p className="text-sm text-gray-500 mb-7">For small shops. Most businesses fit here.</p>

              <Link
                href={`/checkout?plan=starter&billing=${billing}`}
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
                  '20 GB storage',
                  '1,000 orders / month',
                  '5,000 customers',
                  '3 user accounts',
                  'Full POS & Invoicing',
                  'VAT invoicing (Custom)',
                  '1 channel — Shopify, TheDersi, Daraz, Noon, eBay, WooCommerce, TikTok Shop, Amazon, or your own custom website (pick any one)',
                  '1 dropshipping supplier of your choice — CJ, AliExpress, or Printful',
                  'Prodora — discover winning products to sell',
                  'Lead management (500) · Google & Meta Ads capture',
                  'Email campaigns',
                  'Advanced reports & export',
                  'Chat support',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-[#6B3FD9]/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-[#6B3FD9]" />
                    </span>
                    <FeatureLine text={f} />
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium */}
            <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-400">
                Premium
              </span>
              {premiumOriginal && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-gray-400 line-through">{currSym}{premiumOriginal}{period}</span>
                  <span className="animate-float text-xs font-bold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                    {Math.round((1 - premiumPrice / premiumOriginal) * 100)}% OFF
                  </span>
                </div>
              )}
              <div className="mt-2 mb-2 flex items-start gap-2">
                <span className="text-xl font-black text-gray-400 mt-3 leading-none">$</span>
                <span className="text-[3.8rem] font-black text-gray-900 tracking-tight leading-none">{premiumPrice}</span>
                <span className="text-gray-400 text-sm self-end mb-1">{period}</span>
              </div>
              <p className="text-sm text-gray-400 mb-7">Unlimited everything. For growing businesses.</p>

              <Link
                href={`/checkout?plan=premium&billing=${billing}`}
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-2xl text-sm transition-all mb-8"
              >
                Get Started
              </Link>

              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
                Everything in Starter, plus
              </p>
              <ul className="space-y-3">
                {[
                  'Unlimited products & orders',
                  'Unlimited customers · 3 users',
                  'All channels — Shopify, TheDersi, Daraz, Noon, eBay, WooCommerce, TikTok Shop, Amazon, custom website — connect every one at once',
                  'CJ, AliExpress & Printful — full automatic order fulfillment',
                  'Prodora — discover & auto-import winning products',
                  'Full invoice branding',
                  'Multi-store & multi-location',
                  'Unlimited leads',
                  'Unlimited email campaigns',
                  'HR & Payroll',
                  'Helpdesk & Appointments',
                  'Advanced analytics',
                  'Priority support + onboarding',
                ].map((f) => (
                  <li key={f} className={`flex items-center gap-3 text-sm text-gray-600 ${f.startsWith('Prodora') ? 'relative' : ''}`}>
                    <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-gray-700" />
                    </span>
                    <FeatureLine text={f} />
                    {f.startsWith('Prodora') && (
                      <PencilNote
                        text="1000s of winning, high-margin picks — low-cost supplier details, auto-fulfilled!"
                        rotate={-2}
                        direction="left"
                        wrap
                        wrapWidth={280}
                        className="absolute left-full top-1/2 -translate-y-1/2 ml-3"
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Enterprise / Marketplace card — Paddle style */}
          <div className="mt-4 rounded-3xl overflow-hidden" style={{ background: '#EDEBE6' }}>
            <div className="p-10 md:p-14 grid md:grid-cols-2 gap-12 items-center">
              {/* Left: heading + description + button */}
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 block mb-4">
                  Marketplace &amp; Enterprise
                </span>
                <h3 className="text-4xl md:text-5xl font-bold text-gray-900 leading-[1.1] mb-5 tracking-tight">
                  Custom pricing
                </h3>
                <p className="text-gray-600 text-base leading-relaxed mb-10">
                  Running a marketplace with multiple vendors, or a large enterprise operation?
                  We&apos;ll build a plan around your exact needs — vendors, volume, and integrations.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-7 py-3.5 rounded-2xl transition-all text-sm"
                >
                  Contact us
                  <span className="w-6 h-6 bg-[#6B3FD9] rounded-lg flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-white" />
                  </span>
                </Link>
              </div>

              {/* Right: feature list 2-column */}
              <div className="grid sm:grid-cols-2 gap-5">
                {[
                  { icon: Store,      text: 'Custom pricing for marketplace operators with multiple vendors' },
                  { icon: Users2,     text: 'Send invoices from your own email domain — custom branding end-to-end' },
                  { icon: Puzzle,     text: 'Custom integrations, HR & staff management tailored to your operation' },
                  { icon: Headphones, text: 'Priority support with a dedicated account manager' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <span className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 mt-0.5 border border-black/6">
                      <Icon className="w-4 h-4 text-gray-600" />
                    </span>
                    <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
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

      {/* ── What's included ── */}
      <section className="py-20 px-6 bg-[#F5F3EF] border-t border-gray-200">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-14">
            What&apos;s included?
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
            {[
              {
                name: 'Point of Sale',
                desc: 'Fast checkout, product search, discounts, and receipts. Works on any device — no dedicated hardware needed.',
              },
              {
                name: 'Inventory Management',
                desc: 'Real-time stock tracking with low-stock alerts, variant support, and bulk import across all your channels.',
              },
              {
                name: 'VAT Invoicing',
                desc: 'Custom VAT rate on your invoices. FTA-compliant PDF invoices generated automatically for every order.',
              },
              {
                name: 'Order Management',
                desc: 'Orders from TheDersi, Shopify, WooCommerce, or your own website — one dashboard, same statuses.',
              },
              {
                name: 'Reports & Analytics',
                desc: 'Revenue trends, best-selling products, payment breakdowns, and channel performance. Export to Excel or PDF.',
              },
              {
                name: 'HR & Payroll',
                desc: 'Employee records, payroll processing, leave requests, and attendance tracking — no spreadsheets needed.',
              },
              {
                name: 'Marketing & Campaigns',
                desc: 'Email campaigns, SMS blasts, and events. Capture leads from Meta Ads. Track opens, clicks, and conversions.',
              },
              {
                name: 'Expenses & Purchases',
                desc: 'Log business expenses and supplier purchase orders. Match against revenue to see your real profit.',
              },
              {
                name: 'Helpdesk & Appointments',
                desc: 'Log customer issues, assign to staff, set priorities. Let customers book appointments directly.',
              },
              {
                name: 'Sales Channels',
                desc: 'Connect TheDersi, Shopify, WooCommerce, or a custom website. Orders sync in real time — no manual importing.',
              },
              {
                name: 'Customer Management',
                desc: 'Full order history, lifetime spend, and contact details for every customer across every channel.',
              },
              {
                name: 'Multi-currency',
                desc: 'Accept AED and USD with automatic currency handling. Prices and invoices shown in the right currency.',
              },
              {
                name: 'Lead Management',
                desc: 'Capture, track, and convert leads from Meta Ads, your website, or manual entry. Full source tracking.',
              },
              {
                name: 'Data Export',
                desc: 'Export your products, customers, invoices, and reports to Excel or PDF anytime — your data, always.',
              },
              {
                name: 'Multi-location & Multi-store',
                desc: 'Manage stock, orders, and staff across multiple branches or stores from one account. Premium plan.',
              },
            ].map((item) => (
              <div key={item.name}>
                <p className="font-bold text-gray-900 mb-2">{item.name}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What's in each plan — 3 independent cards ── */}
      <section className="py-16 px-6 bg-[#0B1121]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-2">What&apos;s in each plan?</h2>
          <p className="text-gray-600 text-sm text-center mb-10">Pick the plan that fits your business</p>

          <div className="grid md:grid-cols-3 gap-5 items-start">

            {/* Free Trial */}
            <div className="rounded-2xl border border-gray-800 bg-[#0D1526] p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Free Trial</p>
              <p className="text-xs text-gray-600 mb-5">14 days · no credit card needed</p>
              <div className="space-y-1.5">
                {[
                  '25 products',
                  '50 orders / month',
                  '100 customers · 1 user',
                  'Basic POS & invoicing',
                  'VAT invoicing (Custom)',
                  '50 invoice emails / mo',
                  'Basic stock tracking',
                  'Basic marketing emails',
                  'Basic sales reports',
                  'Email support',
                  '1 channel connection (Shopify, TheDersi, or custom site)',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-gray-400" />
                    </div>
                    <span className="text-gray-400 text-xs"><FeatureLine text={f} /></span>
                  </div>
                ))}
              </div>
              <Link href="/register" className="mt-6 block text-center text-xs font-semibold text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-xl py-2.5 transition-all">
                Start free trial
              </Link>
            </div>

            {/* Starter */}
            <div className="rounded-2xl border border-[#6B3FD9]/50 bg-[#0D1526] p-6 ring-1 ring-[#6B3FD9]/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6B3FD9] text-white text-[10px] font-bold px-3 py-1 rounded-full">
                Most Popular
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B3FD9] mb-1">Starter</p>
              <p className="text-xs text-gray-600 mb-5">Everything in Free, plus:</p>
              <div className="space-y-1.5">
                {[
                  '1,000 products',
                  '1,000 orders / month',
                  '5,000 customers · 3 users',
                  'Full POS & invoicing',
                  'VAT invoicing (Custom)',
                  '500 invoice emails / mo',
                  'Basic invoice branding',
                  'Low-stock alerts',
                  '1 channel — Shopify, TheDersi, Daraz, Noon, eBay, WooCommerce, TikTok Shop, Amazon, or your own custom website (pick any one)',
                  '1 dropshipping supplier of your choice — CJ, AliExpress, or Printful',
                  'Prodora — discover winning products to sell',
                  '500 leads · Google Ads & Meta Ads capture',
                  'Email campaigns',
                  'Advanced sales reports',
                  'Data export (Excel / CSV)',
                  'Chat support',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-[#6B3FD9]/20 border border-[#6B3FD9]/30 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-[#6B3FD9]" />
                    </div>
                    <span className="text-gray-300 text-xs"><FeatureLine text={f} /></span>
                  </div>
                ))}
              </div>
              <Link href={`/checkout?plan=starter&billing=${billing}`} className="mt-6 block text-center text-xs font-semibold text-white bg-[#6B3FD9] hover:bg-[#5A2EC9] rounded-xl py-2.5 transition-all">
                Get Started
              </Link>
            </div>

            {/* Premium */}
            <div className="rounded-2xl border border-gray-800 bg-[#0D1526] p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Premium</p>
              <p className="text-xs text-gray-600 mb-5">Everything in Starter, plus:</p>
              <div className="space-y-1.5">
                {[
                  'Unlimited products & orders',
                  'Unlimited customers · 3 users',
                  'All channels — Shopify, TheDersi, Daraz, Noon, eBay, WooCommerce, TikTok Shop, Amazon, custom website — connect every one at once',
                  'CJ, AliExpress & Printful — full automatic order fulfillment',
                  'Prodora — discover & auto-import winning products',
                  'Unlimited leads',
                  'Full invoice branding',
                  'Multi-location stock',
                  'Multi-store management',
                  'Unlimited email campaigns',
                  'HR & Payroll',
                  'Helpdesk & Appointments',
                  'Advanced analytics',
                  'Priority support + onboarding',
                ].map((f) => (
                  <div key={f} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 text-gray-400" />
                    </div>
                    <span className="text-gray-400 text-xs"><FeatureLine text={f} /></span>
                  </div>
                ))}
              </div>
              <Link href={`/checkout?plan=premium&billing=${billing}`} className="mt-6 block text-center text-xs font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-xl py-2.5 transition-all">
                Get Started
              </Link>
            </div>

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

      {/* ── CTA — Paddle-style left-aligned ── */}
      <section className="py-28 md:py-36 px-6 bg-[#0B1121]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-widest text-[#6B3FD9] mb-6">
              Start for free
            </p>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.04] tracking-tight mb-6">
              Ready to run your<br />business smarter?
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-10 max-w-lg">
              14 days free. No credit card. Every feature unlocked from day one —
              POS, invoicing, inventory, HR, appointments and more.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-[#6B3FD9] hover:bg-[#5A2EC9] text-white font-semibold px-8 py-4 rounded-2xl transition-all text-base"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-2xl border border-gray-700 hover:border-gray-500 transition-all text-base"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

