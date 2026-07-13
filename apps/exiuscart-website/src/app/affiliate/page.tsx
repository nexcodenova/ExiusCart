'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DollarSign, Check, Loader2, ArrowLeft, ArrowRight,
  Sparkles, Clock, Wallet, BadgeCheck, Play, Copy, Quote,
  MousePointerClick, TrendingUp, X, Repeat, Zap, Calculator,
} from 'lucide-react';

const HOW_IT_WORKS = [
  { step: '1', title: 'Apply', desc: 'Fill in the short form. We review and approve within 24 hours.' },
  { step: '2', title: 'Get your link', desc: 'Receive a unique referral link like exiuscart.com/register?ref=YOU.' },
  { step: '3', title: 'Share it', desc: 'Post it on social media, WhatsApp groups, YouTube, or send to business owners directly.' },
  { step: '4', title: 'Get paid', desc: 'Choose a one-time flat commission, or a recurring commission paid monthly for a full year — paid via PayPal, Skrill, or Payoneer.' },
];

const METRICS = [
  { icon: DollarSign, value: '$75', label: 'One-time, per referral' },
  { icon: Repeat, value: '50%', label: 'Recurring, for 12 months' },
  { icon: Wallet, value: '3 methods', label: 'PayPal · Skrill · Payoneer' },
  { icon: BadgeCheck, value: 'Free', label: 'To join, no minimums' },
];

// ── Calculator constants ──
const ONE_TIME_AMOUNT = 75;
const AVG_SUBSCRIPTION_VALUE = 28; // USD/mo — blended average across ExiusCart paid plans
const RECURRING_RATE = 0.5;
const RECURRING_MONTHS_CAP = 12;
const RECURRING_MONTHLY_PER_SELLER = AVG_SUBSCRIPTION_VALUE * RECURRING_RATE;

function EarningsCalculator() {
  const [model, setModel] = useState<'one_time' | 'recurring'>('recurring');
  const [sellersPerMonth, setSellersPerMonth] = useState(3);

  const totalReferralsYear = sellersPerMonth * 12;
  const oneTimeYearly = totalReferralsYear * ONE_TIME_AMOUNT;
  const recurringPerReferralTotal = RECURRING_MONTHLY_PER_SELLER * RECURRING_MONTHS_CAP;

  // Month-by-month breakdown: how many sellers are actively paying you, and how much
  const monthlyBreakdown = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const activeSellers = sellersPerMonth * month; // cohorts referred so far, all still within their 12-mo window
      return { month, activeSellers, earnings: activeSellers * RECURRING_MONTHLY_PER_SELLER };
    }), [sellersPerMonth]);

  const recurringSteadyMonthly = monthlyBreakdown[11].earnings;
  const recurringSteadySellers = monthlyBreakdown[11].activeSellers;
  const recurringYear1Total = monthlyBreakdown.reduce((sum, m) => sum + m.earnings, 0);
  const maxBar = recurringSteadyMonthly;

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  return (
    <section id="calculator" className="bg-[#0F0A1F] py-20 text-white">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-2xl text-center mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80">
            <Calculator className="h-4 w-4" /> Earnings Calculator
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">See how much you could earn</h2>
          <p className="mt-3 text-white/60">Three steps: pick a model, set your referral pace, see your numbers.</p>
        </div>

        {/* Model toggle */}
        <div className="mx-auto mb-10 flex w-fit rounded-xl border border-white/15 bg-white/5 p-1">
          <button
            onClick={() => setModel('one_time')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${model === 'one_time' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}
          >
            <Zap className="h-4 w-4" /> One-Time
          </button>
          <button
            onClick={() => setModel('recurring')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${model === 'recurring' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}
          >
            <Repeat className="h-4 w-4" /> Recurring
          </button>
        </div>

        {/* Step 1 — per referral */}
        <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-white/15 bg-white/5 p-5 flex items-center gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6B3FD9] text-sm font-bold">1</span>
          {model === 'one_time' ? (
            <p className="text-sm text-white/80">
              Each seller you refer pays you <strong className="text-white">$75</strong>, once — as soon as they activate a paid plan.
            </p>
          ) : (
            <p className="text-sm text-white/80">
              Each seller you refer pays you <strong className="text-white">{fmt(RECURRING_MONTHLY_PER_SELLER)}/mo</strong> (50% of their ~${AVG_SUBSCRIPTION_VALUE}/mo subscription), for up to 12 months —{' '}
              <strong className="text-[#A78BFA]">{fmt(recurringPerReferralTotal)} total per seller</strong> over the year.
            </p>
          )}
        </div>

        {/* Step 2 — your pace (seller slider) */}
        <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-white/15 bg-white/5 p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6B3FD9] text-sm font-bold">2</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-white/80">How many new sellers will you refer, each month?</span>
                <span className="font-bold text-[#A78BFA]">{sellersPerMonth}/mo</span>
              </div>
              <input
                type="range" min={1} max={20} step={1}
                value={sellersPerMonth}
                onChange={(e) => setSellersPerMonth(Number(e.target.value))}
                className="w-full accent-[#6B3FD9]"
              />
              <p className="mt-2 text-xs text-white/50">
                {sellersPerMonth} sellers/mo × 12 months = <strong className="text-white">{totalReferralsYear} sellers referred by the end of the year</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Step 3 — result */}
        {model === 'one_time' ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/15 bg-white/5 p-5 flex items-center gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6B3FD9] text-sm font-bold">3</span>
            <div className="flex-1">
              <p className="text-sm text-white/80 mb-3">
                {totalReferralsYear} sellers × $75 each = your total for the year:
              </p>
              <p className="text-5xl font-extrabold tracking-tight text-white">{fmt(oneTimeYearly)}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/15 bg-white/5 p-5">
            <div className="flex items-start gap-4 mb-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6B3FD9] text-sm font-bold">3</span>
              <p className="text-sm text-white/80 pt-1.5">
                Your income builds every month as new referrals stack on top of the ones still paying you:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
              <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
                <p className="text-sm text-white/60">Total earned in Year 1</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-white">{fmt(recurringYear1Total)}</p>
              </div>
              <div className="relative rounded-2xl border-2 border-[#A78BFA]/50 bg-gradient-to-br from-[#6B3FD9]/20 to-transparent p-6 text-center">
                <span className="absolute -top-3 right-5 rounded-full bg-[#6B3FD9] px-3 py-1 text-xs font-bold text-white">Keeps growing</span>
                <p className="text-sm text-white/60">By month 12, every month</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight text-[#A78BFA]">{fmt(recurringSteadyMonthly)}<span className="text-lg text-white/50">/mo</span></p>
                <p className="mt-1 text-xs text-white/40">from {recurringSteadySellers} sellers paying you at once</p>
              </div>
            </div>

            {/* Growth bar chart with seller count */}
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6">
              <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-4">Month-by-month: sellers paying you, and what you earn</p>
              <div className="flex items-end gap-1.5 h-36">
                {monthlyBreakdown.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <span className="text-[9px] text-white/50 opacity-0 group-hover:opacity-100 transition absolute -top-4">{fmt(m.earnings)}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#6B3FD9] to-[#A78BFA] transition-all"
                      style={{ height: `${Math.max(6, (m.earnings / maxBar) * 100)}%` }}
                    />
                    <span className="text-[10px] text-white/40">M{m.month}</span>
                    <span className="text-[9px] text-white/30">{m.activeSellers} sellers</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-white/40">
                Hover a bar to see that month&apos;s earnings. Each seller pays for 12 months from when they joined, so your active seller count — and income — keeps climbing as long as you keep referring.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function AffiliatePage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', website: '', platform: '', audience: '', country: '', experience: '', how_promote: '', commissionModel: 'one_time' as 'one_time' | 'recurring' });
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          website: formData.website,
          affiliate_type: 'external',
          how_promote: [
            formData.platform && `Platform: ${formData.platform}`,
            formData.audience && `Audience size: ${formData.audience}`,
            formData.country && `Target region: ${formData.country}`,
            formData.experience && `Experience: ${formData.experience}`,
            `Preferred commission model: ${formData.commissionModel === 'recurring' ? 'Recurring (50% for 12 months)' : 'One-Time ($75 flat)'}`,
            formData.how_promote && `Details: ${formData.how_promote}`,
          ].filter(Boolean).join(' | '),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Something went wrong. Please try again.'); return; }
      setSubmitted(true);
    } catch {
      setError('Could not connect to the server. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-200/70 bg-[#FBF8F3]/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold"><span className="text-[#6B3FD9]">Exius</span>Cart</Link>
          <div className="flex items-center gap-4 text-sm">
            <a href="https://affiliates.exiuscart.com/login" className="text-slate-600 hover:text-slate-900 transition">Sign in</a>
            <a href="#apply" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800">Become an affiliate</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#E4DBD1]">
        <div className="pointer-events-none absolute -right-32 -top-24 h-72 w-72 rounded-full bg-[#6B3FD9]/10 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#6B3FD9]/20 bg-[#6B3FD9]/5 px-4 py-1.5 text-sm font-medium text-[#6B3FD9]">
              <Sparkles className="h-4 w-4" /> ExiusCart Affiliate Program
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Earn <span className="text-[#6B3FD9]">$75</span> flat, or{' '}
              <span className="text-[#6B3FD9]">50% recurring</span>{' '}
              for a year
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">
              Refer businesses to ExiusCart and pick the commission model that fits you — a flat one-time payout, or 50% of their subscription every month for 12 months. Free to join, no minimums.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#apply" className="inline-flex items-center gap-2 rounded-xl bg-[#6B3FD9] px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#6B3FD9]/20 transition hover:bg-[#5A2EC9]">
                Get started <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#calculator" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-50">
                <Calculator className="h-4 w-4 text-[#6B3FD9]" /> Calculate my earnings
              </a>
            </div>
          </div>

          <div className="relative overflow-hidden">
            <video
              className="w-full scale-[1.04] mix-blend-multiply"
              src="/affiliate/exiuscart-affiliate-video-transperent.mp4"
              autoPlay muted loop playsInline
            />
          </div>
        </div>
      </section>

      {/* Metrics bar */}
      <section className="border-y border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 lg:grid-cols-4">
          {METRICS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6B3FD9]/10">
                <Icon className="h-5 w-5 text-[#6B3FD9]" />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Commission models */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Choose your commission model</h2>
            <p className="mt-3 text-slate-600">Pick what works best for you when you apply — a quick one-time payout, or a bigger payout spread over a year.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* One-time */}
            <div className="rounded-3xl border-2 border-slate-200 bg-[#FBF8F3] p-7 flex flex-col gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/5">
                <Zap className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">One-Time Commission</p>
                <p className="text-xs text-slate-500 mt-0.5">Paid once, as soon as your referral activates a paid plan</p>
              </div>
              <div>
                <p className="text-4xl font-extrabold text-slate-900">$75</p>
                <p className="text-xs text-slate-500 mt-1">Flat, per referral</p>
              </div>
              <ul className="mt-1 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Fastest payout — no waiting</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Simple, predictable</li>
              </ul>
            </div>

            {/* Recurring */}
            <div className="relative rounded-3xl border-2 border-[#6B3FD9]/50 bg-white p-7 shadow-lg shadow-[#6B3FD9]/10 flex flex-col gap-4">
              <span className="absolute -top-3 right-5 rounded-full bg-[#6B3FD9] px-3 py-1 text-xs font-bold text-white">Higher payout</span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6B3FD9]/10">
                <Repeat className="h-5 w-5 text-[#6B3FD9]" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Recurring Commission</p>
                <p className="text-xs text-slate-500 mt-0.5">Paid every month your referral stays subscribed</p>
              </div>
              <div>
                <p className="text-4xl font-extrabold text-[#6B3FD9]">50%</p>
                <p className="text-xs text-slate-500 mt-1">Of their monthly payment, for 12 months</p>
              </div>
              <ul className="mt-1 space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Compounds as you refer more sellers</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0" /> Best for consistent, ongoing promotion</li>
              </ul>
            </div>
          </div>

          {/* Free trial note */}
          <div className="mt-6 max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm text-slate-600 flex gap-3 items-center">
            <X className="h-4 w-4 text-slate-400 shrink-0" />
            Free trial signups don&apos;t earn commission — only referrals who activate a paid plan count.
          </div>

          {/* T&C note */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 flex gap-3 items-start max-w-3xl mx-auto">
            <BadgeCheck className="h-5 w-5 text-[#6B3FD9] shrink-0 mt-0.5" />
            <div>
              Commissions are subject to a lock period and eligibility rules.{' '}
              <Link href="/affiliate/terms" className="text-[#6B3FD9] font-medium hover:underline">Read full affiliate terms →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Earnings calculator */}
      <EarningsCalculator />

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-slate-600">Four simple steps from sign-up to your first payout.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6B3FD9] text-lg font-bold text-white">{s.step}</div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard mockup + stats */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative">
            <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#6B3FD9]/10 blur-2xl" />
            <div className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
              <div className="flex items-center gap-6 border-b border-slate-100 text-sm">
                <span className="-mb-px border-b-2 border-[#6B3FD9] pb-3 font-semibold text-[#6B3FD9]">Summary</span>
                <span className="pb-3 text-slate-400">Referrals</span>
                <span className="pb-3 text-slate-400">Payouts</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-[#FBF8F3] p-4">
                  <p className="text-2xl font-bold tracking-tight text-slate-900">$0.00</p>
                  <p className="mt-0.5 text-xs text-slate-500">Commissions earned</p>
                </div>
                <div className="rounded-xl bg-[#FBF8F3] p-4">
                  <p className="text-2xl font-bold tracking-tight text-slate-900">$0.00</p>
                  <p className="mt-0.5 text-xs text-slate-500">Commissions cleared</p>
                </div>
              </div>
              <div className="mt-5">
                <p className="mb-1.5 text-xs font-medium text-slate-500">Your referral link</p>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 p-1.5 pl-3">
                  <span className="flex-1 truncate text-sm text-slate-600">exiuscart.com/r/A1B2C3</span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B3FD9] px-3 py-1.5 text-xs font-semibold text-white"><Copy className="h-3.5 w-3.5" /> Copy</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Track every referral in real time</h2>
            <p className="mt-3 text-slate-600">Every click, referral, and payout in one simple dashboard — know exactly when your money is coming.</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <BigStat icon={Zap} value="$75" label="One-time commission option" />
              <BigStat icon={Repeat} value="50% / 12mo" label="Recurring commission option" />
              <BigStat icon={MousePointerClick} value="Real-time" label="Click & referral tracking" />
              <BigStat icon={TrendingUp} value="No cap" label="Earn from unlimited referrals" />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <Quote className="mx-auto h-8 w-8 text-[#6B3FD9]/30" />
        <p className="mt-4 text-xl font-medium leading-relaxed text-slate-800 sm:text-2xl">
          &ldquo;I referred 3 shops to ExiusCart and earned over $200 — it&apos;s the simplest affiliate program I&apos;ve used.&rdquo;
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#6B3FD9]/10 font-bold text-[#6B3FD9]">SJ</div>
          <div className="text-left">
            <p className="font-semibold text-slate-900">Sarah J.</p>
            <p className="text-sm text-slate-500">Digital Marketing Consultant</p>
          </div>
        </div>
      </section>

      {/* Application form */}
      <section id="apply" className="mx-auto max-w-2xl px-6 py-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 lg:p-8">
          {submitted ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold">Application submitted!</h2>
              <p className="mt-2 text-slate-600">We&apos;ll review and reply at <strong className="text-slate-900">{formData.email}</strong> within 24 hours.</p>
              <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#6B3FD9] hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back to home
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">Apply to become an affiliate</h2>
                <p className="mt-1 text-sm text-slate-500">Free to join. No minimum sales required. Get paid via PayPal, Skrill, or Payoneer.</p>
              </div>

              {/* Commission model choice */}
              <div className="mb-6">
                <p className="mb-2 text-sm font-medium text-slate-700">Which commission model would you prefer?</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setFormData(p => ({ ...p, commissionModel: 'one_time' }))}
                    className={`rounded-xl border-2 p-4 text-left transition ${formData.commissionModel === 'one_time' ? 'border-[#6B3FD9] bg-[#6B3FD9]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-slate-700" />
                      <span className="font-semibold text-sm text-slate-900">One-Time — $75</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Flat payout per referral</p>
                  </button>
                  <button type="button" onClick={() => setFormData(p => ({ ...p, commissionModel: 'recurring' }))}
                    className={`rounded-xl border-2 p-4 text-left transition ${formData.commissionModel === 'recurring' ? 'border-[#6B3FD9] bg-[#6B3FD9]/5' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-[#6B3FD9]" />
                      <span className="font-semibold text-sm text-slate-900">Recurring — 50%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Monthly, for 12 months per referral</p>
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic info */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Full name *">
                    <input type="text" required value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your name" className={inputCls} />
                  </Field>
                  <Field label="Email address *">
                    <input type="email" required value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" className={inputCls} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Phone">
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+XX XX XXX XXXX" className={inputCls} />
                  </Field>
                  <Field label="Your website or social profile">
                    <input type="text" value={formData.website} onChange={(e) => setFormData(p => ({ ...p, website: e.target.value }))} placeholder="https:// or @handle" className={inputCls} />
                  </Field>
                </div>

                {/* Promotion questions */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tell us how you'll promote</p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Primary promotion channel *">
                      <select required value={formData.platform} onChange={(e) => setFormData(p => ({ ...p, platform: e.target.value }))} className={inputCls}>
                        <option value="">Select a channel...</option>
                        <option>WhatsApp groups</option>
                        <option>Facebook / Instagram</option>
                        <option>TikTok</option>
                        <option>YouTube</option>
                        <option>Blog / Website</option>
                        <option>Email newsletter</option>
                        <option>Direct outreach (B2B)</option>
                        <option>Other</option>
                      </select>
                    </Field>
                    <Field label="Estimated audience / reach *">
                      <select required value={formData.audience} onChange={(e) => setFormData(p => ({ ...p, audience: e.target.value }))} className={inputCls}>
                        <option value="">Select range...</option>
                        <option>Under 500</option>
                        <option>500 – 2,000</option>
                        <option>2,000 – 10,000</option>
                        <option>10,000 – 50,000</option>
                        <option>50,000+</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Country / region you'll target *">
                      <input type="text" required value={formData.country} onChange={(e) => setFormData(p => ({ ...p, country: e.target.value }))} placeholder="e.g. UAE, Sri Lanka, Saudi Arabia" className={inputCls} />
                    </Field>
                    <Field label="Affiliate marketing experience">
                      <select value={formData.experience} onChange={(e) => setFormData(p => ({ ...p, experience: e.target.value }))} className={inputCls}>
                        <option value="">Select...</option>
                        <option>First time</option>
                        <option>Some experience (1–2 programs)</option>
                        <option>Experienced (3+ programs)</option>
                        <option>Professional affiliate marketer</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Describe your promotion plan">
                    <textarea value={formData.how_promote} onChange={(e) => setFormData(p => ({ ...p, how_promote: e.target.value }))} rows={3} placeholder="e.g. I manage a WhatsApp group of 800 garment shop owners in Colombo. I'll share ExiusCart with a short explainer video and my referral link every time a new member joins..." className={`${inputCls} resize-none`} />
                  </Field>
                </div>

                <button type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6B3FD9] py-3.5 text-base font-bold text-white transition hover:bg-[#5A2EC9] disabled:opacity-60">
                  {isLoading
                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</>
                    : <>Apply now <ArrowRight className="h-4 w-4" /></>}
                </button>
                <p className="text-center text-xs text-slate-500">
                  By applying you agree to our{' '}
                  <Link href="/affiliate/terms" className="text-[#6B3FD9] hover:underline">Affiliate Terms</Link> and{' '}
                  <Link href="/privacy" className="text-[#6B3FD9] hover:underline">Privacy Policy</Link>.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6B3FD9] focus:outline-none focus:ring-2 focus:ring-[#6B3FD9]/15';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-sm text-slate-600">{label}</label>{children}</div>;
}

function BigStat({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B3FD9]/10">
        <Icon className="h-4 w-4 text-[#6B3FD9]" />
      </div>
      <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}
